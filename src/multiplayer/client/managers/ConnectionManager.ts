import { NETWORK_CONFIG } from '../../../config/NetworkConfig';

/**
 * Circuit Breaker for network connections
 * Prevents infinite reconnection attempts when server is unreachable
 */
class NetworkCircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly FAILURE_THRESHOLD = 5;
  private readonly RECOVERY_TIMEOUT = 30000; // 30 secondi

  /**
   * Check if we should attempt a connection
   */
  shouldAttemptConnection(): boolean {
    const now = Date.now();
    if (now - this.lastFailureTime > this.RECOVERY_TIMEOUT) {
      // Reset after recovery timeout
      this.failureCount = 0;
      return true;
    }
    return this.failureCount < this.FAILURE_THRESHOLD;
  }

  /**
   * Record a connection failure
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    console.warn(`[CIRCUIT_BREAKER] Failure ${this.failureCount}/${this.FAILURE_THRESHOLD}`);
  }

  /**
   * Record a successful connection
   */
  recordSuccess(): void {
    this.failureCount = 0;
  }

  /**
   * Get current status
   */
  getStatus(): { failures: number; isOpen: boolean; nextRetryIn: number } {
    const now = Date.now();
    const timeSinceLastFailure = now - this.lastFailureTime;
    const isOpen = timeSinceLastFailure <= this.RECOVERY_TIMEOUT && this.failureCount >= this.FAILURE_THRESHOLD;
    const nextRetryIn = isOpen ? Math.max(0, this.RECOVERY_TIMEOUT - timeSinceLastFailure) : 0;

    return {
      failures: this.failureCount,
      isOpen,
      nextRetryIn
    };
  }
}

/**
 * Manages WebSocket connection lifecycle and events
 * Provides a clean abstraction over raw WebSocket API
 */
export class ConnectionManager {
  private socket: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private circuitBreaker = new NetworkCircuitBreaker();

  // Event callbacks
  private onConnected?: (socket: WebSocket) => void;
  private onMessage?: (data: string) => void;
  private onDisconnected?: () => void;
  private onError?: (error: Event) => void;
  private onReconnecting?: () => void;

  constructor(
    private serverUrl: string,
    onConnected?: (socket: WebSocket) => void,
    onMessage?: (data: string) => void,
    onDisconnected?: () => void,
    onError?: (error: Event) => void,
    onReconnecting?: () => void
  ) {
    this.onConnected = onConnected;
    this.onMessage = onMessage;
    this.onDisconnected = onDisconnected;
    this.onError = onError;
    this.onReconnecting = onReconnecting;
  }

  /**
   * Establishes connection to the server
   */
  async connect(): Promise<WebSocket> {
    // Check circuit breaker before attempting connection
    if (!this.circuitBreaker.shouldAttemptConnection()) {
      const status = this.circuitBreaker.getStatus();
      const error = new Error(`Circuit breaker open. Too many failures (${status.failures}). Next retry in ${Math.ceil(status.nextRetryIn / 1000)}s`);
      console.error(`🔌 ${error.message}`);
      throw error;
    }

    return new Promise((resolve, reject) => {
      try {
        // console.log(`🔌 Connecting to ${this.serverUrl}...`);
        this.socket = new WebSocket(this.serverUrl);

        // Set up event handlers
        this.socket.onopen = () => {
          // console.log('✅ Connected to server');
          this.isConnected = true;
          this.reconnectAttempts = 0; // Reset on successful connection

          // Record success in circuit breaker
          this.circuitBreaker.recordSuccess();

          if (this.onConnected) {
            this.onConnected(this.socket!);
          }

          resolve(this.socket!);
        };

        this.socket.onmessage = (event) => {
          if (this.onMessage) {
            this.onMessage(event.data);
          }
        };

        this.socket.onclose = () => {
          console.log('❌ Disconnected from server');
          this.isConnected = false;

          if (this.onDisconnected) {
            this.onDisconnected();
          }

          // Attempt reconnection if not manually disconnected
          this.scheduleReconnect();
        };

        this.socket.onerror = (error) => {
          console.error('🔌 WebSocket error:', error);

          // Record failure in circuit breaker
          this.circuitBreaker.recordFailure();

          if (this.onError) {
            this.onError(error);
          }

          reject(error);
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  /**
   * Closes the connection gracefully
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      console.log('🔌 Disconnecting from server...');
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Sends data through the WebSocket connection
   */
  send(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
    if (this.socket && this.isConnected && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(data);
    } else {
      console.warn('⚠️ Cannot send data: WebSocket not connected', {
        socket: !!this.socket,
        isConnected: this.isConnected,
        readyState: this.socket?.readyState
      });
    }
  }

  /**
   * Checks if the connection is currently active
   */
  isConnectionActive(): boolean {
    return this.isConnected &&
           this.socket !== null &&
           this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Gets current connection state
   */
  getConnectionState(): string {
    if (!this.socket) return 'disconnected';

    switch (this.socket.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'unknown';
    }
  }

  /**
   * Schedules a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    // Check circuit breaker first
    if (!this.circuitBreaker.shouldAttemptConnection()) {
      const status = this.circuitBreaker.getStatus();
      console.log(`🚫 Circuit breaker open. Max failures reached (${status.failures}). Next retry in ${Math.ceil(status.nextRetryIn / 1000)}s`);
      return;
    }

    if (this.reconnectAttempts >= NETWORK_CONFIG.RECONNECT_ATTEMPTS) {
      console.log('🚫 Max reconnection attempts reached, giving up');
      // Record failure in circuit breaker
      this.circuitBreaker.recordFailure();
      return;
    }

    this.reconnectAttempts++;
    const delay = NETWORK_CONFIG.RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts}/${NETWORK_CONFIG.RECONNECT_ATTEMPTS} in ${delay}ms`);

    // Notify that reconnection is starting
    if (this.onReconnecting) {
      this.onReconnecting();
    }

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(error => {
        console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
      });
    }, delay);
  }

  /**
   * Updates event callbacks (useful for dynamic reconfiguration)
   */
  updateCallbacks(
    onConnected?: (socket: WebSocket) => void,
    onMessage?: (data: string) => void,
    onDisconnected?: () => void,
    onError?: (error: Event) => void
  ): void {
    this.onConnected = onConnected ?? this.onConnected;
    this.onMessage = onMessage ?? this.onMessage;
    this.onDisconnected = onDisconnected ?? this.onDisconnected;
    this.onError = onError ?? this.onError;
  }

  /**
   * Gets connection statistics for debugging
   */
  getStats(): {
    isConnected: boolean;
    state: string;
    reconnectAttempts: number;
    serverUrl: string;
    circuitBreaker: { failures: number; isOpen: boolean; nextRetryIn: number };
  } {
    const circuitStatus = this.circuitBreaker.getStatus();
    return {
      isConnected: this.isConnected,
      state: this.getConnectionState(),
      reconnectAttempts: this.reconnectAttempts,
      serverUrl: this.serverUrl,
      circuitBreaker: circuitStatus
    };
  }
}
