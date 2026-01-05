import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { RemotePlayerSystem } from '../../systems/multiplayer/RemotePlayerSystem';
import { RemoteNpcSystem } from '../../systems/multiplayer/RemoteNpcSystem';
import { RemoteProjectileSystem } from '../../systems/multiplayer/RemoteProjectileSystem';

// New modular components
import { MessageRouter } from './handlers/MessageRouter';
import { WelcomeHandler } from './handlers/WelcomeHandler';
import { RemotePlayerUpdateHandler } from './handlers/RemotePlayerUpdateHandler';
import { PlayerJoinedHandler } from './handlers/PlayerJoinedHandler';
import { PlayerLeftHandler } from './handlers/PlayerLeftHandler';
// NPC handlers
import { InitialNpcsHandler } from './handlers/InitialNpcsHandler';
import { NpcJoinedHandler } from './handlers/NpcJoinedHandler';
import { NpcBulkUpdateHandler } from './handlers/NpcBulkUpdateHandler';
import { NpcLeftHandler } from './handlers/NpcLeftHandler';
// Combat handlers
import { ProjectileFiredHandler } from './handlers/ProjectileFiredHandler';
import { ProjectileUpdateHandler } from './handlers/ProjectileUpdateHandler';
import { ProjectileDestroyedHandler } from './handlers/ProjectileDestroyedHandler';
import { EntityDamagedHandler } from './handlers/EntityDamagedHandler';
import { EntityDestroyedHandler } from './handlers/EntityDestroyedHandler';
import { RemotePlayerManager } from './managers/RemotePlayerManager';
import { PlayerPositionTracker } from './managers/PlayerPositionTracker';
import { ConnectionManager } from './managers/ConnectionManager';
import { NetworkTickManager } from './managers/NetworkTickManager';

// Types and Configuration
import type { NetMessage } from './types/MessageTypes';
import { NETWORK_CONFIG, MESSAGE_TYPES } from '../../config/NetworkConfig';

/**
 * Sistema di rete client modulare per multiplayer
 * Utilizza architettura a componenti per gestire connessioni, messaggi e giocatori remoti
 */
export class ClientNetworkSystem extends BaseSystem {
  // Core dependencies
  public readonly gameContext: GameContext;
  public readonly clientId: string;

  // Network components
  private readonly connectionManager: ConnectionManager;
  private readonly tickManager: NetworkTickManager;
  private socket: WebSocket | null = null;

  // Player info
  private playerNickname: string = 'Player';
  private playerId?: number;

  // Position sync state
  private lastSentPosition: { x: number; y: number } | null = null;

  // New modular components
  private readonly messageRouter: MessageRouter;
  public readonly remotePlayerManager: RemotePlayerManager;
  private readonly positionTracker: PlayerPositionTracker;
  private remoteNpcSystem: RemoteNpcSystem | null = null;
  private remoteProjectileSystem: RemoteProjectileSystem | null = null;

  // Error handling callbacks
  private onDisconnectedCallback?: () => void;
  private onConnectionErrorCallback?: (error: Event) => void;
  private onReconnectingCallback?: () => void;
  private onReconnectedCallback?: () => void;

  constructor(ecs: ECS, gameContext: GameContext, remotePlayerSystem: RemotePlayerSystem, serverUrl: string = NETWORK_CONFIG.DEFAULT_SERVER_URL, remoteNpcSystem?: RemoteNpcSystem, remoteProjectileSystem?: RemoteProjectileSystem) {
    super(ecs);
    this.gameContext = gameContext;
    this.remoteNpcSystem = remoteNpcSystem || null;
    this.remoteProjectileSystem = remoteProjectileSystem || null;

    // Generate unique client ID
    this.clientId = 'client_' + Math.random().toString(36).substr(2, 9);

    // Initialize modular components
    this.messageRouter = new MessageRouter();
    this.remotePlayerManager = new RemotePlayerManager(ecs, remotePlayerSystem);
    this.positionTracker = new PlayerPositionTracker(ecs);

    // Initialize network tick manager
    this.tickManager = new NetworkTickManager(
      this.sendHeartbeat.bind(this),
      this.sendPlayerPosition.bind(this)
    );

    // Initialize connection manager with callbacks
    this.connectionManager = new ConnectionManager(
      serverUrl,
      this.handleConnected.bind(this),
      this.handleMessage.bind(this),
      this.handleDisconnected.bind(this),
      this.handleConnectionError.bind(this),
      this.handleReconnecting.bind(this)
    );

    // Register message handlers
    this.registerMessageHandlers();

    // Connect to server
    this.connect();
  }

  /**
   * Registers all message handlers with the message router
   */
  private registerMessageHandlers(): void {
    const handlers = [
      new WelcomeHandler(),
      new RemotePlayerUpdateHandler(),
      new PlayerJoinedHandler(),
      new PlayerLeftHandler()
    ];

    // Aggiungi handlers NPC se il sistema è disponibile
    if (this.remoteNpcSystem) {
      handlers.push(
        new InitialNpcsHandler(),
        new NpcJoinedHandler(),
        new NpcBulkUpdateHandler(),
        new NpcLeftHandler()
      );
      console.log('🎮 [CLIENT] NPC handlers registered');
    }

    // Aggiungi handlers di combattimento se il sistema è disponibile
    if (this.remoteProjectileSystem) {
      handlers.push(
        new ProjectileFiredHandler(),
        new ProjectileUpdateHandler(),
        new ProjectileDestroyedHandler(),
        new EntityDamagedHandler(),
        new EntityDestroyedHandler()
      );
      console.log('⚔️ [CLIENT] Combat handlers registered');
    }

    this.messageRouter.registerHandlers(handlers);
  }

  /**
   * Handles successful connection establishment
   */
  private async handleConnected(socket: WebSocket): Promise<void> {
    this.socket = socket;

    // Reset tick manager timing on (re)connection
    this.tickManager.reset();

    // Notify external systems of successful (re)connection
    if (this.onReconnectedCallback) {
      this.onReconnectedCallback();
    }

    // Send join message with player info
    const currentPosition = this.getLocalPlayerPosition();
    this.sendMessage({
      type: MESSAGE_TYPES.JOIN,
      clientId: this.clientId,
      nickname: this.playerNickname,
      playerId: this.playerId,
      userId: this.gameContext.localClientId,
      position: currentPosition
    });
  }

  /**
   * Handles incoming messages from the connection manager
   */
  private handleMessage(data: string): void {
    try {
      const message: NetMessage = JSON.parse(data);

      // Handle simple messages that don't need dedicated handlers
      switch (message.type) {
        case MESSAGE_TYPES.POSITION_ACK:
          // Position acknowledgment - no action needed
          break;

        case MESSAGE_TYPES.HEARTBEAT_ACK:
          // Heartbeat acknowledgment - connection is alive
          break;

        case MESSAGE_TYPES.WORLD_UPDATE:
          // World update - could be handled by dedicated system in future
          break;

        case MESSAGE_TYPES.ERROR:
          console.error('🚨 Server error:', (message as any).message);
          break;

        default:
          // Route to appropriate handler
          this.messageRouter.route(message, this);
          break;
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  /**
   * Handles disconnection events
   */
  private handleDisconnected(): void {
    console.log('❌ Disconnected from server');
    this.socket = null;

    // Notify external systems
    if (this.onDisconnectedCallback) {
      this.onDisconnectedCallback();
    }

    // Additional cleanup if needed
  }

  /**
   * Handles connection errors
   */
  private handleConnectionError(error: Event): void {
    console.error('🔌 Connection error:', error);

    // Notify external systems
    if (this.onConnectionErrorCallback) {
      this.onConnectionErrorCallback(error);
    }
  }

  /**
   * Handles reconnection attempts
   */
  private handleReconnecting(): void {
    console.log('🔄 Attempting to reconnect...');

    // Notify external systems
    if (this.onReconnectingCallback) {
      this.onReconnectingCallback();
    }
  }

  /**
   * Imposta informazioni aggiuntive del player
   */
  setPlayerInfo(nickname?: string, playerId?: number): void {
    this.playerNickname = nickname || 'Player';
    this.playerId = playerId;
  }

  /**
   * Registers callback for disconnection events
   * Allows other systems (UI, ECS) to react to disconnections
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
   * Connects to the server using the connection manager
   */
  async connect(): Promise<void> {
    try {
      this.socket = await this.connectionManager.connect();
    } catch (error) {
      console.error('Failed to establish connection:', error);
      throw error;
    }
  }


  /**
   * Updates the network system with detailed logging
   */
  update(deltaTime: number): void {
    if (!this.connectionManager.isConnectionActive()) {
      // Log disconnessione ogni 5 secondi per evitare spam
      if (Math.floor(Date.now() / 5000) % 2 === 0 && !this.lastConnectionLog || Date.now() - this.lastConnectionLog > 5000) {
        console.log(`[NETWORK] Not connected. Connection state: ${this.connectionManager.getConnectionState()}`);
        this.lastConnectionLog = Date.now();
      }
      return;
    }

    // Buffer current position for potential batching
    const currentPosition = this.positionTracker.getLocalPlayerPosition();
    this.tickManager.bufferPositionUpdate(currentPosition);

    // Delegate periodic operations to tick manager
    this.tickManager.update(deltaTime);

    // Log dettagliato dello stato ogni 10 secondi
    if (Math.floor(Date.now() / 10000) % 2 === 0 && !this.lastStatusLog || Date.now() - this.lastStatusLog > 10000) {
      const stats = this.tickManager.getTimingStats();
      const connStats = this.connectionManager.getStats();
      console.log(`[NETWORK] Status - Buffer: ${stats.bufferSize}/${stats.bufferDrops} drops, Connected: ${connStats.isConnected}, State: ${connStats.state}`);
      this.lastStatusLog = Date.now();
    }
  }

  private lastConnectionLog = 0;
  private lastStatusLog = 0;

  /**
   * Sends heartbeat to keep connection alive
   */
  private sendHeartbeat(): void {
    if (!this.socket) return;

    this.sendMessage({
      type: MESSAGE_TYPES.HEARTBEAT,
      clientId: this.clientId,
      timestamp: Date.now()
    });
  }

  /**
   * Gets the current local player position using the position tracker
   */
  private getLocalPlayerPosition(): { x: number; y: number; rotation: number } {
    return this.positionTracker.getLocalPlayerPosition();
  }




  /**
   * Synchronizes the player position to the server (called by tick manager)
   */
  private sendPlayerPosition(position: { x: number; y: number; rotation: number }): void {
    if (!this.socket) return;

      this.sendMessage({
        type: MESSAGE_TYPES.POSITION_UPDATE,
        clientId: this.clientId,
        position: { x: position.x, y: position.y },
        rotation: position.rotation,
        tick: this.tickManager.getTickCounter()
      });
  }


  /**
   * Sends a message to the server
   */
  private sendMessage(message: NetMessage): void {
    this.connectionManager.send(JSON.stringify(message));
  }

  /**
   * Checks if connected
   */
  isConnected(): boolean {
    return this.connectionManager.isConnectionActive();
  }

  /**
   * Gets the RemoteNpcSystem instance
   */
  getRemoteNpcSystem(): RemoteNpcSystem | null {
    return this.remoteNpcSystem;
  }

  /**
   * Gets the RemoteProjectileSystem instance
   */
  getRemoteProjectileSystem(): RemoteProjectileSystem | null {
    return this.remoteProjectileSystem;
  }

  /**
   * Sends notification of a fired projectile to the server
   */
  sendProjectileFired(data: {
    projectileId: string;
    playerId: string;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    damage: number;
    projectileType: 'laser' | 'plasma' | 'missile';
  }): void {
    if (!this.socket || !this.isConnected) {
      console.warn('[CLIENT] Cannot send projectile fired: not connected');
      return;
    }

    const message = {
      type: MESSAGE_TYPES.PROJECTILE_FIRED,
      projectileId: data.projectileId,
      playerId: data.playerId,
      position: data.position,
      velocity: data.velocity,
      damage: data.damage,
      projectileType: data.projectileType
    };

    this.sendMessage(message);
  }

  /**
   * Gets the local client ID
   */
  getLocalClientId(): string {
    return this.clientId;
  }

  /**
   * Disconnects from the server
   */
  disconnect(): void {
    this.connectionManager.disconnect();
    this.socket = null;
  }
}
