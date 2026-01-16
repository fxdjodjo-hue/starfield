import { ECS } from '../../../infrastructure/ecs/ECS';
import { GameContext } from '../../../infrastructure/engine/GameContext';
import { RemoteExplosionSystem } from '../../../systems/client/RemoteExplosionSystem';
import { AudioNotificationSystem } from '../../../systems/client/AudioNotificationSystem';
import { UINotificationSystem } from '../../../systems/client/UINotificationSystem';

/**
 * NetworkEventSystem - Gestisce eventi di rete e notifiche (audio/UI)
 * Refactored da ClientNetworkSystem per Separation of Concerns
 */
export class NetworkEventSystem {
  private ecs: ECS;
  private gameContext: GameContext;

  // Specialized subsystems
  private explosionSystem: RemoteExplosionSystem;
  private audioNotificationSystem: AudioNotificationSystem;
  private uiNotificationSystem: UINotificationSystem;

  // External system references
  private audioSystem: any = null;
  private uiSystem: any = null;
  private logSystem: any = null;
  private economySystem: any = null;
  private rewardSystem: any = null;

  constructor(ecs: ECS, gameContext: GameContext) {
    this.ecs = ecs;
    this.gameContext = gameContext;

    // Initialize specialized systems
    this.explosionSystem = new RemoteExplosionSystem(ecs, gameContext);
    this.audioNotificationSystem = new AudioNotificationSystem(ecs, gameContext);
    this.uiNotificationSystem = new UINotificationSystem(ecs, gameContext);
  }

  /**
   * Inizializza riferimenti ai sistemi esterni
   */
  initializeExternalSystems(audioSystem?: any, uiSystem?: any, logSystem?: any, economySystem?: any): void {
    this.audioSystem = audioSystem || null;
    this.uiSystem = uiSystem || null;
    this.logSystem = logSystem || null;
    this.economySystem = economySystem || null;

    // Propaga riferimenti ai sottosistemi
    if (this.audioSystem) {
      this.explosionSystem.setAudioSystem(this.audioSystem);
      this.audioNotificationSystem.setAudioSystem(this.audioSystem);
    }

    this.uiNotificationSystem.setUISystems(this.uiSystem, this.logSystem, this.economySystem);
  }

  /**
   * Gestisce creazione esplosione remota
   */
  async createRemoteExplosion(message: {
    explosionId: string;
    entityId: string;
    entityType: 'player' | 'npc';
    position: { x: number; y: number };
    explosionType: 'entity_death' | 'projectile_impact' | 'special';
  }): Promise<void> {
    await this.explosionSystem.createRemoteExplosion(message);
  }

  /**
   * Imposta frame precaricati per esplosioni
   */
  setPreloadedExplosionFrames(frames: HTMLImageElement[]): void {
    this.explosionSystem.setPreloadedExplosionFrames(frames);
  }

  /**
   * Invia notifica di esplosione creata al server
   */
  sendExplosionCreated(data: {
    explosionId: string;
    entityId: string;
    entityType: 'player' | 'npc';
    position: { x: number; y: number };
    explosionType: 'entity_death' | 'projectile_impact' | 'special';
  }): void {
    // TODO: This should be moved to a higher level component that has network access
  }

  /**
   * Resetta progress upgrade nell'UI
   */
  resetAllUpgradeProgress(): void {
    if (this.uiSystem && typeof this.uiSystem.resetAllUpgradeProgress === 'function') {
      this.uiSystem.resetAllUpgradeProgress();
    }
  }

  /**
   * Getter per sistemi esterni
   */
  getAudioSystem(): any {
    return this.audioSystem || this.gameContext?.audioSystem || null;
  }

  getUiSystem(): any {
    return this.uiSystem;
  }

  getLogSystem(): any {
    return this.logSystem;
  }

  getEconomySystem(): any {
    return this.economySystem;
  }

  getRewardSystem(): any {
    return this.rewardSystem;
  }

  /**
   * Imposta riferimento al RewardSystem
   */
  setRewardSystem(rewardSystem: any): void {
    this.rewardSystem = rewardSystem;
  }

  /**
   * Shows authentication error to user (requires UI system integration)
   */
  showAuthenticationError(message: string, disconnectCallback?: () => void): void {
    // Try to show error through UI system if available
    if (this.uiSystem && typeof this.uiSystem.showError === 'function') {
      this.uiSystem.showError('Authentication Error', message);
    } else {
      // Fallback: use browser alert (not ideal but better than silent failure)
      alert(`Authentication Error: ${message}`);
    }

    // Disconnect from server if callback provided
    if (disconnectCallback) {
      disconnectCallback();
    }
  }

  /**
   * Shows rate limiting notification to user
   */
  showRateLimitNotification(actionType: string, waitTime?: number): void {
    const messages = {
      'chat_message': 'Chat messages too frequent. Please try again in a few seconds.',
      'combat_action': 'Combat actions too frequent. Please slow down.',
      'position_update': 'Position updates too frequent.',
      'heartbeat': 'Unstable connection - heartbeat rate limited.'
    };

    const message = messages[actionType as keyof typeof messages] || `Action "${actionType}" rate limited. Please try again later.`;

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
   * Cleanup risorse
   */
  destroy(): void {
    // Cleanup any resources if needed
  }
}