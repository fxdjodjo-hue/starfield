import { ECS } from '../../../infrastructure/ecs/ECS';
import { GameContext } from '../../../infrastructure/engine/GameContext';
import { RemoteNpcSystem } from '../../../systems/multiplayer/RemoteNpcSystem';
import { RemoteProjectileSystem } from '../../../systems/multiplayer/RemoteProjectileSystem';
import { MessageRouter } from '../handlers/MessageRouter';
import { secureLogger } from '../../../config/NetworkConfig';
import { NetworkConnectionManager } from './NetworkConnectionManager';
import { NetworkTickManager } from './NetworkTickManager';
import { PlayerPositionTracker } from './PlayerPositionTracker';
import { NetworkStateManager, ConnectionState } from './NetworkStateManager';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import type { NetMessage } from '../types/MessageTypes';

// Handler imports
import { WelcomeHandler } from '../handlers/WelcomeHandler';
import { RemotePlayerUpdateHandler } from '../handlers/RemotePlayerUpdateHandler';
import { PlayerJoinedHandler } from '../handlers/PlayerJoinedHandler';
import { PlayerLeftHandler } from '../handlers/PlayerLeftHandler';
import { PlayerRespawnHandler } from '../handlers/PlayerRespawnHandler';
import { PlayerStateUpdateHandler } from '../handlers/PlayerStateUpdateHandler';
import { PlayerDataResponseHandler } from '../handlers/PlayerDataResponseHandler';
import { SaveResponseHandler } from '../handlers/SaveResponseHandler';
import { LeaderboardResponseHandler } from '../handlers/LeaderboardResponseHandler';
import { InitialNpcsHandler } from '../handlers/InitialNpcsHandler';
import { NpcJoinedHandler } from '../handlers/NpcJoinedHandler';
import { NpcSpawnHandler } from '../handlers/NpcSpawnHandler';
import { NpcBulkUpdateHandler } from '../handlers/NpcBulkUpdateHandler';
import { NpcLeftHandler } from '../handlers/NpcLeftHandler';
import { CombatUpdateHandler } from '../handlers/CombatUpdateHandler';
import { CombatErrorHandler } from '../handlers/CombatErrorHandler';
import { StopCombatHandler } from '../handlers/StopCombatHandler';
import { ProjectileFiredHandler } from '../handlers/ProjectileFiredHandler';
import { ProjectileUpdateHandler } from '../handlers/ProjectileUpdateHandler';
import { ProjectileDestroyedHandler } from '../handlers/ProjectileDestroyedHandler';
import { EntityDamagedHandler } from '../handlers/EntityDamagedHandler';
import { EntityDestroyedHandler } from '../handlers/EntityDestroyedHandler';
import { ExplosionCreatedHandler } from '../handlers/ExplosionCreatedHandler';
import { RepairStartedHandler } from '../handlers/RepairStartedHandler';
import { RepairStoppedHandler } from '../handlers/RepairStoppedHandler';
import { RepairCompleteHandler } from '../handlers/RepairCompleteHandler';
import { ProjectileBulkUpdateHandler } from '../handlers/ProjectileBulkUpdateHandler';
import { GlobalMonitorHandler } from '../handlers/GlobalMonitorHandler';
import { MapChangeHandler } from '../handlers/MapChangeHandler';
import { ErrorMessageHandler } from '../handlers/ErrorMessageHandler';
import { QuestUpdateHandler } from '../handlers/QuestUpdateHandler';
import { BossEventHandler } from '../handlers/BossEventHandler';

/**
 * Interface for JWT authentication validation
 */
export interface JwtAuthValidator {
  validateSession(): Promise<{ session: { access_token: string } | null; error: any }>;
  validateLocalClientId(): boolean;
  handleAuthError(reason: string): void;
}

/**
 * NetworkInitializationManager - Setup rete, inizializzazione stati, handshake, init client state
 * Estratto da ClientNetworkSystem per Separation of Concerns
 */
export class NetworkInitializationManager {
  // Initialization state management
  private initializationPromise: Promise<void> | null = null;
  private initializationResolver: (() => void) | null = null;
  private isInitialized = false;

  // 🔧 FIX: Traccia quali handler sono già stati registrati per evitare duplicati
  private baseHandlersRegistered = false;
  private npcHandlersRegistered = false;
  private combatHandlersRegistered = false;

  private remoteNpcSystem?: RemoteNpcSystem;
  private remoteProjectileSystem?: RemoteProjectileSystem;

  private readonly messageRouter: MessageRouter;
  private readonly connectionManager: NetworkConnectionManager;
  private readonly tickManager: NetworkTickManager;
  private readonly positionTracker: PlayerPositionTracker;
  private readonly stateManager: NetworkStateManager;
  private readonly gameContext: GameContext;
  private readonly initialClientId: string;

  constructor(
    messageRouter: MessageRouter,
    connectionManager: NetworkConnectionManager,
    tickManager: NetworkTickManager,
    positionTracker: PlayerPositionTracker,
    stateManager: NetworkStateManager,
    gameContext: GameContext,
    clientId: string,
    remoteNpcSystem?: RemoteNpcSystem,
    remoteProjectileSystem?: RemoteProjectileSystem
  ) {
    this.messageRouter = messageRouter;
    this.connectionManager = connectionManager;
    this.tickManager = tickManager;
    this.positionTracker = positionTracker;
    this.stateManager = stateManager;
    this.gameContext = gameContext;
    this.initialClientId = clientId;
    this.remoteNpcSystem = remoteNpcSystem;
    this.remoteProjectileSystem = remoteProjectileSystem;
  }

  /**
   * Returns the most up-to-date clientId available.
   * Priority: state manager (updated on welcome) -> game context -> initial constructor value.
   */
  private getCurrentClientId(): string {
    return this.stateManager.clientId || this.gameContext.localClientId || this.initialClientId;
  }

  /**
   * Updates remote system references
   */
  setRemoteSystems(remoteNpcSystem?: RemoteNpcSystem, remoteProjectileSystem?: RemoteProjectileSystem): void {
    this.remoteNpcSystem = remoteNpcSystem;
    this.remoteProjectileSystem = remoteProjectileSystem;
  }

  /**
   * Registers message handlers incrementally to avoid duplicates
   * Only registers handlers that haven't been registered yet
   */
  registerMessageHandlers(): void {
    const handlersToRegister: any[] = [];

    // 🔧 FIX: Registra handler base solo se non già fatto
    if (!this.baseHandlersRegistered) {
      handlersToRegister.push(
        new WelcomeHandler(),
        new RemotePlayerUpdateHandler(),
        new PlayerJoinedHandler(),
        new PlayerLeftHandler(),
        new PlayerRespawnHandler(),
        new PlayerStateUpdateHandler(),
        new PlayerDataResponseHandler(),
        new SaveResponseHandler(),
        new LeaderboardResponseHandler(),
        new RepairStartedHandler(),
        new RepairStoppedHandler(),
        new RepairCompleteHandler(),
        new GlobalMonitorHandler(),
        new MapChangeHandler(),
        new QuestUpdateHandler(),
        new BossEventHandler(),
        new ErrorMessageHandler()
      );
      this.baseHandlersRegistered = true;
    }

    // 🔧 FIX: Registra handler NPC solo se sistema disponibile e non già registrati
    if (this.remoteNpcSystem && !this.npcHandlersRegistered) {
      handlersToRegister.push(
        new InitialNpcsHandler(),
        new NpcJoinedHandler(),
        new NpcSpawnHandler(),
        new NpcBulkUpdateHandler(),
        new NpcLeftHandler()
      );
      this.npcHandlersRegistered = true;
    }

    // 🔧 FIX: Registra handler combattimento solo se sistema disponibile e non già registrati
    if (this.remoteProjectileSystem && !this.combatHandlersRegistered) {
      handlersToRegister.push(
        new CombatUpdateHandler(),
        new CombatErrorHandler(),
        new StopCombatHandler(),
        new ProjectileFiredHandler(),
        new ProjectileUpdateHandler(),
        new ProjectileBulkUpdateHandler(),
        new ProjectileDestroyedHandler(),
        new EntityDamagedHandler(),
        new EntityDestroyedHandler(),
        new ExplosionCreatedHandler()
      );
      this.combatHandlersRegistered = true;
    }

    // Registra solo i nuovi handler (non sovrascrive quelli esistenti)
    // Defensive dedupe in caso di future regressioni/copy-paste.
    const uniqueHandlers = handlersToRegister.filter((handler, index, array) =>
      array.findIndex((candidate) => candidate.constructor?.name === handler.constructor?.name) === index
    );

    if (uniqueHandlers.length > 0) {
      secureLogger.log('Registering new handlers:', uniqueHandlers.map((h: any) => h.constructor?.name).join(', '));
      uniqueHandlers.forEach(handler => this.messageRouter.registerHandler(handler));
    } else {
      secureLogger.log('All handlers already registered');
    }
  }

  /**
   * Resets handler registration flags (useful for reconnections or testing)
   */
  resetHandlerRegistration(): void {
    this.baseHandlersRegistered = false;
    this.npcHandlersRegistered = false;
    this.combatHandlersRegistered = false;
    secureLogger.log('Handler registration flags reset');
  }

  /**
   * Handles successful connection establishment
   * Validates JWT and sends JOIN message
   */
  async handleConnected(_socket: WebSocket, jwtValidator: JwtAuthValidator): Promise<void> {
    const previousState = this.stateManager.getConnectionState();

    // 🔴 CRITICAL SECURITY: Verifica che abbiamo sia una sessione valida che un token JWT
    if (!jwtValidator.validateLocalClientId()) {
      console.error('❌ [CLIENT] Tentativo di connessione senza sessione valida - rilogin necessario');
      // Disconnetti e gestisci errore con retry invece di reload forzato
      this.connectionManager.disconnect();
      jwtValidator.handleAuthError('Invalid user session');
      return;
    }

    // 🔴 CRITICAL SECURITY: Ottieni il JWT token corrente da Supabase
    const { session, error: sessionError } = await jwtValidator.validateSession();
    if (sessionError || !session?.access_token) {
      console.error('❌ [CLIENT] No valid JWT token available - rilogin necessario');
      this.connectionManager.disconnect();
      jwtValidator.handleAuthError('JWT token not available');
      return;
    }

    // Invalidate position tracker cache on connection (player might have moved)
    this.positionTracker.invalidateCache();

    // Send SECURE join message with JWT token
    const currentPosition = this.positionTracker.getLocalPlayerPosition();
    const nicknameToSend = this.gameContext.playerNickname || 'Player';

    const currentClientId = this.getCurrentClientId();
    if (!this.connectionManager.isConnectionActive()) {
      throw new Error('Connection dropped before JOIN dispatch');
    }
    this.sendMessageInternal({
      type: MESSAGE_TYPES.JOIN,
      clientId: currentClientId,
      nickname: nicknameToSend,
      // 🔴 CRITICAL SECURITY: Include JWT token for server-side validation
      authToken: session.access_token,
      // playerId sarà assegnato dal server nel welcome message
      // 🔴 RECONNECTION FIX: Use authId (UUID) NOT localClientId (which might be numeric after welcome)
      userId: this.gameContext.authId || this.gameContext.localClientId,
      position: currentPosition
    });

    // Mark as connected only after auth+JOIN dispatch prerequisites are satisfied.
    this.stateManager.setConnectionState(ConnectionState.CONNECTED);
    this.tickManager.reset();
    if (previousState === ConnectionState.RECONNECTING) {
      this.stateManager.notifyReconnected();
    }
    this.stateManager.notifyConnected();
  }

  /**
   * Sends a message to the server
   * Automatically adds clientId if not present
   */
  private sendMessageInternal(message: NetMessage): void {
    const currentClientId = this.getCurrentClientId();

    // Ensure clientId is always included
    const messageWithClientId = {
      ...message,
      clientId: message.clientId || currentClientId
    };
    this.connectionManager.send(JSON.stringify(messageWithClientId));
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
   * Cleanup method
   */
  destroy(): void {
    this.initializationPromise = null;
    this.initializationResolver = null;
    this.isInitialized = false;
  }
}
