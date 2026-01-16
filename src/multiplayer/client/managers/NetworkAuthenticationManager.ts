import { supabase } from '../../../lib/supabase';
import { NetworkConnectionManager } from './NetworkConnectionManager';
import { NetworkEventSystem } from './NetworkEventSystem';
import { NetworkStateManager } from './NetworkStateManager';
import { GameContext } from '../../../infrastructure/engine/GameContext';

/**
 * NetworkAuthenticationManager - Gestione autenticazione JWT, retry logic, refresh session
 * Estratto da ClientNetworkSystem per Separation of Concerns
 */
export class NetworkAuthenticationManager {
  // JWT Authentication retry management
  private jwtRetryCount = 0;
  private maxJwtRetries = 3;
  private jwtRetryDelay = 2000; // Start with 2 seconds
  private jwtRetryTimeout: NodeJS.Timeout | null = null;
  private isRetryingJwt = false;

  constructor(
    private readonly connectionManager: NetworkConnectionManager,
    private readonly eventSystem: NetworkEventSystem,
    private readonly stateManager: NetworkStateManager,
    private readonly gameContext: GameContext
  ) {}

  /**
   * Validates local client ID
   */
  validateLocalClientId(): boolean {
    return !!(this.gameContext.localClientId && !this.gameContext.localClientId.startsWith('client_'));
  }

  /**
   * Validates session and gets JWT token
   */
  async validateSession(): Promise<{ session: { access_token: string } | null; error: any }> {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
  }

  /**
   * Handles JWT authentication errors with retry logic instead of page reload
   */
  handleAuthError(reason: string): void {
    console.error(`❌ [CLIENT] JWT Authentication failed: ${reason}`);

    if (this.jwtRetryCount >= this.maxJwtRetries) {
      console.error(`🚨 [CLIENT] Max JWT retry attempts (${this.maxJwtRetries}) exceeded`);
      this.eventSystem.showAuthenticationError('Sessione scaduta. Ricarica la pagina per accedere nuovamente.', () => {
        this.connectionManager.disconnect();
      });
      return;
    }

    if (this.isRetryingJwt) {
      console.warn('⚠️ [CLIENT] JWT retry already in progress');
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
          console.error('❌ [CLIENT] Session refresh failed:', error);
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
          console.error('❌ [CLIENT] Session refresh returned no token');
          this.isRetryingJwt = false;
          this.handleAuthError('No token after refresh');
        }
      } catch (error) {
        console.error('❌ [CLIENT] JWT retry failed:', error);
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
