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
import { Authority } from '../../entities/spatial/Authority';

// Nuovi sistemi specializzati
import { RemoteExplosionSystem } from '../../systems/client/RemoteExplosionSystem';
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
import { PlayerDataResponseHandler } from './handlers/PlayerDataResponseHandler';
import { SaveResponseHandler } from './handlers/SaveResponseHandler';
import { RemotePlayerManager } from './managers/RemotePlayerManager';
import { PlayerPositionTracker } from './managers/PlayerPositionTracker';
import { NetworkTickManager } from './managers/NetworkTickManager';

// Types and Configuration
import type { NetMessage } from './types/MessageTypes';
import { NETWORK_CONFIG, MESSAGE_TYPES } from '../../config/NetworkConfig';

// Supabase client for JWT token
import { supabase } from '../../lib/supabase';

// Connection states to prevent race conditions
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

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

  // JWT Authentication retry management
  private jwtRetryCount = 0;
  private maxJwtRetries = 3;
  private jwtRetryDelay = 2000; // Start with 2 seconds
  private jwtRetryTimeout: NodeJS.Timeout | null = null;
  private isRetryingJwt = false;

  // Connection state management to prevent race conditions
  private connectionState = ConnectionState.DISCONNECTED;
  private connectionPromise: Promise<void> | null = null;
  private connectionResolver: (() => void) | null = null;
  private connectionRejector: ((error: Error) => void) | null = null;

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
      new PlayerStateUpdateHandler(),
      new PlayerDataResponseHandler(),
      new SaveResponseHandler()
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
   * Handles JWT authentication errors with retry logic instead of page reload
   */
  private handleJwtAuthenticationError(reason: string): void {
    console.error(`❌ [CLIENT] JWT Authentication failed: ${reason}`);

    if (this.jwtRetryCount >= this.maxJwtRetries) {
      console.error(`🚨 [CLIENT] Max JWT retry attempts (${this.maxJwtRetries}) exceeded`);
      this.showAuthenticationErrorToUser('Sessione scaduta. Ricarica la pagina per accedere nuovamente.');
      return;
    }

    if (this.isRetryingJwt) {
      console.warn('⚠️ [CLIENT] JWT retry already in progress');
      return;
    }

    this.isRetryingJwt = true;
    this.jwtRetryCount++;

    const delay = this.jwtRetryDelay * Math.pow(2, this.jwtRetryCount - 1); // Exponential backoff


    this.showAuthenticationErrorToUser(`Tentativo di riconnessione ${this.jwtRetryCount}/${this.maxJwtRetries}...`);

    this.jwtRetryTimeout = setTimeout(async () => {
      try {
        // Try to refresh the session
        const { data, error } = await supabase.auth.refreshSession();

        if (error) {
          console.error('❌ [CLIENT] Session refresh failed:', error);
          this.isRetryingJwt = false;
          this.handleJwtAuthenticationError('Session refresh failed');
          return;
        }

        if (data.session?.access_token) {
          this.isRetryingJwt = false;
          this.jwtRetryCount = 0; // Reset on success
          // Retry the connection
          await this.connect();
        } else {
          console.error('❌ [CLIENT] Session refresh returned no token');
          this.isRetryingJwt = false;
          this.handleJwtAuthenticationError('No token after refresh');
        }
      } catch (error) {
        console.error('❌ [CLIENT] JWT retry failed:', error);
        this.isRetryingJwt = false;
        this.handleJwtAuthenticationError('Retry failed');
      }
    }, delay);
  }

  /**
   * Shows authentication error to user (requires UI system integration)
   */
  private showAuthenticationErrorToUser(message: string): void {
    // Try to show error through UI system if available
    if (this.uiSystem && typeof this.uiSystem.showError === 'function') {
      this.uiSystem.showError('Errore di Autenticazione', message);
    } else {
      // Fallback: use browser alert (not ideal but better than silent failure)
      alert(`Errore di Autenticazione: ${message}`);
    }

    // Disconnect from server
    this.connectionManager.disconnect();
  }

  /**
   * Mostra notifica di rate limiting all'utente
   */
  private showRateLimitNotification(actionType: string, waitTime?: number): void {
    const messages = {
      'chat_message': 'Messaggi chat troppo frequenti. Riprova tra qualche secondo.',
      'combat_action': 'Azioni di combattimento troppo frequenti. Rallenta il ritmo.',
      'position_update': 'Aggiornamenti posizione troppo frequenti.',
      'heartbeat': 'Connessione instabile - heartbeat rate limited.'
    };

    const message = messages[actionType as keyof typeof messages] || `Azione "${actionType}" rate limited. Riprova più tardi.`;

    // Try to show notification through UI system
    if (this.uiSystem && typeof this.uiSystem.showNotification === 'function') {
      this.uiSystem.showNotification('Rate Limit', message, 'warning');
    } else if (this.uiSystem && typeof this.uiSystem.showError === 'function') {
      this.uiSystem.showError('Rate Limit', message);
    } else {
      // Fallback: console warning (already present)
      console.warn(`⚠️ [RATE_LIMIT] ${message}`);
    }
  }

  /**
   * Handles successful connection establishment
   */
  private async handleConnected(socket: WebSocket): Promise<void> {
    this.socket = socket;
    this.connectionState = ConnectionState.CONNECTED;

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
      // Disconnetti e gestisci errore con retry invece di reload forzato
      this.connectionManager.disconnect();
      this.handleJwtAuthenticationError('Sessione utente non valida');
      return;
    }

    // 🔴 CRITICAL SECURITY: Ottieni il JWT token corrente da Supabase
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) {
      console.error('❌ [CLIENT] No valid JWT token available - rilogin necessario');
      this.connectionManager.disconnect();
      this.handleJwtAuthenticationError('Token JWT non disponibile');
      return;
    }

    // Invalidate position tracker cache on connection (player might have moved)
    this.positionTracker.invalidateCache();

    // Send SECURE join message with JWT token
    const currentPosition = this.getLocalPlayerPosition();
    const nicknameToSend = this.gameContext.playerNickname || 'Player';

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

      if (message.type === 'player_state_update') {
      }

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

    const remoteProjectileSystem = this.getRemoteProjectileSystem();
    if (!remoteProjectileSystem) return;

    for (const projectileUpdate of message.projectiles) {
      // Usa RemoteProjectileSystem per trovare il proiettile tramite projectileId
      const entityId = remoteProjectileSystem.getRemoteProjectileEntity(projectileUpdate.id);
      if (!entityId) continue;

      const projectileEntity = this.ecs.getEntity(entityId);
      if (!projectileEntity) continue;

      // Aggiorna posizione e velocità del proiettile
      const transform = this.ecs.getComponent(projectileEntity, Transform);
      const velocity = this.ecs.getComponent(projectileEntity, Velocity);
      const projectile = this.ecs.getComponent(projectileEntity, Projectile);

      if (transform && projectileUpdate.position) {
        transform.x = projectileUpdate.position.x;
        transform.y = projectileUpdate.position.y;
      }

      if (velocity && projectileUpdate.velocity) {
        velocity.x = projectileUpdate.velocity.x;
        velocity.y = projectileUpdate.velocity.y;
      }
      
      // CRITICO: Aggiorna direzione e velocità del componente Projectile per rendering corretto
      if (projectile && projectileUpdate.velocity) {
        const speed = Math.sqrt(projectileUpdate.velocity.x * projectileUpdate.velocity.x + projectileUpdate.velocity.y * projectileUpdate.velocity.y);
        if (speed > 0) {
          projectile.directionX = projectileUpdate.velocity.x / speed;
          projectile.directionY = projectileUpdate.velocity.y / speed;
          projectile.speed = speed;
        }
      }
    }
  }

  /**
   * Handles disconnection events
   */
  private handleDisconnected(): void {
    const wasConnected = this.connectionState === ConnectionState.CONNECTED;
    this.socket = null;
    this.connectionState = ConnectionState.DISCONNECTED;

    // Reset connection promise
    if (this.connectionPromise && !wasConnected) {
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
   * Connects to the server using the connection manager with race condition prevention
   */
  async connect(): Promise<void> {
    // Prevent multiple concurrent connection attempts
    if (this.connectionState === ConnectionState.CONNECTING ||
        this.connectionState === ConnectionState.CONNECTED) {
      return this.connectionPromise || Promise.resolve();
    }

    if (this.connectionState === ConnectionState.RECONNECTING) {
      return this.connectionPromise || Promise.resolve();
    }

    // Set state and create promise
    this.connectionState = ConnectionState.CONNECTING;
    this.connectionPromise = new Promise<void>((resolve, reject) => {
      this.connectionResolver = resolve;
      this.connectionRejector = reject;
    });

    try {
      this.socket = await this.connectionManager.connect();

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
   * Gets the current player velocity for extrapolation
   */
  private getCurrentPlayerVelocity(): { x: number; y: number } {
    try {
      if (!this.ecs) {
        console.warn('[CLIENT] ECS not initialized in getCurrentPlayerVelocity');
        return { x: 0, y: 0 };
      }

      // Find player entity by Authority component with our client ID
      const playerEntity = this.ecs.getEntitiesWithComponents(Transform, Velocity, Authority)
        .find(entity => {
          const authority = this.ecs!.getComponent(entity, Authority);
          return authority && authority.ownerId === this.clientId;
        });

      if (playerEntity) {
        const velocity = this.ecs!.getComponent(playerEntity, Velocity);
        if (velocity) {
          return { x: velocity.x, y: velocity.y };
        }
      }
    } catch (error) {
      console.warn('[CLIENT] Error getting player velocity:', error);
    }

    return { x: 0, y: 0 }; // Fallback
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

    // ✅ FIX: Normalizza la rotazione PRIMA della validazione e invio
    let normalizedRotation = position.rotation;
    while (normalizedRotation > Math.PI) normalizedRotation -= 2 * Math.PI;
    while (normalizedRotation < -Math.PI) normalizedRotation += 2 * Math.PI;

    // OTTIENI VELOCITÀ DAL PLAYER (per extrapolation client-side)
    const velocity = this.getCurrentPlayerVelocity();

    const normalizedPosition = {
      x: position.x,
      y: position.y,
      rotation: normalizedRotation,
      velocityX: velocity.x,
      velocityY: velocity.y
    };

    // RATE LIMITING: Controlla se possiamo inviare aggiornamenti posizione
    if (!this.rateLimiter.canSend('position_update', RATE_LIMITS.POSITION_UPDATE.maxRequests, RATE_LIMITS.POSITION_UPDATE.windowMs)) {
      // Rate limit superato - salta questo aggiornamento per ridurre carico server
      return;
    }

    // CLIENT VALIDATION: usa fallback per dati invalidi
    if (!this.isValidPosition(normalizedPosition)) {
      if (Date.now() - this.lastInvalidPositionLog > 10000) {
        console.warn('[CLIENT] Invalid position data, using fallback:', {
          invalidData: normalizedPosition,
          clientId: this.clientId,
          timestamp: new Date().toISOString()
        });
        this.lastInvalidPositionLog = Date.now();
      }

      // Use safer fallback values instead of hardcoded zeros
      // Use network config fallback position for consistency
      normalizedPosition.x = NETWORK_CONFIG.FALLBACK_POSITION.x;
      normalizedPosition.y = NETWORK_CONFIG.FALLBACK_POSITION.y;
      normalizedPosition.rotation = NETWORK_CONFIG.FALLBACK_POSITION.rotation;
      normalizedPosition.velocityX = 0; // Always reset velocity on invalid data
      normalizedPosition.velocityY = 0;

      // TODO: Consider disconnecting client after multiple consecutive invalid messages
      // This could indicate cheating or serious client-side issues
    }

    this.connectionManager.send(JSON.stringify({
      type: MESSAGE_TYPES.POSITION_UPDATE,
      clientId: this.clientId,
      x: normalizedPosition.x,
      y: normalizedPosition.y,
      rotation: normalizedRotation, // Ora usa la rotazione normalizzata
      velocityX: normalizedPosition.velocityX,
      velocityY: normalizedPosition.velocityY,
      tick: this.tickManager.getTickCounter()
    }));
  }

  /**
   * Valida che la posizione sia valida prima dell'invio
   */
  private isValidPosition(pos: { x: number; y: number; rotation: number; velocityX?: number; velocityY?: number }): boolean {
    // Normalizza la rotation per accettare valori non normalizzati
    let normalizedRotation = pos.rotation;
    while (normalizedRotation > Math.PI) normalizedRotation -= 2 * Math.PI;
    while (normalizedRotation < -Math.PI) normalizedRotation += 2 * Math.PI;

    const velocityX = pos.velocityX ?? 0;
    const velocityY = pos.velocityY ?? 0;

    return Number.isFinite(pos.x) &&
           Number.isFinite(pos.y) &&
           Number.isFinite(pos.rotation) &&
           Number.isFinite(velocityX) &&
           Number.isFinite(velocityY) &&
           pos.x >= -15000 && pos.x <= 15000 && // Tighter position bounds for space game
           pos.y >= -15000 && pos.y <= 15000 && // Reasonable space area
           normalizedRotation >= -Math.PI && normalizedRotation <= Math.PI &&
           velocityX >= -500 && velocityX <= 500 && // Reasonable max speed for space ship
           velocityY >= -500 && velocityY <= 500;   // Prevents speed hacking
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
    return this.connectionState === ConnectionState.CONNECTED && this.connectionManager.isConnectionActive();
  }

  /**
   * Gets the current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
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
      clientId: this.clientId,
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

    if (!this.clientId) {
      return;
    }


    // RATE LIMITING: Controlla se possiamo inviare azioni di combattimento
    if (!this.rateLimiter.canSend('combat_action', RATE_LIMITS.COMBAT_ACTION.maxRequests, RATE_LIMITS.COMBAT_ACTION.windowMs)) {
      this.showRateLimitNotification('combat_action');
      return;
    }

    // Salva l'NPC corrente per stop_combat
    this.entityManager.setCurrentCombatNpcId(data.npcId);

    const message = {
      type: MESSAGE_TYPES.START_COMBAT,
      clientId: this.clientId,
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
      clientId: this.clientId,
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
      this.showRateLimitNotification('combat_action');
      return;
    }

    const message = {
      type: MESSAGE_TYPES.PROJECTILE_FIRED,
      clientId: this.clientId,
      projectileId: data.projectileId,
      playerId: data.playerId,
      position: data.position,
      velocity: data.velocity,
      // damage rimosso: sarà calcolato dal server (Server Authoritative)
      projectileType: data.projectileType
    };

    this.connectionManager.send(JSON.stringify(message));
  }

  // 🔴 SECURITY: sendPlayerUpgrades RIMOSSO - gli upgrade passano SOLO da requestSkillUpgrade

  /**
   * Gets the local client ID
   */
  getLocalClientId(): string {
    return this.clientId;
  }

  /**
   * Requests a stat upgrade to the server (Server Authoritative)
   * Costs credits and cosmos instead of skill points
   */
  requestSkillUpgrade(upgradeType: 'hp' | 'shield' | 'speed' | 'damage'): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    const message = {
      type: 'skill_upgrade_request',
      clientId: this.clientId,  // WebSocket client ID
      playerId: this.gameContext.authId,  // User/auth ID (UUID)
      upgradeType: upgradeType
    };

    this.sendMessage(message);

    // Setup timeout per gestire risposte mancanti
    setTimeout(() => {
    }, 3000);
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
      this.showRateLimitNotification('chat_message');
      return;
    }

    const message = {
      type: 'chat_message',
      clientId: this.clientId,
      content: content.trim(),
      timestamp: Date.now()
    };

    if (import.meta.env.DEV) {
    }

    this.connectionManager.send(JSON.stringify(message));
  }

  /**
   * Sets the AudioSystem instance
   */
  setAudioSystem(audioSystem: any): void {
    this.audioSystem = audioSystem;
    // Propaga riferimento al NetworkEventSystem (che contiene i sottosistemi)
    this.eventSystem.initializeExternalSystems(audioSystem, this.uiSystem, this.logSystem, this.economySystem);
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
    // Propaga ai sottosistemi solo se tutti i sistemi necessari sono disponibili
    if (this.uiNotificationSystem && this.uiSystem && this.logSystem && this.economySystem) {
      this.uiNotificationSystem.setUISystems(this.uiSystem, this.logSystem, this.economySystem);
    }
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
    // Propaga ai sottosistemi solo se tutti i sistemi necessari sono disponibili
    if (this.uiNotificationSystem && this.uiSystem && this.logSystem && this.economySystem) {
      this.uiNotificationSystem.setUISystems(this.uiSystem, this.logSystem, this.economySystem);
    }
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
    // Propaga ai sottosistemi solo se tutti i sistemi necessari sono disponibili
    if (this.uiNotificationSystem && this.uiSystem && this.logSystem && this.economySystem) {
      this.uiNotificationSystem.setUISystems(this.uiSystem, this.logSystem, this.economySystem);
    }
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

  /**
   * Richiede i dati completi del giocatore al server (dopo welcome)
   */
  requestPlayerData(playerId: string): void {
    if (!this.connectionManager.isConnectionActive()) {
      console.warn('📊 [PLAYER_DATA] Cannot request player data - not connected');
      return;
    }

    const message = {
      type: MESSAGE_TYPES.REQUEST_PLAYER_DATA,
      clientId: this.clientId,
      playerId: playerId,
      timestamp: Date.now()
    };

    this.connectionManager.send(JSON.stringify(message));
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

    // Reset connection state
    this.connectionState = ConnectionState.DISCONNECTED;
    if (this.connectionPromise && this.connectionRejector) {
      this.connectionRejector(new Error('System destroyed during connection'));
    }
    this.connectionPromise = null;
    this.connectionResolver = null;
    this.connectionRejector = null;

    // Disconnect from server
    this.connectionManager.disconnect();

    // Clear callbacks
    this.onPlayerIdReceived = undefined;
    this.onDisconnectedCallback = undefined;
    this.onConnectionErrorCallback = undefined;
    this.onReconnectingCallback = undefined;
    this.onReconnectedCallback = undefined;
    this.onConnectedCallback = undefined;
  }
}
