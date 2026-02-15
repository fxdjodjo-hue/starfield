import { NetworkConnectionManager } from './NetworkConnectionManager';
import { RateLimiter, RATE_LIMITS } from './RateLimiter';
import { NetworkTickManager } from './NetworkTickManager';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Connection states to prevent race conditions
 * Usa const object invece di enum per compatibilità con erasableSyntaxOnly
 */
export const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error'
} as const;

export type ConnectionState = typeof ConnectionState[keyof typeof ConnectionState];

/**
 * NetworkStateManager - Gestisce stato connessione, riconnessione, ping/heartbeat
 * Estratto da ClientNetworkSystem per Separation of Concerns
 */
export class NetworkStateManager {
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private connectionPromise: Promise<void> | null = null;
  private connectionResolver: (() => void) | null = null;
  private connectionRejector: ((error: Error) => void) | null = null;

  // Callbacks for external systems
  private onDisconnectedCallback?: () => void;
  private onConnectionErrorCallback?: (error: Event) => void;
  private onReconnectingCallback?: () => void;
  private onReconnectedCallback?: () => void;
  private onConnectedCallback?: () => void;

  constructor(
    private readonly connectionManager: NetworkConnectionManager,
    private readonly rateLimiter: RateLimiter,
    private readonly tickManager: NetworkTickManager,
    public clientId: string,
    private readonly isClientReady?: () => boolean
  ) { }

  /**
   * Gets the current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Checks if connected
   */
  isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED &&
      this.connectionManager.isConnectionActive();
  }

  /**
   * Connects to the server using the connection manager with race condition prevention
   */
  async connect(): Promise<void> {
    // Prevent multiple concurrent connection attempts.
    if (this.connectionState === ConnectionState.CONNECTED) {
      return Promise.resolve();
    }
    if (this.connectionState === ConnectionState.CONNECTING) {
      return this.connectionPromise || Promise.resolve();
    }
    if (this.connectionState === ConnectionState.RECONNECTING && this.connectionPromise) {
      return this.connectionPromise;
    }

    const isReconnectAttempt = this.connectionState === ConnectionState.RECONNECTING;

    // Set state and create promise
    this.connectionState = isReconnectAttempt ? ConnectionState.RECONNECTING : ConnectionState.CONNECTING;
    this.connectionPromise = new Promise<void>((resolve, reject) => {
      this.connectionResolver = resolve;
      this.connectionRejector = reject;
    });

    try {
      await this.connectionManager.connect();

      // Connection successful
      this.connectionState = ConnectionState.CONNECTED;

      if (this.connectionResolver) {
        this.connectionResolver();
        this.connectionResolver = null;
        this.connectionRejector = null;
      }

    } catch (error) {
      // Connection failed
      this.connectionState = ConnectionState.ERROR;
      console.error(`❌ [CLIENT] Socket connection failed:`, error);

      if (this.connectionRejector) {
        this.connectionRejector(error as Error);
        this.connectionResolver = null;
        this.connectionRejector = null;
      }

      throw error;
    }

    return this.connectionPromise;
  }

  /**
   * Handles disconnection events
   */
  handleDisconnected(): void {
    const previousState = this.connectionState;
    if (previousState === ConnectionState.DISCONNECTED && !this.connectionPromise) {
      return;
    }
    this.connectionState = ConnectionState.DISCONNECTED;

    // Reset connection promise
    if (this.connectionPromise && previousState !== ConnectionState.CONNECTED) {
      // If we were connecting but not yet connected, reject the promise
      if (this.connectionRejector) {
        this.connectionRejector(new Error('Connection lost during establishment'));
        this.connectionResolver = null;
        this.connectionRejector = null;
      }
    }
    this.connectionPromise = null;

    // Notify external systems
    if (this.onDisconnectedCallback) {
      this.onDisconnectedCallback();
    }
  }

  /**
   * Handles connection errors
   */
  handleConnectionError(error: Event): void {
    // Notify external systems
    if (this.onConnectionErrorCallback) {
      this.onConnectionErrorCallback(error);
    }
  }

  /**
   * Handles reconnection attempts
   */
  handleReconnecting(): void {
    if (this.connectionState !== ConnectionState.RECONNECTING) {
      this.connectionState = ConnectionState.RECONNECTING;
    }

    // Notify external systems
    if (this.onReconnectingCallback) {
      this.onReconnectingCallback();
    }
  }

  /**
   * Sets connection state (used by connection manager callbacks)
   */
  setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
  }

  /**
   * Notifies successful reconnection
   */
  notifyReconnected(): void {
    if (this.onReconnectedCallback) {
      this.onReconnectedCallback();
    }
  }

  /**
   * Notifies successful connection
   */
  notifyConnected(): void {
    if (this.onConnectedCallback) {
      this.onConnectedCallback();
    }
  }

  /**
   * Sends heartbeat to keep connection alive
   */
  sendHeartbeat(): void {
    if (!this.connectionManager.isConnectionActive()) return;

    // 🔴 CRITICAL: Non inviare heartbeat fino a quando non riceviamo il welcome
    // Questo previene l'invio con clientId vecchio
    if (this.isClientReady && !this.isClientReady()) {
      return;
    }

    // RATE LIMITING: Controlla se possiamo inviare heartbeat
    if (!this.rateLimiter.canSend('heartbeat', RATE_LIMITS.HEARTBEAT.maxRequests, RATE_LIMITS.HEARTBEAT.windowMs)) {
      // Rate limit superato - salta questo heartbeat
      return;
    }

    this.connectionManager.send(JSON.stringify({
      type: MESSAGE_TYPES.HEARTBEAT,
      clientId: this.clientId,
      timestamp: Date.now()
    }));
  }

  /**
   * Registers callback for disconnection events
   */
  onDisconnected(callback: () => void): void {
    this.onDisconnectedCallback = callback;
  }

  /**
   * Registers callback for connection error events
   */
  onConnectionError(callback: (error: Event) => void): void {
    this.onConnectionErrorCallback = callback;
  }

  /**
   * Registers callback for reconnection attempts
   */
  onReconnecting(callback: () => void): void {
    this.onReconnectingCallback = callback;
  }

  /**
   * Registers callback for successful reconnection
   */
  onReconnected(callback: () => void): void {
    this.onReconnectedCallback = callback;
  }

  /**
   * Registers callback for successful connection events
   */
  onConnected(callback: () => void): void {
    this.onConnectedCallback = callback;
  }

  /**
   * Cleanup method to clear promises and prevent memory leaks
   */
  destroy(): void {
    // Reset connection state
    this.connectionState = ConnectionState.DISCONNECTED;
    if (this.connectionPromise && this.connectionRejector) {
      this.connectionRejector(new Error('System destroyed during connection'));
    }
    this.connectionPromise = null;
    this.connectionResolver = null;
    this.connectionRejector = null;

    // Clear callbacks
    this.onDisconnectedCallback = undefined;
    this.onConnectionErrorCallback = undefined;
    this.onReconnectingCallback = undefined;
    this.onReconnectedCallback = undefined;
    this.onConnectedCallback = undefined;
  }
}
