import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { RemotePlayerSystem } from '../../systems/multiplayer/RemotePlayerSystem';
import { PlayerSystem } from '../../systems/player/PlayerSystem';
import { RemoteNpcSystem } from '../../systems/multiplayer/RemoteNpcSystem';
import { RemoteProjectileSystem } from '../../systems/multiplayer/RemoteProjectileSystem';
import { Projectile } from '../../entities/combat/Projectile';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';

// Nuovi sistemi specializzati
import { ExplosionSystem } from '../../systems/client/ExplosionSystem';
import { AudioNotificationSystem } from '../../systems/client/AudioNotificationSystem';
import { UINotificationSystem } from '../../systems/client/UINotificationSystem';

// Refactored components - Separation of Concerns
import { NetworkConnectionManager } from './managers/NetworkConnectionManager';
import { NetworkEventSystem } from './managers/NetworkEventSystem';
import { RemoteEntityManager } from './managers/RemoteEntityManager';
import { RateLimiter, RATE_LIMITS } from './managers/RateLimiter';

// New modular components
import { MessageRouter } from './handlers/MessageRouter';
import { WelcomeHandler } from './handlers/WelcomeHandler';
import { RemotePlayerUpdateHandler } from './handlers/RemotePlayerUpdateHandler';
import { PlayerJoinedHandler } from './handlers/PlayerJoinedHandler';
import { PlayerLeftHandler } from './handlers/PlayerLeftHandler';
import { PlayerRespawnHandler } from './handlers/PlayerRespawnHandler';
import { PlayerStateUpdateHandler } from './handlers/PlayerStateUpdateHandler';
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
import { StopCombatHandler } from './handlers/StopCombatHandler';
import { RemotePlayerManager } from './managers/RemotePlayerManager';
import { PlayerPositionTracker } from './managers/PlayerPositionTracker';
import { ConnectionManager } from './managers/ConnectionManager';
import { NetworkTickManager } from './managers/NetworkTickManager';

// Types and Configuration
import type { NetMessage } from './types/MessageTypes';
import { NETWORK_CONFIG, MESSAGE_TYPES } from '../../config/NetworkConfig';

// Supabase client for JWT token
import { supabase } from '../../lib/supabase';

/**
 * Sistema di rete client modulare per multiplayer
 * Utilizza architettura a componenti per gestire connessioni, messaggi e giocatori remoti
 */
export class ClientNetworkSystem extends BaseSystem {
  // Core dependencies
  public readonly gameContext: GameContext;
  public readonly clientId: string;
  private audioSystem: any = null;
  private logSystem: any = null;
  private uiSystem: any = null;
  private economySystem: any = null;
  private rewardSystem: any = null;

  // REFACTORED: Modular architecture with separated concerns
  private readonly connectionManager: NetworkConnectionManager;
  private readonly eventSystem: NetworkEventSystem;
  private readonly entityManager: RemoteEntityManager;
  private readonly tickManager: NetworkTickManager;
  private readonly positionTracker: PlayerPositionTracker;
  private readonly rateLimiter: RateLimiter;

  // Legacy components (to be phased out)
  public readonly remotePlayerManager: RemotePlayerManager; // TODO: Deprecate
  private readonly messageRouter: MessageRouter; // TODO: Move to connectionManager

  // ECS reference
  private ecs: ECS | null = null;

  // Player info
  private playerId?: number;

  // Callbacks for external systems
  private onPlayerIdReceived?: (playerId: number) => void;

  // Position sync state
  private lastSentPosition: { x: number; y: number } | null = null;
  private lastInvalidPositionLog = 0;
  private hasReceivedWelcome = false;
  private pendingPosition: { x: number; y: number; rotation: number } | null = null;

  // Error handling callbacks
  private onDisconnectedCallback?: () => void;
  private onConnectionErrorCallback?: (error: Event) => void;
  private onReconnectingCallback?: () => void;
  private onReconnectedCallback?: () => void;
  private onConnectedCallback?: () => void;

  // Initialization state management
  private initializationPromise: Promise<void> | null = null;
  private initializationResolver: (() => void) | null = null;
  private isInitialized = false;

  constructor(ecs: ECS, gameContext: GameContext, remotePlayerSystem: RemotePlayerSystem, serverUrl: string = NETWORK_CONFIG.DEFAULT_SERVER_URL, remoteNpcSystem?: RemoteNpcSystem, remoteProjectileSystem?: RemoteProjectileSystem, audioSystem?: any) {
    super(ecs);
    this.gameContext = gameContext;
    this.audioSystem = audioSystem || null;
    this.remotePlayerSystem = remotePlayerSystem;
    this.remoteNpcSystem = remoteNpcSystem || null;
    this.remoteProjectileSystem = remoteProjectileSystem || null;

    // Generate unique client ID
    this.clientId = 'client_' + Math.random().toString(36).substr(2, 9);

    // REFACTORED: Initialize modular architecture
    this.connectionManager = new NetworkConnectionManager(
      serverUrl,
      this.handleConnected.bind(this),
      this.handleMessage.bind(this),
      this.handleDisconnected.bind(this),
      this.handleConnectionError.bind(this),
      this.handleReconnecting.bind(this)
    );

    this.eventSystem = new NetworkEventSystem(ecs, gameContext);
    this.entityManager = new RemoteEntityManager(ecs, remotePlayerSystem);
    this.positionTracker = new PlayerPositionTracker(ecs);
    this.rateLimiter = new RateLimiter();

    // Initialize network tick manager
    this.tickManager = new NetworkTickManager(
      this.sendHeartbeat.bind(this),
      this.sendPlayerPosition.bind(this)
    );

    // LEGACY: Initialize old components for backward compatibility (TODO: Remove)
    this.messageRouter = new MessageRouter();
    this.remotePlayerManager = new RemotePlayerManager(ecs, remotePlayerSystem);

    // Register message handlers
    this.registerMessageHandlers();

    // Don't connect automatically - will be called manually after systems are set up
  }

  /**
   * Get the RemotePlayerSystem reference
   */
  public getRemotePlayerSystem(): RemotePlayerSystem {
    return this.remotePlayerSystem;
  }

  /**
   * Set the PlayerSystem reference
   */
  public setPlayerSystem(playerSystem: PlayerSystem): void {
    this.playerSystem = playerSystem;
  }

  /**
   * Get the PlayerSystem reference
   */
  public getPlayerSystem(): PlayerSystem | null {
    return this.playerSystem;
  }

  /**
   * Welcome state management
   */
  public setHasReceivedWelcome(received: boolean): void {
    this.hasReceivedWelcome = received;
  }

  public getPendingPosition(): { x: number; y: number; rotation: number } | null {
    return this.pendingPosition;
  }

  public clearPendingPosition(): void {
    this.pendingPosition = null;
  }

  public setCurrentCombatNpcId(npcId: string | null): void {
    this.currentCombatNpcId = npcId;
  }

  public getCurrentCombatNpcId(): string | null {
    return this.currentCombatNpcId;
  }

  public invalidatePositionCache(): void {
    this.positionTracker.invalidateCache();
  }

  public getHasReceivedWelcome(): boolean {
    return this.hasReceivedWelcome;
  }

  /**
   * Registers all message handlers with the message router
   */
  private registerMessageHandlers(): void {
    // Crea lista base di handler sempre presenti
    const handlers = [
      new WelcomeHandler(),
      new RemotePlayerUpdateHandler(),
      new PlayerJoinedHandler(),
      new PlayerLeftHandler(),
      new PlayerRespawnHandler(),
      new PlayerStateUpdateHandler()
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
        new StopCombatHandler(),
        new ProjectileFiredHandler(),
        new ProjectileUpdateHandler(),
        new ProjectileDestroyedHandler(),
        new EntityDamagedHandler(),
        new EntityDestroyedHandler(),
        new ExplosionCreatedHandler()
      );
    }

    // Registra tutti gli handler (questo sovrascrive quelli precedenti)
    this.messageRouter.registerHandlers(handlers);
  }

  /**
   * Handles successful connection establishment
   */
  private async handleConnected(socket: WebSocket): Promise<void> {
    console.log('🔌 [CLIENT] WebSocket connected successfully!');
    this.socket = socket;

    // Reset tick manager timing on (re)connection
    this.tickManager.reset();

    // Notify external systems of successful (re)connection
    if (this.onReconnectedCallback) {
      this.onReconnectedCallback();
    }

    // Notify external systems of successful connection
    if (this.onConnectedCallback) {
      this.onConnectedCallback();
    }

    // 🔴 CRITICAL SECURITY: Verifica che abbiamo sia una sessione valida che un token JWT
    if (!this.gameContext.localClientId || this.gameContext.localClientId.startsWith('client_')) {
      console.error('❌ [CLIENT] Tentativo di connessione senza sessione valida - rilogin necessario');
      // Disconnetti e forza rilogin
      this.connectionManager.disconnect();
      // Ricarica la pagina per tornare alla schermata di auth
      window.location.reload();
      return;
    }

    // 🔴 CRITICAL SECURITY: Ottieni il JWT token corrente da Supabase
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) {
      console.error('❌ [CLIENT] No valid JWT token available - rilogin necessario');
      this.connectionManager.disconnect();
      window.location.reload();
      return;
    }

    // Invalidate position tracker cache on connection (player might have moved)
    this.positionTracker.invalidateCache();

    // Send SECURE join message with JWT token
    const currentPosition = this.getLocalPlayerPosition();
    const nicknameToSend = this.gameContext.playerNickname || 'Player';

    console.log('🔐 [CLIENT] Sending SECURE join message with JWT token');

    this.sendMessage({
      type: MESSAGE_TYPES.JOIN,
      clientId: this.clientId,
      nickname: nicknameToSend,
      // 🔴 CRITICAL SECURITY: Include JWT token for server-side validation
      authToken: session.access_token,
      // playerId sarà assegnato dal server nel welcome message
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

      if (message.type === 'initial_npcs') {
      }

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

        case 'projectile_updates':
          this.handleProjectileUpdates(message as any);
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
   * Handles projectile position updates from server (for homing projectiles)
   */
  private handleProjectileUpdates(message: any): void {
    if (!message.projectiles || !Array.isArray(message.projectiles)) return;

    for (const projectileUpdate of message.projectiles) {
      // Trova il proiettile nell'ECS
      const projectileEntity = this.ecs.getEntitiesWithComponents(Projectile)
        .find(entity => {
          const projectile = this.ecs.getComponent(entity, Projectile);
          return projectile && projectile.id === projectileUpdate.id;
        });

      if (projectileEntity) {
        // Aggiorna posizione e velocità del proiettile
        const transform = this.ecs.getComponent(projectileEntity, Transform);
        const velocity = this.ecs.getComponent(projectileEntity, Velocity);

        if (transform && projectileUpdate.position) {
          transform.x = projectileUpdate.position.x;
          transform.y = projectileUpdate.position.y;
        }

        if (velocity && projectileUpdate.velocity) {
          velocity.x = projectileUpdate.velocity.x;
          velocity.y = projectileUpdate.velocity.y;
        }
      }
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
   * Registers callback for successful connection events
   */
  onConnected(callback: () => void): void {
    this.onConnectedCallback = callback;
  }

  /**
   * Connects to the server using the connection manager
   */
  async connect(): Promise<void> {
    try {
      this.socket = await this.connectionManager.connect();
    } catch (error) {
      console.error(`🔌 [CLIENT] Socket connection failed:`, error);
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
    if (!this.connectionManager.isConnectionActive()) return;

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
   * Gets the current local player position using the position tracker
   */
  private getLocalPlayerPosition(): { x: number; y: number; rotation: number } {
    return this.positionTracker.getLocalPlayerPosition();
  }




  /**
   * Synchronizes the player position to the server (called by tick manager)
   */
  private sendPlayerPosition(position: { x: number; y: number; rotation: number }): void {
    if (!this.connectionManager.isConnectionActive()) return;

    // IMPORTANTE: Non mandare position updates finché il server non ha confermato il join
    if (!this.hasReceivedWelcome) {
      // Accumula la posizione per quando il server sarà pronto
      this.pendingPosition = position;
      return;
    }

    // RATE LIMITING: Controlla se possiamo inviare aggiornamenti posizione
    if (!this.rateLimiter.canSend('position_update', RATE_LIMITS.POSITION_UPDATE.maxRequests, RATE_LIMITS.POSITION_UPDATE.windowMs)) {
      // Rate limit superato - salta questo aggiornamento per ridurre carico server
      return;
    }

    // CLIENT VALIDATION: usa fallback per dati invalidi
    if (!this.isValidPosition(position)) {
      if (Date.now() - this.lastInvalidPositionLog > 10000) {
        console.warn('[CLIENT] Invalid position data, using fallback:', position);
        this.lastInvalidPositionLog = Date.now();
      }
      // Usa posizione di fallback invece di scartare
      position = { x: 0, y: 0, rotation: 0 };
    }

    this.connectionManager.send(JSON.stringify({
      type: MESSAGE_TYPES.POSITION_UPDATE,
      clientId: this.clientId,
      x: position.x,
      y: position.y,
      rotation: position.rotation,
      tick: this.tickManager.getTickCounter()
    }));
  }

  /**
   * Valida che la posizione sia valida prima dell'invio
   */
  private isValidPosition(pos: { x: number; y: number; rotation: number }): boolean {
    // Normalizza la rotation per accettare valori non normalizzati
    let normalizedRotation = pos.rotation;
    while (normalizedRotation > Math.PI) normalizedRotation -= 2 * Math.PI;
    while (normalizedRotation < -Math.PI) normalizedRotation += 2 * Math.PI;

    return Number.isFinite(pos.x) &&
           Number.isFinite(pos.y) &&
           Number.isFinite(pos.rotation) &&
           pos.x >= -50000 && pos.x <= 50000 &&
           pos.y >= -50000 && pos.y <= 50000 &&
           normalizedRotation >= -Math.PI && normalizedRotation <= Math.PI;
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
    this.entityManager.setRemoteSystems(remoteNpcSystem, this.remoteProjectileSystem || undefined);

    // LEGACY: Update old reference for backward compatibility
    this.remoteNpcSystem = remoteNpcSystem;

    // Ri-registra gli handler per includere quelli NPC ora che il sistema è disponibile
    if (remoteNpcSystem) {
      this.registerMessageHandlers();
    }
  }

  /**
   * Sets the RemoteProjectileSystem instance
   */
  setRemoteProjectileSystem(remoteProjectileSystem: RemoteProjectileSystem): void {
    this.entityManager.setRemoteSystems(this.remoteNpcSystem || undefined, remoteProjectileSystem);

    // LEGACY: Update old reference for backward compatibility
    this.remoteProjectileSystem = remoteProjectileSystem;

    // Ri-registra gli handler per includere quelli di combattimento ora che il sistema è disponibile
    if (remoteProjectileSystem) {
      this.registerMessageHandlers();
    }
  }

  /**
   * Sets the ECS reference for combat management
   */
  setEcs(ecs: ECS): void {
    this.ecs = ecs;
  }

  /**
   * Stops combat when server sends stop_combat message
   */
  stopCombat(): void {
    if (!this.ecs) {
      console.warn(`⚠️ [CLIENT] ECS not available in ClientNetworkSystem.stopCombat()`);
      return;
    }

    // Find the CombatSystem and stop combat immediately
    const combatSystem = this.ecs.systems?.find((system: any) =>
      typeof system.stopCombatImmediately === 'function'
    );

    if (combatSystem) {
      combatSystem.stopCombatImmediately();

      // Also deactivate attack in PlayerControlSystem to prevent auto-attack on next NPC click
      const playerControlSystem = this.ecs.systems?.find((system: any) =>
        typeof system.deactivateAttack === 'function'
      );

      if (playerControlSystem) {
        playerControlSystem.deactivateAttack();
      }
    } else {
      console.warn(`⚠️ [CLIENT] CombatSystem not found, cannot stop combat`);
    }
  }

  /**
   * Manually connect to the server (called after systems are set up)
   */
  async connectToServer(): Promise<void> {
    try {
      await this.connect();
    } catch (error) {
      console.error(`❌ [CLIENT] Connection failed:`, error);
    }
  }

  /**
   * Gets the EntityDestroyedHandler instance
   */
  getEntityDestroyedHandler(): any {
    // Trova l'handler EntityDestroyedHandler tra quelli registrati (robusto contro minificazione)
    if (this.messageRouter) {
      const handlers = (this.messageRouter as any).handlers || [];
      return handlers.find((handler: any) => typeof handler.setRewardSystem === 'function') || null;
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
    if (!this.connectionManager.isConnectionActive()) {
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

    this.connectionManager.send(JSON.stringify(message));
  }

  /**
   * Creates a remote explosion for synchronized visual effects
   * Delegates to the NetworkEventSystem
   */
  async createRemoteExplosion(message: {
    explosionId: string;
    entityId: string;
    entityType: 'player' | 'npc';
    position: { x: number; y: number };
    explosionType: 'entity_death' | 'projectile_impact' | 'special';
  }): Promise<void> {
    await this.eventSystem.createRemoteExplosion(message);
  }

  /**
   * Imposta i frame dell'esplosione precaricati per evitare lag
   * Delega al ExplosionSystem
   */
  setPreloadedExplosionFrames(frames: HTMLImageElement[]): void {
    this.explosionSystem.setPreloadedExplosionFrames(frames);
  }


  /**
   * Sends request to start combat against an NPC
   */
  sendStartCombat(data: {
    npcId: string;
    playerId: string;
  }): void {
    if (!this.connectionManager.isConnectionActive()) {
      return;
    }

    // RATE LIMITING: Controlla se possiamo inviare azioni di combattimento
    if (!this.rateLimiter.canSend('combat_action', RATE_LIMITS.COMBAT_ACTION.maxRequests, RATE_LIMITS.COMBAT_ACTION.windowMs)) {
      console.warn('⚔️ [COMBAT] Rate limit exceeded - combat action blocked');
      return;
    }

    // Salva l'NPC corrente per stop_combat
    this.entityManager.setCurrentCombatNpcId(data.npcId);

    const message = {
      type: MESSAGE_TYPES.START_COMBAT,
      npcId: data.npcId,
      playerId: data.playerId
    };

    this.connectionManager.send(JSON.stringify(message));
  }

  /**
   * Sends request to stop combat
   */
  sendStopCombat(data: {
    playerId: string;
    npcId?: string;
  }): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    const message = {
      type: MESSAGE_TYPES.STOP_COMBAT,
      playerId: data.playerId,
      npcId: data.npcId || this.getCurrentCombatNpcId() || 'unknown'
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
    // damage rimosso: calcolato dal server (Server Authoritative)
    projectileType: string;
  }): void {
    if (!this.connectionManager.isConnectionActive()) {
      return;
    }

    // RATE LIMITING: Controlla se possiamo inviare azioni di combattimento
    if (!this.rateLimiter.canSend('combat_action', RATE_LIMITS.COMBAT_ACTION.maxRequests, RATE_LIMITS.COMBAT_ACTION.windowMs)) {
      console.warn('🚀 [PROJECTILE] Rate limit exceeded - projectile blocked');
      return;
    }

    const message = {
      type: MESSAGE_TYPES.PROJECTILE_FIRED,
      projectileId: data.projectileId,
      playerId: data.playerId,
      position: data.position,
      velocity: data.velocity,
      // damage rimosso: sarà calcolato dal server (Server Authoritative)
      projectileType: data.projectileType
    };

    this.connectionManager.send(JSON.stringify(message));
  }

  /**
   * Invia gli upgrade del player al server (Server Authoritative)
   */
  sendPlayerUpgrades(upgrades: {
    hpUpgrades: number;
    shieldUpgrades: number;
    speedUpgrades: number;
    damageUpgrades: number;
  }): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    const localClientId = this.getLocalClientId();

    const message = {
      type: 'player_upgrades_update',
      playerId: localClientId,
      upgrades: upgrades
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
   * Requests a skill upgrade to the server (Server Authoritative)
   */
  requestSkillUpgrade(upgradeType: 'hp' | 'shield' | 'speed' | 'damage'): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    const localClientId = this.getLocalClientId();
    console.log('🔧 [CLIENT] Requesting skill upgrade:', upgradeType, 'for player:', localClientId);

    const message = {
      type: 'skill_upgrade_request',
      playerId: localClientId,
      upgradeType: upgradeType
    };

    console.log('✅ [CLIENT] Sending skill upgrade request to server:', message);
    this.sendMessage(message);
  }

  /**
   * Sends a chat message to the server
   */
  sendChatMessage(content: string): void {
    if (!this.connectionManager.isConnectionActive() || !this.clientId) {
      console.warn('💬 [CHAT] Cannot send message: not connected');
      return;
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      console.warn('💬 [CHAT] Cannot send empty message');
      return;
    }

    // RATE LIMITING: Controlla se possiamo inviare messaggi chat
    if (!this.rateLimiter.canSend('chat_message', RATE_LIMITS.CHAT_MESSAGE.maxRequests, RATE_LIMITS.CHAT_MESSAGE.windowMs)) {
      console.warn('💬 [CHAT] Rate limit exceeded - please wait before sending another message');
      return;
    }

    const message = {
      type: 'chat_message',
      clientId: this.clientId,
      content: content.trim(),
      timestamp: Date.now()
    };

    if (import.meta.env.DEV) {
      console.log('💬 [CHAT] Sending message to server:', message);
    }

    this.connectionManager.send(JSON.stringify(message));
  }

  /**
   * Sets the AudioSystem instance
   */
  setAudioSystem(audioSystem: any): void {
    this.audioSystem = audioSystem;
    // Propaga riferimento ai sottosistemi
    this.explosionSystem.setAudioSystem(audioSystem);
    this.audioNotificationSystem.setAudioSystem(audioSystem);
  }

  /**
   * Gets the audio system for playing sounds
   */
  getAudioSystem(): any {
    return this.audioSystem || this.gameContext?.audioSystem || null;
  }

  /**
   * Gets the message router for registering handlers
   */
  getMessageRouter(): MessageRouter {
    return this.messageRouter;
  }

  /**
   * Disconnects from the server
   */
  disconnect(): void {
    this.connectionManager.disconnect();
    this.socket = null;
  }

  /**
   * Imposta il riferimento al LogSystem per le notifiche di log
   * Propaga ai sottosistemi
   */
  setLogSystem(logSystem: any): void {
    this.logSystem = logSystem;
    this.uiNotificationSystem.setUISystems(this.uiSystem, logSystem, this.economySystem);
  }

  /**
   * Resets all upgrade progress states in the UI
   */
  resetAllUpgradeProgress(): void {
    const uiSystem = this.uiSystem;
    if (uiSystem && typeof uiSystem.resetAllUpgradeProgress === 'function') {
      uiSystem.resetAllUpgradeProgress();
    }
  }

  /**
   * Ottiene il riferimento al LogSystem
   */
  getLogSystem(): any {
    return this.logSystem;
  }

  /**
   * Imposta il riferimento al UiSystem per aggiornare l'HUD
   * Propaga ai sottosistemi specializzati
   */
  setUiSystem(uiSystem: any): void {
    this.uiSystem = uiSystem;
    this.uiNotificationSystem.setUISystems(uiSystem, this.logSystem, this.economySystem);
  }

  /**
   * Ottiene il riferimento al UiSystem
   */
  getUiSystem(): any {
    return this.uiSystem;
  }

  /**
   * Imposta il riferimento al EconomySystem per aggiornare l'inventario
   */
  setEconomySystem(economySystem: any): void {
    this.economySystem = economySystem;
  }

  /**
   * Ottiene il riferimento al EconomySystem
   */
  getEconomySystem(): any {
    return this.economySystem;
  }

  /**
   * Imposta il riferimento al RewardSystem per assegnare ricompense
   */
  setRewardSystem(rewardSystem: any): void {
    this.rewardSystem = rewardSystem;
  }

  /**
   * Ottiene il riferimento al RewardSystem
   */
  getRewardSystem(): any {
    return this.rewardSystem;
  }

  /**
   * Inizializza il sistema di rete con gestione dello stato di inizializzazione
   * Previene race conditions nei callback
   */
  initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise((resolve) => {
      this.initializationResolver = resolve;
    });

    return this.initializationPromise;
  }

  /**
   * Segna il sistema come inizializzato e risolve eventuali promise in attesa
   */
  markAsInitialized(): void {
    this.isInitialized = true;
    if (this.initializationResolver) {
      this.initializationResolver();
      this.initializationResolver = null;
    }
  }

  /**
   * Verifica se il sistema è completamente inizializzato
   */
  isSystemInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Imposta callback per quando viene ricevuto il player ID
   * Ora sicuro da race conditions grazie al sistema di inizializzazione
   */
  setOnPlayerIdReceived(callback: (playerId: number) => void): void {
    this.onPlayerIdReceived = callback;
  }

  /**
   * Ottiene statistiche del rate limiter per debugging
   */
  getRateLimiterStats() {
    return this.rateLimiter.getStats();
  }
}
