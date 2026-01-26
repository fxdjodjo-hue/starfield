import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { NETWORK_CONFIG } from '../../../config/NetworkConfig';
import type { NetMessage } from '../types/MessageTypes';

/**
 * NetworkConnectionManager - Gestisce la connessione WebSocket e comunicazione base
 * Refactored da ClientNetworkSystem per Separation of Concerns
 */
export class NetworkConnectionManager {
  private socket: WebSocket | null = null;
  private serverUrl: string;
  private clientId: string = '';

  // Connection callbacks
  private onConnectedCallback?: (socket: WebSocket) => Promise<void>;
  private onMessageCallback?: (data: string) => void;
  private onDisconnectedCallback?: () => void;
  private onConnectionErrorCallback?: (error: Event) => void;
  private onReconnectingCallback?: () => void;
  private onReconnectedCallback?: () => void;

  // Heartbeat management
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastHeartbeatAck = 0;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;

  // Bandwidth tracking
  private bytesIn = 0;
  private bytesOut = 0;
  private kbpsIn = 0;
  private kbpsOut = 0;
  private bandwidthInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    serverUrl: string,
    onConnected: (socket: WebSocket) => Promise<void>,
    onMessage: (data: string) => void,
    onDisconnected: () => void,
    onConnectionError: (error: Event) => void,
    onReconnecting: () => void
  ) {
    this.serverUrl = serverUrl;

    // Store callbacks
    this.onConnectedCallback = onConnected;
    this.onMessageCallback = onMessage;
    this.onDisconnectedCallback = onDisconnected;
    this.onConnectionErrorCallback = onConnectionError;
    this.onReconnectingCallback = onReconnecting;

    // Bind callbacks
    this.handleConnected = this.handleConnected.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleDisconnected = this.handleDisconnected.bind(this);
    this.handleConnectionError = this.handleConnectionError.bind(this);
    this.handleReconnecting = this.handleReconnecting.bind(this);
  }

  /**
   * Imposta il clientId persistente ricevuto dal server
   */
  setClientId(clientId: string): void {
    this.clientId = clientId;
  }

  /**
   * Connette al server WebSocket
   */
  async connect(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.serverUrl);

        this.socket.onopen = async () => {
          await this.handleConnected(this.socket!);
          this.startHeartbeat();
          this.startBandwidthTracking();
          resolve(this.socket!);
        };

        this.socket.onmessage = (event) => {
          // Traccia byte in entrata
          if (typeof event.data === 'string') {
            this.bytesIn += event.data.length;
          } else if (event.data instanceof Blob) {
            this.bytesIn += event.data.size;
          }

          this.handleMessage(event.data);
        };

        this.socket.onclose = () => {
          this.cleanup();
          this.handleDisconnected();
        };

        this.socket.onerror = (error) => {
          console.error('🔌 [CONNECTION] WebSocket error:', error);
          this.cleanup();
          reject(error);
        };

        // Timeout di connessione
        setTimeout(() => {
          if (this.socket?.readyState === WebSocket.CONNECTING) {
            this.socket.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000);

      } catch (error) {
        console.error('🔌 [CONNECTION] Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Gestisce connessione stabilita
   */
  private async handleConnected(socket: WebSocket): Promise<void> {
    this.socket = socket;
    this.startHeartbeat();

    if (this.onConnectedCallback) {
      await this.onConnectedCallback(socket);
    }
  }

  /**
   * Gestisce messaggi ricevuti
   */
  private handleMessage(data: string): void {
    try {
      const message: NetMessage = JSON.parse(data);

      // Handle system messages first
      switch (message.type) {
        case 'heartbeat_ack':
          this.lastHeartbeatAck = Date.now();
          if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
          }
          break;

        default:
          // Forward to ClientNetworkSystem for routing
          if (this.onMessageCallback) {
            this.onMessageCallback(data);
          } else {
            console.warn('⚠️ [CONNECTION] No onMessageCallback registered');
          }
          break;
      }
    } catch (error) {
      console.error('❌ [CONNECTION] Error parsing message:', error);
    }
  }

  /**
   * Gestisce disconnessione
   */
  private handleDisconnected(): void {
    this.cleanup();
    if (this.onDisconnectedCallback) {
      this.onDisconnectedCallback();
    }
  }

  /**
   * Gestisce errori di connessione
   */
  private handleConnectionError(error: Event): void {
    console.error('🔌 [CONNECTION] Connection error:', error);
    if (this.onConnectionErrorCallback) {
      this.onConnectionErrorCallback(error);
    }
  }

  /**
   * Gestisce tentativi di riconnessione
   */
  private handleReconnecting(): void {
    if (this.onReconnectingCallback) {
      this.onReconnectingCallback();
    }
  }

  /**
   * Invia un messaggio al server
   */
  send(message: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.bytesOut += message.length;
      this.socket.send(message);
    } else {
      console.warn('🔌 [CONNECTION] Cannot send message - socket not connected');
    }
  }

  /**
   * Verifica se la connessione è attiva
   */
  isConnectionActive(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Chiude la connessione
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.cleanup();
    }
  }

  /**
   * Avvia il sistema di heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // Cleanup any existing heartbeat

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnectionActive()) {
        this.sendHeartbeat();
      }
    }, NETWORK_CONFIG.HEARTBEAT_INTERVAL);
  }

  /**
   * Ferma il sistema di heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Invia heartbeat al server
   */
  private sendHeartbeat(): void {
    if (!this.socket || !this.clientId) return;

    const message = {
      type: 'heartbeat',
      clientId: this.clientId, // Usa il clientId persistente
      timestamp: Date.now()
    };

    this.send(JSON.stringify(message));

    // Set timeout for heartbeat response
    this.heartbeatTimeout = setTimeout(() => {
      console.warn('🔌 [CONNECTION] Heartbeat timeout - connection lost');
      this.handleConnectionError(new Event('heartbeat_timeout'));
      // FORCE DISCONNECT to trigger UI popup
      // This ensures handleDisconnected is called (via socket.onclose or explicitly if needed)
      this.disconnect();
      // Manually trigger callback just in case socket.close() doesn't fire immediately due to state
      this.handleDisconnected();
    }, 5000);
  }

  /**
   * Cleanup risorse
   */
  private cleanup(): void {
    this.stopHeartbeat();
    this.stopBandwidthTracking();
    this.socket = null;
  }

  /**
   * Avvia il tracciamento della larghezza di banda
   */
  private startBandwidthTracking(): void {
    this.stopBandwidthTracking();

    this.bandwidthInterval = setInterval(() => {
      // Calcola KB/s (byte / 1024)
      this.kbpsIn = this.bytesIn / 1024;
      this.kbpsOut = this.bytesOut / 1024;

      // Reset contatori per il prossimo secondo
      this.bytesIn = 0;
      this.bytesOut = 0;
    }, 1000);
  }

  /**
   * Ferma il tracciamento della larghezza di banda
   */
  private stopBandwidthTracking(): void {
    if (this.bandwidthInterval) {
      clearInterval(this.bandwidthInterval);
      this.bandwidthInterval = null;
    }
  }


  /**
   * Callback setters
   */
  onConnected(callback: (socket: WebSocket) => Promise<void>): void {
    this.onConnectedCallback = callback;
  }

  onDisconnected(callback: () => void): void {
    this.onDisconnectedCallback = callback;
  }

  onConnectionError(callback: (error: Event) => void): void {
    this.onConnectionErrorCallback = callback;
  }

  onReconnecting(callback: () => void): void {
    this.onReconnectingCallback = callback;
  }

  onReconnected(callback: () => void): void {
    this.onReconnectedCallback = callback;
  }

  /**
   * Restituisce statistiche di connessione
   */
  getStats() {
    return {
      isConnected: this.isConnectionActive(),
      lastHeartbeatAck: this.lastHeartbeatAck,
      readyState: this.socket?.readyState || -1,
      kbpsIn: this.kbpsIn,
      kbpsOut: this.kbpsOut
    };
  }
}