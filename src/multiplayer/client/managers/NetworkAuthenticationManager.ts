import { supabase } from '../../../lib/SupabaseClient';
import { NetworkConnectionManager } from './NetworkConnectionManager';
import { NetworkEventManager } from './NetworkEventManager';
import { NetworkStateManager } from './NetworkStateManager';
import { GameContext } from '../../../infrastructure/engine/GameContext';
import { secureLogger } from '../../../config/NetworkConfig';

/**
 * NetworkAuthenticationManager - Gestione autenticazione JWT, retry logic, refresh session
 * Estratto da ClientNetworkSystem per Separation of Concerns
 */
export class NetworkAuthenticationManager {
  // Dependencies
  private readonly connectionManager: NetworkConnectionManager;
  private readonly eventSystem: NetworkEventManager;
  private readonly stateManager: NetworkStateManager;
  private readonly gameContext: GameContext;

  // JWT Authentication retry management
  private jwtRetryCount = 0;
  private maxJwtRetries = 3;
  private jwtRetryDelay = 2000; // Start with 2 seconds
  private jwtRetryTimeout: ReturnType<typeof setTimeout> | null = null;
  private isRetryingJwt = false;

  constructor(
    connectionManager: NetworkConnectionManager,
    eventSystem: NetworkEventManager,
    stateManager: NetworkStateManager,
    gameContext: GameContext
  ) {
    this.connectionManager = connectionManager;
    this.eventSystem = eventSystem;
    this.stateManager = stateManager;
    this.gameContext = gameContext;
  }

  /**
   * Validates local client ID
   */
  validateLocalClientId(): boolean {
    return !!(this.gameContext.localClientId && !this.gameContext.localClientId.startsWith('client_'));
  }

  /**
   * Validates session and gets JWT token with fail-fast validation
   */
  async validateSession(): Promise<{ session: { access_token: string } | null; error: any }> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        secureLogger.security('Session validation failed', { error: (error as any).message });
        return { session: null, error };
      }

      if (!session?.access_token) {
        secureLogger.security('No access token in session');
        return { session: null, error: new Error('No access token') };
      }

      // SECURITY: Validate token expiry before allowing connection
      const tokenExpiry = this.getTokenExpiry(session.access_token);
      const now = Math.floor(Date.now() / 1000);

      if (tokenExpiry && tokenExpiry <= now) {
        secureLogger.security('Token expired before connection', { expiry: tokenExpiry, now });
        return { session: null, error: new Error('Token expired') };
      }

      // SECURITY: Validate token is not expiring too soon (within 5 minutes)
      if (tokenExpiry && tokenExpiry - now < 300) {
        secureLogger.security('Token expiring soon', { expiresIn: tokenExpiry - now });
        // Allow connection but log warning
      }

      return { session, error: null };
    } catch (error) {
      secureLogger.security('Session validation error', { error: (error as any).message });
      return { session: null, error };
    }
  }

  /**
   * Extract token expiry from JWT payload (without external dependencies)
   */
  private getTokenExpiry(token: string): number | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) {
        return null;
      }

      // JWT uses base64url encoding, normalize it before atob().
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      const decoded = JSON.parse(atob(paddedBase64));
      return typeof decoded.exp === 'number' ? decoded.exp : null;
    } catch {
      return null;
    }
  }

  /**
   * Handles JWT authentication errors with fail-fast logic
   */
  handleAuthError(reason: string): void {
    secureLogger.security(`JWT Authentication failed: ${reason}`);

    if (this.jwtRetryCount >= this.maxJwtRetries) {
      secureLogger.security(`Max JWT retry attempts (${this.maxJwtRetries}) exceeded - disconnecting`);
      this.eventSystem.showAuthenticationError('Sessione scaduta. Ricarica la pagina per accedere nuovamente.', () => {
        this.connectionManager.disconnect();
      });
      return;
    }

    if (this.isRetryingJwt) {
      secureLogger.warn('JWT retry already in progress');
      return;
    }

    this.isRetryingJwt = true;
    this.jwtRetryCount++;

    const delay = this.jwtRetryDelay * Math.pow(2, this.jwtRetryCount - 1); // Exponential backoff

    this.eventSystem.showAuthenticationError(`Reconnection attempt ${this.jwtRetryCount}/${this.maxJwtRetries}...`);

    this.jwtRetryTimeout = setTimeout(async () => {
      try {
        // Try to refresh the session
        const { data, error } = await supabase.auth.refreshSession();

        if (error) {
          secureLogger.security('Session refresh failed', { error: (error as any).message });
          this.isRetryingJwt = false;
          this.handleAuthError('Session refresh failed');
          return;
        }

        if (data.session?.access_token) {
          this.isRetryingJwt = false;
          this.jwtRetryCount = 0; // Reset on success
          // Retry the connection
          await this.stateManager.connect();
        } else {
          secureLogger.security('Session refresh returned no token');
          this.isRetryingJwt = false;
          this.handleAuthError('No token after refresh');
        }
      } catch (error) {
        secureLogger.security('JWT retry failed', { error: (error as any).message });
        this.isRetryingJwt = false;
        this.handleAuthError('Retry failed');
      }
    }, delay);
  }

  /**
   * Cleanup method to clear timeouts and prevent memory leaks
   */
  destroy(): void {
    // Clear JWT retry timeout
    if (this.jwtRetryTimeout) {
      clearTimeout(this.jwtRetryTimeout);
      this.jwtRetryTimeout = null;
    }

    this.jwtRetryCount = 0;
    this.isRetryingJwt = false;
  }
}
