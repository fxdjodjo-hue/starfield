import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { GameContext } from '../../infrastructure/engine/GameContext';

/**
 * Audio Notification System - gestisce notifiche audio dal server
 * Estratto da ClientNetworkSystem per separare responsabilità audio
 */
export class AudioNotificationSystem extends BaseSystem {
  private gameContext: GameContext;
  private audioSystem: any = null;

  constructor(ecs: ECS, gameContext: GameContext) {
    super(ecs);
    this.gameContext = gameContext;
  }

  /**
   * Imposta riferimento all'audio system
   */
  setAudioSystem(audioSystem: any): void {
    this.audioSystem = audioSystem;
  }

  /**
   * Gestisce messaggi che richiedono notifiche audio
   */
  handleAudioMessage(message: any): void {
    if (!this.audioSystem) return;

    try {
      switch (message.type) {
        case 'entity_damaged':
          // Suono danno entity
          this.audioSystem.playSound('entity_damage', 0.3, false, true);
          break;

        case 'entity_destroyed':
          // Suono distruzione entity
          this.audioSystem.playSound('entity_destroyed', 0.4, false, true);
          break;

        case 'explosion_created':
          // Suono esplosione già gestito da ExplosionSystem
          break;

        case 'rewards_earned':
          // Suono ricompensa
          this.audioSystem.playSound('reward', 0.5, false, true);
          break;

        default:
          // Nessuna notifica audio per questo messaggio
          break;
      }
    } catch (error) {
      console.warn('[AudioNotificationSystem] Error playing audio:', error);
    }
  }

  /**
   * Cleanup risorse
   */
  destroy(): void {
    this.audioSystem = null;
  }
}