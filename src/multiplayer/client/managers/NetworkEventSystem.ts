import { ECS } from '../../../infrastructure/ecs/ECS';
import { GameContext } from '../../../infrastructure/engine/GameContext';
import { ExplosionSystem } from '../../../systems/client/ExplosionSystem';
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
  private explosionSystem: ExplosionSystem;
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
    this.explosionSystem = new ExplosionSystem(ecs, gameContext);
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
    console.log('💥 [EVENT] Explosion created:', data);
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
   * Cleanup risorse
   */
  destroy(): void {
    // Cleanup any resources if needed
    console.log('🧹 [EVENT] NetworkEventSystem cleanup completed');
  }
}