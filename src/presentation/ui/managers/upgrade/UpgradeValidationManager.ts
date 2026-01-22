import { ECS } from '../../../../infrastructure/ecs/ECS';
import { PlayerSystem } from '../../../../systems/player/PlayerSystem';
import { PlayerUpgrades } from '../../../../entities/player/PlayerUpgrades';

/**
 * Manages upgrade validation, cost calculation, and upgrade state
 */
export class UpgradeValidationManager {
  private upgradeInProgress: { [key: string]: boolean } = {};

  constructor(
    private readonly ecs: ECS,
    private readonly playerSystem: PlayerSystem | null
  ) {}

  /**
   * Calculates the cost of an upgrade based on current level
   */
  calculateUpgradeCost(statType: string, currentLevel: number): { credits: number, cosmos: number } {
    const baseCosts = {
      hp: { credits: 5000, cosmos: 10 },
      shield: { credits: 3000, cosmos: 5 },
      speed: { credits: 8000, cosmos: 15 },
      damage: { credits: 10000, cosmos: 20 }
    };

    const baseCost = baseCosts[statType as keyof typeof baseCosts];
    
    // Moltiplicatore crescente basato sul livello (cresce del 15% per livello)
    const levelMultiplier = 1 + (currentLevel * 0.15);

    if (currentLevel < 20) {
      // Fase 1: Solo crediti (primi 20 livelli) - costo crescente
      const credits = Math.floor(baseCost.credits * levelMultiplier);
      return { credits, cosmos: 0 };
    } else if (currentLevel < 40) {
      // Fase 2: Crediti + Cosmos (livelli 21-40) - entrambi crescenti
      const credits = Math.floor(baseCost.credits * levelMultiplier);
      const cosmos = Math.floor(baseCost.cosmos * (1 + (currentLevel - 20) * 0.1));
      return { credits, cosmos };
    } else {
      // Fase 3: Solo Cosmos (livello 41+) - cosmos crescente più velocemente
      const cosmos = Math.floor(baseCost.cosmos * 2 * (1 + (currentLevel - 40) * 0.2));
      return { credits: 0, cosmos };
    }
  }

  /**
   * Checks if an upgrade is currently in progress
   */
  isUpgradeInProgress(statType: 'hp' | 'shield' | 'speed' | 'damage'): boolean {
    return this.upgradeInProgress?.[statType] || false;
  }

  /**
   * Sets the progress state of an upgrade
   */
  setUpgradeInProgress(statType: 'hp' | 'shield' | 'speed' | 'damage', inProgress: boolean): void {
    if (!this.upgradeInProgress) {
      this.upgradeInProgress = {};
    }
    this.upgradeInProgress[statType] = inProgress;
  }

  /**
   * Resets all upgrade progress states
   */
  resetUpgradeProgress(): void {
    this.upgradeInProgress = {};
  }

  /**
   * Rollback di un upgrade locale se la richiesta al server fallisce
   */
  rollbackUpgrade(statType: 'hp' | 'shield' | 'speed' | 'damage'): void {
    const playerEntity = this.playerSystem?.getPlayerEntity();
    if (!playerEntity) return;

    const playerUpgrades = this.ecs.getComponent(playerEntity, PlayerUpgrades);
    if (!playerUpgrades) return;

    // Rollback dell'upgrade specifico
    switch (statType) {
      case 'hp':
        playerUpgrades.rollbackHP();
        break;
      case 'shield':
        playerUpgrades.rollbackShield();
        break;
      case 'speed':
        playerUpgrades.rollbackSpeed();
        break;
      case 'damage':
        playerUpgrades.rollbackDamage();
        break;
    }
  }
}
