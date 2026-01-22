import { ECS } from '../../../../infrastructure/ecs/ECS';
import { PlayerSystem } from '../../../../systems/player/PlayerSystem';
import { ClientNetworkSystem } from '../../../../multiplayer/client/ClientNetworkSystem';
import { PlayerUpgrades } from '../../../../entities/player/PlayerUpgrades';

/**
 * Manages upgrade actions (server requests)
 * Uses dependency injection for validation methods
 */
export class UpgradeActionManager {
  constructor(
    private readonly ecs: ECS,
    private readonly playerSystem: PlayerSystem | null,
    private readonly clientNetworkSystem: ClientNetworkSystem | null,
    private readonly isUpgradeInProgress: (statType: 'hp' | 'shield' | 'speed' | 'damage') => boolean,
    private readonly setUpgradeInProgress: (statType: 'hp' | 'shield' | 'speed' | 'damage', inProgress: boolean) => void
  ) {}

  /**
   * Acquista un upgrade per una statistica
   */
  requestUpgrade(statType: 'hp' | 'shield' | 'speed' | 'damage'): void {
    if (!this.playerSystem) {
      return;
    }

    const playerEntity = this.playerSystem.getPlayerEntity();
    if (!playerEntity) {
      return;
    }

    const playerUpgrades = this.ecs.getComponent(playerEntity, PlayerUpgrades);
    if (!playerUpgrades) {
      return;
    }

    // Check if we're already waiting for a server response for this upgrade
    if (this.isUpgradeInProgress(statType)) {
      return;
    }

    if (this.clientNetworkSystem) {
      // Marca l'upgrade come in corso
      this.setUpgradeInProgress(statType, true);

      this.clientNetworkSystem.requestSkillUpgrade(statType);

      // Timeout di sicurezza - se non riceviamo risposta entro 5 secondi, resettiamo
      setTimeout(() => {
        this.setUpgradeInProgress(statType, false);
      }, 5000);
    }
  }
}
