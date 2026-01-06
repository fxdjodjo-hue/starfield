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
import { PlayerRespawnHandler } from './handlers/PlayerRespawnHandler';
// NPC handlers
import { InitialNpcsHandler } from './handlers/InitialNpcsHandler';
import { NpcJoinedHandler } from './handlers/NpcJoinedHandler';
import { NpcSpawnHandler } from './handlers/NpcSpawnHandler';
import { NpcBulkUpdateHandler } from './handlers/NpcBulkUpdateHandler';
import { NpcLeftHandler } from './handlers/NpcLeftHandler';
// Combat handlers
import { CombatUpdateHandler } from './handlers/CombatUpdateHandler';
import { ProjectileFiredHandler } from './handlers/ProjectileFiredHandler';
import { ProjectileUpdateHandler } from './handlers/ProjectileUpdateHandler';
import { ProjectileDestroyedHandler } from './handlers/ProjectileDestroyedHandler';
import { EntityDamagedHandler } from './handlers/EntityDamagedHandler';
import { EntityDestroyedHandler } from './handlers/EntityDestroyedHandler';
import { ExplosionCreatedHandler } from './handlers/ExplosionCreatedHandler';
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
  private audioSystem: any = null;

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
  private readonly remotePlayerSystem: RemotePlayerSystem;
  private remoteNpcSystem: RemoteNpcSystem | null = null;
  private remoteProjectileSystem: RemoteProjectileSystem | null = null;

  // Error handling callbacks
  private onDisconnectedCallback?: () => void;
  private onConnectionErrorCallback?: (error: Event) => void;
  private onReconnectingCallback?: () => void;
  private onReconnectedCallback?: () => void;

  constructor(ecs: ECS, gameContext: GameContext, remotePlayerSystem: RemotePlayerSystem, serverUrl: string = NETWORK_CONFIG.DEFAULT_SERVER_URL, remoteNpcSystem?: RemoteNpcSystem, remoteProjectileSystem?: RemoteProjectileSystem, audioSystem?: any) {
    super(ecs);
    this.gameContext = gameContext;
    this.audioSystem = audioSystem || null;
    this.remotePlayerSystem = remotePlayerSystem;
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
   * Get the RemotePlayerSystem reference
   */
  public getRemotePlayerSystem(): RemotePlayerSystem {
    return this.remotePlayerSystem;
  }

  /**
   * Registers all message handlers with the message router
   */
  private registerMessageHandlers(): void {
    const handlers = [
      new WelcomeHandler(),
      new RemotePlayerUpdateHandler(),
      new PlayerJoinedHandler(),
      new PlayerLeftHandler(),
      new PlayerRespawnHandler()
    ];

    // Aggiungi handlers NPC se il sistema è disponibile
    if (this.remoteNpcSystem) {
      handlers.push(
        new InitialNpcsHandler(),
        new NpcJoinedHandler(),
        new NpcSpawnHandler(),
        new NpcBulkUpdateHandler(),
        new NpcLeftHandler()
      );
    }

    // Aggiungi handlers di combattimento se il sistema è disponibile
    if (this.remoteProjectileSystem) {
      handlers.push(
        new CombatUpdateHandler(),
        new ProjectileFiredHandler(),
        new ProjectileUpdateHandler(),
        new ProjectileDestroyedHandler(),
        new EntityDamagedHandler(),
        new EntityDestroyedHandler(),
        new ExplosionCreatedHandler()
      );
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
          // console.error('🚨 Server error:', (message as any).message);
          break;

        default:
          // Route to appropriate handler
          this.messageRouter.route(message, this);
          break;
      }
    } catch (error) {
    }
  }

  /**
   * Handles disconnection events
   */
  private handleDisconnected(): void {
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

    // Notify external systems
    if (this.onConnectionErrorCallback) {
      this.onConnectionErrorCallback(error);
    }
  }

  /**
   * Handles reconnection attempts
   */
  private handleReconnecting(): void {

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
        this.lastConnectionLog = Date.now();
      }
      return;
    }

    // Buffer current position for potential batching
    const currentPosition = this.positionTracker.getLocalPlayerPosition();
    this.tickManager.bufferPositionUpdate(currentPosition);

    // Delegate periodic operations to tick manager
    this.tickManager.update(deltaTime);

    // Log dettagliato dello stato ogni 60 secondi (solo se ci sono problemi)
    const now = Date.now();
    if (!this.lastStatusLog || now - this.lastStatusLog > 60000) {
      const stats = this.tickManager.getTimingStats();
      const connStats = this.connectionManager.getStats();
      // Log solo se ci sono problemi (drops > 0 o non connesso)
      if (stats.bufferDrops > 0 || !connStats.isConnected) {
      }
      this.lastStatusLog = now;
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
   * Sets the RemoteNpcSystem instance
   */
  setRemoteNpcSystem(remoteNpcSystem: RemoteNpcSystem): void {
    this.remoteNpcSystem = remoteNpcSystem;
  }

  /**
   * Sets the RemoteProjectileSystem instance
   */
  setRemoteProjectileSystem(remoteProjectileSystem: RemoteProjectileSystem): void {
    this.remoteProjectileSystem = remoteProjectileSystem;
  }

  /**
   * Gets the EntityDestroyedHandler instance
   */
  getEntityDestroyedHandler(): any {
    // Trova l'handler EntityDestroyedHandler tra quelli registrati
    if (this.messageRouter) {
      const handlers = (this.messageRouter as any).handlers || [];
      return handlers.find((handler: any) => handler.constructor.name === 'EntityDestroyedHandler') || null;
    }
    return null;
  }

  /**
   * Gets the RemoteProjectileSystem instance
   */
  getRemoteProjectileSystem(): RemoteProjectileSystem | null {
    return this.remoteProjectileSystem;
  }

  /**
   * Gets the ECS instance
   */
  getECS(): ECS | null {
    return this.ecs;
  }

  /**
   * Sends notification of explosion created to the server
   */
  sendExplosionCreated(data: {
    explosionId: string;
    entityId: string;
    entityType: 'player' | 'npc';
    position: { x: number; y: number };
    explosionType: 'entity_death' | 'projectile_impact' | 'special';
  }): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    const message = {
      type: MESSAGE_TYPES.EXPLOSION_CREATED,
      explosionId: data.explosionId,
      entityId: data.entityId,
      entityType: data.entityType,
      position: data.position,
      explosionType: data.explosionType
    };

    this.sendMessage(message);
  }

  /**
   * Creates a remote explosion for synchronized visual effects
   */
  async createRemoteExplosion(message: {
    explosionId: string;
    entityId: string;
    entityType: 'player' | 'npc';
    position: { x: number; y: number };
    explosionType: 'entity_death' | 'projectile_impact' | 'special';
  }): Promise<void> {

    try {
      if (!this.ecs) {
        return;
      }

      // Crea entità temporanea per l'esplosione
      const explosionEntity = this.ecs.createEntity();

      // Usa i frame cachati o caricali
      let explosionFrames = this.explosionFramesCache;
      if (!explosionFrames) {
        explosionFrames = await this.loadExplosionFrames();
        this.explosionFramesCache = explosionFrames;
      }

      // Import componenti
      const { Explosion } = await import('../../entities/combat/Explosion');
      const { Transform } = await import('../../entities/spatial/Transform');

      // Crea componenti
      const transform = new Transform(message.position.x, message.position.y, 0);
      const explosion = new Explosion(explosionFrames, 80); // 80ms per frame

      // Aggiungi componenti all'entità
      this.ecs.addComponent(explosionEntity, Transform, transform);
      this.ecs.addComponent(explosionEntity, Explosion, explosion);

      // Riproduci suono esplosione sincronizzato su tutti i client
      if (this.audioSystem) {
        this.audioSystem.playSound('explosion', 0.1, false, true); // Volume più basso per equilibrio sonoro
      }

      // L'ExplosionSystem esistente gestirà automaticamente questa entità
      // perché cerca tutte le entità con componente Explosion

    } catch (error) {
    }
  }

  /**
   * Cache per i frame delle esplosioni
   */
  private explosionFramesCache: HTMLImageElement[] | null = null;

  /**
   * Carica i frame dell'esplosione (cache per performance)
   */
  private async loadExplosionFrames(): Promise<HTMLImageElement[]> {
    if (this.explosionFramesCache) {
      return this.explosionFramesCache;
    }

    const frames: HTMLImageElement[] = [];
    const basePath = '/assets/explosions/explosions_npc/Explosion_blue_oval/Explosion_blue_oval';

    // Carica i 10 frame disponibili
    for (let i = 1; i <= 10; i++) {
      const framePath = `${basePath}${i}.png`;
      try {
        // Usa il sistema di asset loading del context se disponibile
        if (this.gameContext?.assetManager) {
          const img = await this.gameContext.assetManager.loadImage(framePath);
          frames.push(img);
        } else {
          // Fallback: carica direttamente
          const img = new Image();
          img.src = framePath;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          frames.push(img);
        }
      } catch (error) {
        // Continua senza questo frame invece di fallire completamente
      }
    }

    // Se non abbiamo caricato nessun frame, restituisci un array vuoto
    // Le esplosioni non verranno mostrate ma il gioco continuerà
    this.explosionFramesCache = frames;
    return frames;
  }

  /**
   * Sends request to start combat against an NPC
   */
  sendStartCombat(data: {
    npcId: string;
    playerId: string;
  }): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    const message = {
      type: MESSAGE_TYPES.START_COMBAT,
      npcId: data.npcId,
      playerId: data.playerId
    };

    this.sendMessage(message);
  }

  /**
   * Sends request to stop combat
   */
  sendStopCombat(data: {
    playerId: string;
  }): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    const message = {
      type: MESSAGE_TYPES.STOP_COMBAT,
      playerId: data.playerId
    };

    this.sendMessage(message);
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
    projectileType: string;
  }): void {
    if (!this.socket || !this.isConnected) {
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
   * Gets the audio system for playing sounds
   */
  getAudioSystem(): any {
    return this.audioSystem || this.gameContext?.audioSystem || null;
  }

  /**
   * Disconnects from the server
   */
  disconnect(): void {
    this.connectionManager.disconnect();
    this.socket = null;
  }
}
