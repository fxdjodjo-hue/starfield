import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { GameContext } from '../../infrastructure/engine/GameContext';

/**
 * UI Notification System - gestisce aggiornamenti UI dal server
 * Estratto da ClientNetworkSystem per separare responsabilità UI
 */
export class UINotificationSystem extends BaseSystem {
  private gameContext: GameContext;
  private uiSystem: any = null;
  private logSystem: any = null;
  private economySystem: any = null;

  constructor(ecs: ECS, gameContext: GameContext) {
    super(ecs);
    this.gameContext = gameContext;
  }

  /**
   * Update method required by base System class
   * This system is event-driven, so no per-frame updates needed
   */
  update(_deltaTime: number): void {
    // Event-driven system - no per-frame updates
  }

  /**
   * Imposta riferimenti ai sistemi UI
   */
  setUISystems(uiSystem: any, logSystem: any, economySystem: any): void {
    this.uiSystem = uiSystem;
    this.logSystem = logSystem;
    this.economySystem = economySystem;
  }

  /**
   * Gestisce messaggi che richiedono aggiornamenti UI
   */
  handleUIMessage(message: any): void {
    try {
      switch (message.type) {
        case 'player_state_update':
          this.handlePlayerStateUpdate(message);
          break;

        case 'rewards_earned':
          this.handleRewardsEarned(message);
          break;

        case 'chat_message':
          this.handleChatMessage(message);
          break;

        case 'error':
          this.handleErrorMessage(message);
          break;

        default:
          // Nessun aggiornamento UI necessario
          break;
      }
    } catch (error) {
      console.warn('[UINotificationSystem] Error updating UI:', error);
    }
  }

  /**
   * Gestisce aggiornamenti stato player
   */
  private handlePlayerStateUpdate(message: any): void {
    if (this.uiSystem && typeof this.uiSystem.updatePlayerState === 'function') {
      this.uiSystem.updatePlayerState({
        inventory: message.inventory,
        upgrades: message.upgrades,
        health: message.health,
        maxHealth: message.maxHealth,
        shield: message.shield,
        maxShield: message.maxShield
      });
    }

    // Log dell'evento se presente
    if (this.logSystem && typeof this.logSystem.addLogEntry === 'function') {
      this.logSystem.addLogEntry(`Player state updated: ${message.source}`, 'info');
    }
  }

  /**
   * Gestisce ricompense guadagnate
   */
  private handleRewardsEarned(message: any): void {
    if (this.uiSystem && typeof this.uiSystem.showRewardsNotification === 'function') {
      this.uiSystem.showRewardsNotification(message.rewards);
    }

    if (this.logSystem && typeof this.logSystem.addLogEntry === 'function') {
      const rewards = message.rewards;
      this.logSystem.addLogEntry(
        `Rewards earned: ${rewards.credits} credits, ${rewards.experience} XP, ${rewards.honor} honor`,
        'success'
      );
    }
  }

  /**
   * Gestisce messaggi chat
   */
  private handleChatMessage(message: any): void {
    if (this.uiSystem && typeof this.uiSystem.addChatMessage === 'function') {
      this.uiSystem.addChatMessage({
        sender: message.senderName,
        content: message.content,
        timestamp: message.timestamp
      });
    }
  }

  /**
   * Gestisce messaggi errore
   */
  private handleErrorMessage(message: any): void {
    if (this.logSystem && typeof this.logSystem.addLogEntry === 'function') {
      this.logSystem.addLogEntry(`Server error: ${message.message}`, 'error');
    }
  }

  /**
   * Resetta progress upgrade nella UI
   */
  resetAllUpgradeProgress(): void {
    if (this.uiSystem && typeof this.uiSystem.resetAllUpgradeProgress === 'function') {
      this.uiSystem.resetAllUpgradeProgress();
    }
  }

  /**
   * Cleanup risorse
   */
  destroy(): void {
    this.uiSystem = null;
    this.logSystem = null;
    this.economySystem = null;
  }
}