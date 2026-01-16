import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { RemotePlayerSystem } from '../../systems/multiplayer/RemotePlayerSystem';
import { PlayerSystem } from '../../systems/player/PlayerSystem';
import { RemoteNpcSystem } from '../../systems/multiplayer/RemoteNpcSystem';
import { RemoteProjectileSystem } from '../../systems/multiplayer/RemoteProjectileSystem';

// Modular architecture components
import { NetworkConnectionManager } from './managers/NetworkConnectionManager';
import { NetworkEventSystem } from './managers/NetworkEventSystem';
import { RemoteEntityManager } from './managers/RemoteEntityManager';
import { RateLimiter, RATE_LIMITS } from './managers/RateLimiter';
import { NetworkStateManager, ConnectionState } from './managers/NetworkStateManager';
import { NetworkInitializationManager } from './managers/NetworkInitializationManager';
import { NetworkAuthenticationManager } from './managers/NetworkAuthenticationManager';
import { NetworkPositionSyncManager } from './managers/NetworkPositionSyncManager';
import { NetworkCombatManager } from './managers/NetworkCombatManager';
import { NetworkPlayerDataManager } from './managers/NetworkPlayerDataManager';
import { NetworkChatManager } from './managers/NetworkChatManager';
import { RhythmicAnimationManager } from '../../utils/helpers/RhythmicAnimationManager';

// New modular components
import { MessageRouter } from './handlers/MessageRouter';
import { RemotePlayerManager } from './managers/RemotePlayerManager';
import { PlayerPositionTracker } from './managers/PlayerPositionTracker';
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
  private logSystem: any = null;
  private uiSystem: any = null;
  private economySystem: any = null;
  private rewardSystem: any = null;

  // Modular architecture components
  private readonly connectionManager: NetworkConnectionManager;
  private readonly eventSystem: NetworkEventSystem;
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
  private readonly rhythmicAnimationManager: RhythmicAnimationManager;

  // Legacy components (to be phased out)
  public readonly remotePlayerManager: RemotePlayerManager;
  private readonly messageRouter: MessageRouter;

  // System references
  private remotePlayerSystem: RemotePlayerSystem;
  private remoteNpcSystem: RemoteNpcSystem | null = null;
  private remoteProjectileSystem: RemoteProjectileSystem | null = null;
  private playerSystem: PlayerSystem | null = null;
  private ecs: ECS | null = null;

  // Player info
  private playerId?: number;

  // Callbacks for external systems
  private onPlayerIdReceived?: (playerId: number) => void;

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
      this.clientId
    );

    // Initialize initialization manager
    this.messageRouter = new MessageRouter();
    this.initManager = new NetworkInitializationManager(
      this.messageRouter,
      this.connectionManager,
      this.eventSystem,
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
      this.clientId
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
      () => this.isConnected()
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

    // Initialize rhythmic animation manager (per pattern ritmico animazione visiva)
    this.rhythmicAnimationManager = new RhythmicAnimationManager();

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

  setHasReceivedWelcome(received: boolean): void {
    this.positionSyncManager.setHasReceivedWelcome(received);
  }

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

      // Route all other messages to appropriate handlers
      if (import.meta.env.DEV && message.type === 'chat_message') {
        console.log('[ClientNetworkSystem] Routing chat message:', message);
      }
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
    const socket = await this.stateManager.connect();
    this.socket = socket;
    return Promise.resolve();
  }


  update(deltaTime: number): void {
    if (!this.connectionManager.isConnectionActive()) {
      return;
    }

    const currentPosition = this.positionSyncManager.getLocalPlayerPosition();
    this.tickManager.bufferPositionUpdate(currentPosition);
    this.tickManager.update(deltaTime);
  }

  private sendMessage(message: NetMessage): void {
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
    }
  }

  setEcs(ecs: ECS): void {
    this.ecs = ecs;
  }
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

  async connectToServer(): Promise<void> {
    try {
      await this.connect();
    } catch (error) {
      console.error(`❌ [CLIENT] Connection failed:`, error);
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

  getRhythmicAnimationManager(): RhythmicAnimationManager {
    return this.rhythmicAnimationManager;
  }

  getECS(): ECS | null {
    return this.ecs;
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
    this.combatManager.sendProjectileFired(data);
  }

  getLocalClientId(): string {
    return this.clientId;
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
    return this.audioSystem || this.gameContext?.audioSystem || null;
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

  initialize(): Promise<void> {
    return this.initManager.initialize();
  }

  markAsInitialized(): void {
    this.initManager.markAsInitialized();
  }

  isSystemInitialized(): boolean {
    return this.initManager.isSystemInitialized();
  }

  setOnPlayerIdReceived(callback: (playerId: number) => void): void {
    this.onPlayerIdReceived = callback;
  }

  getRateLimiterStats() {
    return this.rateLimiter.getStats();
  }

  requestPlayerData(playerId: string): void {
    this.playerDataManager.requestPlayerData(playerId);
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
