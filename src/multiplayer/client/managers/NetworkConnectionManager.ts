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

  // Connection callbacks
  private onConnectedCallback?: (socket: WebSocket) => Promise<void>;
  private onMessageCallback?: (data: string) => void;
  private onDisconnectedCallback?: () => void;
  private onConnectionErrorCallback?: (error: Event) => void;
  private onReconnectingCallback?: () => void;
  private onReconnectedCallback?: () => void;

  // Heartbeat management
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeatAck = 0;
  private heartbeatTimeout: NodeJS.Timeout | null = null;

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
   * Connette al server WebSocket
   */
  async connect(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔌 [CONNECTION] Connecting to:', this.serverUrl);
        this.socket = new WebSocket(this.serverUrl);

        this.socket.onopen = async () => {
          console.log('🔌 [CONNECTION] WebSocket connected successfully');
          await this.handleConnected(this.socket!);
          this.startHeartbeat();
          resolve(this.socket!);
        };

        this.socket.onmessage = (event) => {
          console.log('🔽 [CONNECTION] ===== RAW MESSAGE RECEIVED =====');
          console.log('🔽 [CONNECTION] Raw data length:', event.data.length);
          console.log('🔽 [CONNECTION] Raw data preview:', event.data.substring(0, 200) + '...');
          this.handleMessage(event.data);
        };

        this.socket.onclose = () => {
          console.log('🔌 [CONNECTION] WebSocket disconnected');
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
    console.log('📨 [CONNECTION] ===== RECEIVED MESSAGE =====');
    console.log('📨 [CONNECTION] Raw data length:', data.length);
    console.log('📨 [CONNECTION] Raw data preview:', data.substring(0, 200) + '...');

    try {
      const message: NetMessage = JSON.parse(data);
      console.log('📨 [CONNECTION] Parsed message type:', message.type);

      // Handle system messages first
      switch (message.type) {
        case 'heartbeat_ack':
          console.log('📨 [CONNECTION] Handling heartbeat_ack');
          this.lastHeartbeatAck = Date.now();
          if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
          }
          break;

        default:
          // Forward to ClientNetworkSystem for routing
          console.log('📨 [CONNECTION] Forwarding message to ClientNetworkSystem');
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
      console.log('🔌 [CONNECTION] Disconnecting...');
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
    if (!this.socket) return;

    const message = {
      type: 'heartbeat',
      clientId: 'client_' + Math.random().toString(36).substr(2, 9), // TODO: Get from context
      timestamp: Date.now()
    };

    this.send(JSON.stringify(message));

    // Set timeout for heartbeat response
    this.heartbeatTimeout = setTimeout(() => {
      console.warn('🔌 [CONNECTION] Heartbeat timeout - connection may be lost');
      this.handleConnectionError(new Event('heartbeat_timeout'));
    }, 5000);
  }

  /**
   * Cleanup risorse
   */
  private cleanup(): void {
    this.stopHeartbeat();
    this.socket = null;
  }


  /**
   * Callback setters
   */
  onConnected(callback: () => void): void {
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
      readyState: this.socket?.readyState || -1
    };
  }
}