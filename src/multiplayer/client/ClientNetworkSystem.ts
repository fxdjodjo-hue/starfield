import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { RemotePlayerSystem } from '../../systems/multiplayer/RemotePlayerSystem';
import { PlayerSystem } from '../../systems/player/PlayerSystem';
import { RemoteNpcSystem } from '../../systems/multiplayer/RemoteNpcSystem';
import { RemoteProjectileSystem } from '../../systems/multiplayer/RemoteProjectileSystem';

// Modular architecture components
import { NetworkConnectionManager } from './managers/NetworkConnectionManager';
import { NetworkEventManager } from './managers/NetworkEventManager';
import { RemoteEntityManager } from './managers/RemoteEntityManager';
import { RateLimiter, RATE_LIMITS } from './managers/RateLimiter';
import { NetworkStateManager, ConnectionState } from './managers/NetworkStateManager';
import { NetworkInitializationManager } from './managers/NetworkInitializationManager';
import { IDGenerator } from '../../core/utils/IDGenerator';
import { NetworkAuthenticationManager } from './managers/NetworkAuthenticationManager';
import { NetworkPositionSyncManager } from './managers/NetworkPositionSyncManager';
import { NetworkCombatManager } from './managers/NetworkCombatManager';
import { NetworkPlayerDataManager } from './managers/NetworkPlayerDataManager';
import { NetworkChatManager } from './managers/NetworkChatManager';

// New modular components
import { MessageRouter } from './handlers/MessageRouter';
import { RemotePlayerManager } from './managers/RemotePlayerManager';
import { PlayerPositionTracker } from './managers/PlayerPositionTracker';
import { NetworkTickManager } from './managers/NetworkTickManager';
import { DeathPopupManager } from '../../presentation/ui/managers/death/DeathPopupManager';

// Types and Configuration
import type { NetMessage } from './types/MessageTypes';
import { NETWORK_CONFIG, MESSAGE_TYPES, type PlayerUuid, type PlayerDbId, type ClientId, secureLogger } from '../../config/NetworkConfig';

/**
 * Sistema di rete client modulare per multiplayer
 * Utilizza architettura a componenti per gestire connessioni, messaggi e giocatori remoti
 */
export class ClientNetworkSystem extends BaseSystem {
  // Core dependencies
  public readonly gameContext: GameContext;
  public clientId: string;
  private audioSystem: any = null;
  private logSystem: any = null;
  private uiSystem: any = null;
  private economySystem: any = null;
  private rewardSystem: any = null;

  // Modular architecture components
  private readonly connectionManager: NetworkConnectionManager;
  private readonly eventSystem: NetworkEventManager;
  private readonly entityManager: RemoteEntityManager;
  private readonly tickManager: NetworkTickManager;
  private readonly positionTracker: PlayerPositionTracker;
  private readonly rateLimiter: RateLimiter;
  private readonly stateManager: NetworkStateManager;
  private readonly initManager: NetworkInitializationManager;
  private readonly authManager: NetworkAuthenticationManager;
  private readonly positionSyncManager: NetworkPositionSyncManager;
  private readonly combatManager: NetworkCombatManager;
  private readonly playerDataManager: NetworkPlayerDataManager;
  private readonly chatManager: NetworkChatManager;

  // Legacy components (to be phased out)
  public readonly remotePlayerManager: RemotePlayerManager;
  private readonly messageRouter: MessageRouter;

  // System references
  private remotePlayerSystem: RemotePlayerSystem;
  private remoteNpcSystem: RemoteNpcSystem | null = null;
  private remoteProjectileSystem: RemoteProjectileSystem | null = null;
  private playerSystem: PlayerSystem | null = null;
  private deathPopupManager: DeathPopupManager;
  // ecs is inherited from System base class and is always non-null

  // Player info - ora con branded type
  private playerDbId?: PlayerDbId;
  private hasReceivedWelcome: boolean = false;

  // Callbacks for external systems
  private onPlayerIdReceived?: (playerDbId: PlayerDbId) => void;

  // Legacy socket reference (for backward compatibility)
  private socket: WebSocket | null = null;

  constructor(ecs: ECS, gameContext: GameContext, remotePlayerSystem: RemotePlayerSystem, serverUrl: string = NETWORK_CONFIG.DEFAULT_SERVER_URL, remoteNpcSystem?: RemoteNpcSystem, remoteProjectileSystem?: RemoteProjectileSystem, audioSystem?: any) {
    super(ecs);
    this.gameContext = gameContext;
    this.audioSystem = audioSystem || null;
    this.remotePlayerSystem = remotePlayerSystem;
    this.remoteNpcSystem = remoteNpcSystem || null;
    this.remoteProjectileSystem = remoteProjectileSystem || null;

    // Generate unique client ID
    this.clientId = IDGenerator.generateClientId();

    // Track if we've received welcome (clientId is valid)
    this.hasReceivedWelcome = false;

    // REFACTORED: Initialize modular architecture
    this.connectionManager = new NetworkConnectionManager(
      serverUrl,
      this.handleConnected.bind(this),
      this.handleMessage.bind(this),
      this.handleDisconnected.bind(this),
      this.handleConnectionError.bind(this),
      this.handleReconnecting.bind(this)
    );

    this.eventSystem = new NetworkEventManager(ecs, gameContext);
    this.entityManager = new RemoteEntityManager(ecs, remotePlayerSystem);
    this.positionTracker = new PlayerPositionTracker(ecs);
    this.rateLimiter = new RateLimiter();

    // Initialize network tick manager (callbacks will be set after managers are created)
    this.tickManager = new NetworkTickManager(
      () => this.stateManager.sendHeartbeat(),
      (position) => this.positionSyncManager.sendPlayerPosition(position)
    );

    // Initialize state manager
    this.stateManager = new NetworkStateManager(
      this.connectionManager,
      this.rateLimiter,
      this.tickManager,
      this.clientId,
      () => this.isReady() // Callback per controllare se il client è ready
    );

    // Initialize initialization manager
    this.messageRouter = new MessageRouter();
    this.initManager = new NetworkInitializationManager(
      this.messageRouter,
      this.connectionManager,
      this.tickManager,
      this.positionTracker,
      this.stateManager,
      gameContext,
      this.clientId,
      remoteNpcSystem,
      remoteProjectileSystem
    );

    // Initialize authentication manager
    this.authManager = new NetworkAuthenticationManager(
      this.connectionManager,
      this.eventSystem,
      this.stateManager,
      gameContext
    );

    // Initialize position sync manager
    this.positionSyncManager = new NetworkPositionSyncManager(
      ecs,
      this.connectionManager,
      this.rateLimiter,
      this.tickManager,
      this.positionTracker,
      this.clientId,
      () => this.isReady() // Callback per controllare se il client è ready
    );

    // Initialize combat manager
    this.combatManager = new NetworkCombatManager(
      this.connectionManager,
      this.rateLimiter,
      this.eventSystem,
      this.entityManager,
      this.clientId,
      () => this.entityManager.getCurrentCombatNpcId(),
      (message) => this.sendMessage(message),
      () => this.isConnected(),
      () => this.isReady()
    );

    // Initialize player data manager
    this.playerDataManager = new NetworkPlayerDataManager(
      this.connectionManager,
      gameContext,
      this.clientId,
      (message) => this.sendMessage(message),
      () => this.isConnected()
    );

    // Initialize chat manager
    this.chatManager = new NetworkChatManager(
      this.connectionManager,
      this.rateLimiter,
      this.eventSystem,
      this.clientId
    );


    // Initialize death popup manager
    this.deathPopupManager = new DeathPopupManager(gameContext);

    // Register message handlers
    this.initManager.registerMessageHandlers();

    // Legacy components for backward compatibility
    this.remotePlayerManager = new RemotePlayerManager(ecs, remotePlayerSystem);

    // Don't connect automatically - will be called manually after systems are set up
  }

  getRemotePlayerSystem(): RemotePlayerSystem {
    return this.remotePlayerSystem;
  }

  setPlayerSystem(playerSystem: PlayerSystem): void {
    this.playerSystem = playerSystem;
  }

  getPlayerSystem(): PlayerSystem | null {
    return this.playerSystem;
  }

  /**
   * Trova l'entità di qualsiasi giocatore (locale o remoto) tramite clientId
   */
  public findAnyPlayerEntity(clientId: string): any | null {
    // 1. Controlla se è il player locale
    if (clientId === this.getLocalClientId()) {
      const playerEntity = this.playerSystem?.getPlayerEntity();
      if (playerEntity) return playerEntity;
    }

    // 2. Cerca tra i player remoti
    if (this.remotePlayerSystem) {
      return this.remotePlayerSystem.findRemotePlayerEntity(clientId);
    }

    return null;
  }

  // DEPRECATED: Ora usiamo updateClientId() che gestisce automaticamente lo stato ready

  getPendingPosition(): { x: number; y: number; rotation: number } | null {
    return this.positionSyncManager.getPendingPosition();
  }

  clearPendingPosition(): void {
    this.positionSyncManager.clearPendingPosition();
  }

  setCurrentCombatNpcId(npcId: string | null): void {
    this.entityManager.setCurrentCombatNpcId(npcId);
  }

  getCurrentCombatNpcId(): string | null {
    return this.entityManager.getCurrentCombatNpcId();
  }

  invalidatePositionCache(): void {
    this.positionTracker.invalidateCache();
  }

  getHasReceivedWelcome(): boolean {
    return this.positionSyncManager.getHasReceivedWelcome();
  }

  getLocalPlayerPosition(): { x: number; y: number; rotation: number } {
    return this.positionSyncManager.getLocalPlayerPosition();
  }

  private async handleConnected(socket: WebSocket): Promise<void> {
    this.socket = socket;
    await this.initManager.handleConnected(socket, this.authManager);
  }

  private handleMessage(data: string): void {
    try {
      const message: NetMessage = JSON.parse(data);

      // Handle simple acknowledgment messages that don't need handlers
      if (message.type === MESSAGE_TYPES.POSITION_ACK ||
        message.type === MESSAGE_TYPES.HEARTBEAT_ACK ||
        message.type === MESSAGE_TYPES.WORLD_UPDATE) {
        return; // No action needed
      }

      // 🔧 FIX: Assicurati che ogni messaggio abbia un clientId valido
      // Per i messaggi ricevuti dal server, usa il nostro clientId locale
      if (!message.clientId || message.clientId === 'undefined') {
        message.clientId = this.clientId;
      }

      // Route all other messages to appropriate handlers
      secureLogger.log('Routing message:', { type: message.type, clientId: message.clientId });
      this.messageRouter.route(message, this);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[ClientNetworkSystem] Error handling message:', error);
      }
    }
  }

  private handleDisconnected(): void {
    this.socket = null;
    this.stateManager.handleDisconnected();
  }

  private handleConnectionError(error: Event): void {
    this.stateManager.handleConnectionError(error);
  }

  private handleReconnecting(): void {
    this.stateManager.handleReconnecting();
  }

  onDisconnected(callback: () => void): void {
    this.stateManager.onDisconnected(callback);
  }

  onConnectionError(callback: (error: Event) => void): void {
    this.stateManager.onConnectionError(callback);
  }

  onReconnecting(callback: () => void): void {
    this.stateManager.onReconnecting(callback);
  }

  onReconnected(callback: () => void): void {
    this.stateManager.onReconnected(callback);
  }

  onConnected(callback: () => void): void {
    this.stateManager.onConnected(callback);
  }

  async connect(): Promise<void> {
    await this.stateManager.connect();
    // Socket is managed internally by connectionManager, no need to store it separately
    // Legacy socket reference is maintained for backward compatibility but may be null
    return Promise.resolve();
  }


  update(deltaTime: number): void {
    if (!this.connectionManager.isConnectionActive()) {
      return;
    }

    // Solo bufferizza aggiornamenti di posizione se il client è ready
    if (this.isReady()) {
      const currentPosition = this.positionSyncManager.getLocalPlayerPosition();

      // Invia aggiornamenti solo se la posizione è cambiata significativamente
      // per evitare di spammare il server con aggiornamenti inutili
      if (this.shouldSendPositionUpdate(currentPosition)) {
        this.tickManager.bufferPositionUpdate(currentPosition);
        this.lastSentPosition = { ...currentPosition };
      }
    }

    this.tickManager.update(deltaTime);
  }

  private lastSentPosition: { x: number; y: number; rotation: number } | null = null;

  private shouldSendPositionUpdate(currentPosition: { x: number; y: number; rotation: number }): boolean {
    if (!this.lastSentPosition) {
      return true; // Prima volta, invia sempre
    }

    const dx = Math.abs(currentPosition.x - this.lastSentPosition.x);
    const dy = Math.abs(currentPosition.y - this.lastSentPosition.y);
    const dr = Math.abs(currentPosition.rotation - this.lastSentPosition.rotation);

    // Invia solo se si è mossi di almeno 5 unità o ruotati di almeno 0.1 radianti
    const MOVEMENT_THRESHOLD = 5;
    const ROTATION_THRESHOLD = 0.1;

    return dx > MOVEMENT_THRESHOLD || dy > MOVEMENT_THRESHOLD || dr > ROTATION_THRESHOLD;
  }

  public sendMessage(message: NetMessage): void {
    // Ensure clientId is always included
    const messageWithClientId = {
      ...message,
      clientId: message.clientId || this.clientId
    };
    this.connectionManager.send(JSON.stringify(messageWithClientId));
  }

  /**
   * Sends a save request to the server
   * Public method for PlayState.markAsChanged()
   */
  sendSaveRequest(playerId: string): void {
    if (!this.connectionManager.isConnectionActive()) {
      return;
    }
    this.sendMessage({
      type: 'save_request',
      clientId: this.clientId,
      playerId: playerId,
      timestamp: Date.now()
    });
  }


  isConnected(): boolean {
    return this.stateManager.isConnected();
  }

  getConnectionState(): ConnectionState {
    return this.stateManager.getConnectionState();
  }

  getRemoteNpcSystem(): RemoteNpcSystem | null {
    return this.remoteNpcSystem;
  }
  setRemoteNpcSystem(remoteNpcSystem: RemoteNpcSystem): void {
    this.entityManager.setRemoteSystems(remoteNpcSystem, this.remoteProjectileSystem || undefined);

    // Legacy reference for backward compatibility
    this.remoteNpcSystem = remoteNpcSystem;

    // Update initialization manager with new system reference
    this.initManager.setRemoteSystems(remoteNpcSystem, this.remoteProjectileSystem || undefined);

    // Ri-registra gli handler per includere quelli NPC ora che il sistema è disponibile
    if (remoteNpcSystem) {
      this.initManager.registerMessageHandlers();
    }
  }

  setRemoteProjectileSystem(remoteProjectileSystem: RemoteProjectileSystem): void {
    this.entityManager.setRemoteSystems(this.remoteNpcSystem || undefined, remoteProjectileSystem);

    // Legacy reference for backward compatibility
    this.remoteProjectileSystem = remoteProjectileSystem;

    // Update initialization manager with new system reference
    this.initManager.setRemoteSystems(this.remoteNpcSystem || undefined, remoteProjectileSystem);

    // Ri-registra gli handler per includere quelli di combattimento ora che il sistema è disponibile
    if (remoteProjectileSystem) {
      this.initManager.registerMessageHandlers();

      // Ora che tutti gli handler sono registrati (incluso EntityDestroyedHandler), configura il DeathPopupManager
      this.configureDeathPopupManager();
    }
  }

  setEcs(ecs: ECS): void {
    this.ecs = ecs;
  }
  stopCombat(): void {
    if (!this.ecs) {
      secureLogger.error('ECS not available in stopCombat');
      return;
    }

    // Find the CombatSystem and stop combat immediately
    const systems = this.ecs.getSystems();
    const combatSystem = systems.find((system: any) =>
      typeof system.stopCombatImmediately === 'function'
    ) as any;

    if (combatSystem) {
      combatSystem.stopCombatImmediately();

      // Also deactivate attack in PlayerControlSystem to prevent auto-attack on next NPC click
      const playerControlSystem = systems.find((system: any) =>
        typeof system.deactivateAttack === 'function'
      ) as any;

      if (playerControlSystem) {
        playerControlSystem.deactivateAttack();
      }
    } else {
      secureLogger.error('CombatSystem not found, cannot stop combat');
    }
  }

  async connectToServer(): Promise<void> {
    try {
      await this.connect();
    } catch (error) {
      console.error(`❌ [CLIENT] Connection failed:`, error);
      throw error; // Rilancia l'errore per permettere al chiamante di gestirlo
    }
  }

  getEntityDestroyedHandler(): any {
    if (this.messageRouter) {
      const handlers = (this.messageRouter as any).handlers || [];
      return handlers.find((handler: any) => typeof handler.setRewardSystem === 'function') || null;
    }
    return null;
  }

  getRemoteProjectileSystem(): RemoteProjectileSystem | null {
    return this.remoteProjectileSystem;
  }


  getECS(): ECS | null {
    return this.ecs;
  }

  /**
   * Abilita/disabilita l'input del giocatore (usato durante morte/respawn)
   */
  setPlayerInputEnabled(enabled: boolean): void {
    // Trova il PlayerControlSystem nell'ECS
    const systems = this.ecs.getSystems();
    const playerControlSystem = systems.find((system: any) =>
      system.constructor.name === 'PlayerControlSystem'
    ) as any;

    if (playerControlSystem && playerControlSystem.setInputForcedDisabled) {
      playerControlSystem.setInputForcedDisabled(!enabled);
    }
  }

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

  async createRemoteExplosion(message: {
    explosionId: string;
    entityId: string;
    entityType: 'player' | 'npc';
    position: { x: number; y: number };
    explosionType: 'entity_death' | 'projectile_impact' | 'special';
  }): Promise<void> {
    await this.eventSystem.createRemoteExplosion(message);
  }

  setPreloadedExplosionFrames(frames: HTMLImageElement[]): void {
    this.eventSystem.setPreloadedExplosionFrames(frames);
  }

  sendStartCombat(data: {
    npcId: string;
    playerId: string;
  }): void {
    this.combatManager.sendStartCombat(data, this);
  }

  sendStopCombat(data: {
    playerId: string;
    npcId?: string;
  }): void {
    this.combatManager.sendStopCombat(data);
  }

  sendProjectileFired(data: {
    projectileId: string;
    playerId: string;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    projectileType: string;
  }): void {
    // Use authId (UUID) instead of clientId for playerId validation
    const playerId = this.gameContext.authId || data.playerId;
    this.combatManager.sendProjectileFired({
      ...data,
      playerId: playerId
    });
  }

  getLocalClientId(): string {
    // Usa l'ID assegnato dal server (gameContext.localClientId) se disponibile,
    // altrimenti usa quello generato localmente (clientId)
    return this.gameContext.localClientId || this.clientId;
  }

  /**
   * 🔄 CRITICAL: Aggiorna il clientId al valore persistente inviato dal server
   * Questo viene chiamato dal WelcomeHandler quando il server assegna un clientId persistente
   */
  updateClientId(newClientId: string): void {
    // Salva il vecchio clientId per trasferire eventuali aggiornamenti pendenti
    const oldClientId = this.clientId;

    // Aggiorna sia il clientId interno che quello nel context
    this.clientId = newClientId;
    this.gameContext.localClientId = newClientId as ClientId;

    // 🔄 CRITICAL: Aggiorna clientId anche nei manager che lo usano
    if (this.playerDataManager) {
      this.playerDataManager.clientId = newClientId;
    }
    if (this.stateManager) {
      this.stateManager.clientId = newClientId;
    }
    if (this.connectionManager) {
      this.connectionManager.setClientId(newClientId);
    }
    if (this.combatManager) {
      // Aggiorna clientId anche nel combat manager
      (this.combatManager as any).clientId = newClientId;
    }

    // 🔄 CRITICAL: Se il clientId è cambiato, trasferisci eventuali aggiornamenti posizione pendenti
    // Questo previene il "doppio player" quando il clientId viene aggiornato dal welcome
    if (oldClientId !== newClientId) {
      // Qui dovremmo notificare al server di trasferire eventuali aggiornamenti posizione
      // dal vecchio clientId al nuovo clientId, ma per ora ci affidiamo al rate limiting
      // e alla pulizia automatica della queue nel server
    }
    if (this.positionSyncManager) {
      this.positionSyncManager.clientId = newClientId;
    }
    if (this.chatManager) {
      this.chatManager.clientId = newClientId;
    }

    // 🔴 CRITICAL: Segnala che ora siamo "ready" - possiamo iniziare a inviare messaggi
    this.hasReceivedWelcome = true;
  }

  /**
   * Check if client has received welcome and is ready to send messages
   */
  isReady(): boolean {
    return this.hasReceivedWelcome;
  }

  requestSkillUpgrade(upgradeType: 'hp' | 'shield' | 'speed' | 'damage'): void {
    this.playerDataManager.requestSkillUpgrade(upgradeType);
  }

  sendChatMessage(content: string): void {
    this.chatManager.sendChatMessage(content);
  }

  setAudioSystem(audioSystem: any): void {
    this.audioSystem = audioSystem;
    this.eventSystem.initializeExternalSystems(audioSystem, this.uiSystem, this.logSystem, this.economySystem);
  }

  getAudioSystem(): any {
    return this.audioSystem || null;
  }

  getMessageRouter(): MessageRouter {
    return this.messageRouter;
  }


  disconnect(): void {
    this.connectionManager.disconnect();
    this.socket = null;
  }

  setLogSystem(logSystem: any): void {
    this.logSystem = logSystem;
    this.eventSystem.initializeExternalSystems(this.audioSystem, this.uiSystem, this.logSystem, this.economySystem);
  }

  resetAllUpgradeProgress(): void {
    if (this.uiSystem && typeof this.uiSystem.resetAllUpgradeProgress === 'function') {
      this.uiSystem.resetAllUpgradeProgress();
    }
  }

  getLogSystem(): any {
    return this.logSystem;
  }

  setUiSystem(uiSystem: any): void {
    this.uiSystem = uiSystem;
    this.eventSystem.initializeExternalSystems(this.audioSystem, this.uiSystem, this.logSystem, this.economySystem);
  }

  getUiSystem(): any {
    return this.uiSystem;
  }

  setEconomySystem(economySystem: any): void {
    this.economySystem = economySystem;
    this.eventSystem.initializeExternalSystems(this.audioSystem, this.uiSystem, this.logSystem, this.economySystem);
  }

  getEconomySystem(): any {
    return this.economySystem;
  }

  setRewardSystem(rewardSystem: any): void {
    this.rewardSystem = rewardSystem;
  }

  getRewardSystem(): any {
    return this.rewardSystem;
  }

  /**
   * Configura il DeathPopupManager negli handler appropriati
   */
  configureDeathPopupManager(): void {
    if (this.messageRouter) {
      const handlers = (this.messageRouter as any).handlers || [];

      // Trova e configura EntityDestroyedHandler
      const entityDestroyedHandler = handlers.find((handler: any) =>
        handler.constructor?.name === 'EntityDestroyedHandler' ||
        handler.messageType === MESSAGE_TYPES.ENTITY_DESTROYED
      );

      if (entityDestroyedHandler && typeof entityDestroyedHandler.setDeathPopupManager === 'function') {
        entityDestroyedHandler.setDeathPopupManager(this.deathPopupManager);
      }

      // Trova e configura PlayerRespawnHandler
      const playerRespawnHandler = handlers.find((handler: any) =>
        handler.constructor?.name === 'PlayerRespawnHandler'
      );
      if (playerRespawnHandler && typeof playerRespawnHandler.setDeathPopupManager === 'function') {
        playerRespawnHandler.setDeathPopupManager(this.deathPopupManager);
      }
    }

    // Imposta il callback di respawn nel DeathPopupManager
    this.deathPopupManager.setOnRespawnCallback(() => {
      this.requestPlayerRespawn();
    });
  }

  /**
   * Restituisce il DeathPopupManager
   */
  getDeathPopupManager(): DeathPopupManager {
    return this.deathPopupManager;
  }

  /**
   * Restituisce il PlayerPositionTracker
   */
  getPositionTracker(): PlayerPositionTracker {
    return this.positionTracker;
  }

  /**
   * Richiede il respawn del player al server
   */
  private requestPlayerRespawn(): void {
    const message = {
      type: 'player_respawn_request',
      clientId: this.clientId,
      playerId: this.gameContext.authId
    };

    this.sendMessage(message);

    // Nasconde il popup immediatamente dopo aver inviato la richiesta
    this.deathPopupManager.hideDeathPopup();
  }

  initialize(): Promise<void> {
    return this.initManager.initialize();
  }

  markAsInitialized(): void {
    this.initManager.markAsInitialized();
  }

  isSystemInitialized(): boolean {
    return this.initManager.isSystemInitialized();
  }

  setOnPlayerIdReceived(callback: (playerDbId: PlayerDbId) => void): void {
    this.onPlayerIdReceived = callback;
  }

  getRateLimiterStats() {
    return this.rateLimiter.getStats();
  }

  requestPlayerData(playerUuid: PlayerUuid): void {
    this.playerDataManager.requestPlayerData(playerUuid);
  }

  destroy(): void {
    // Cleanup managers
    this.authManager.destroy();
    this.stateManager.destroy();
    this.initManager.destroy();

    // Disconnect from server
    this.connectionManager.disconnect();

    // Clear callbacks
    this.onPlayerIdReceived = undefined;
  }
}
