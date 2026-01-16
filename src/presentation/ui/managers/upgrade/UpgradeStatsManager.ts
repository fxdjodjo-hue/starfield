import { ECS } from '../../../../infrastructure/ecs/ECS';
import { PlayerSystem } from '../../../../systems/player/PlayerSystem';
import { Health } from '../../../../entities/combat/Health';
import { Shield } from '../../../../entities/combat/Shield';
import { Damage } from '../../../../entities/combat/Damage';
import { PlayerUpgrades } from '../../../../entities/player/PlayerUpgrades';
import { Credits, Cosmos } from '../../../../entities/currency/Currency';
import { getPlayerDefinition } from '../../../../config/PlayerConfig';

/**
 * Manages player statistics rendering and updates
 */
export class UpgradeStatsManager {
  constructor(
    private readonly ecs: ECS,
    private readonly playerSystem: PlayerSystem | null,
    private readonly container: HTMLElement | null,
    private readonly calculateCost: (statType: string, currentLevel: number) => { credits: number, cosmos: number }
  ) {}

  /**
   * Gets the initial value of a statistic
   */
  getInitialStatValue(statType: string): string {
    const playerDef = getPlayerDefinition();

    switch (statType) {
      case 'hp':
        return `${playerDef.stats.health.toLocaleString()}`;
      case 'shield':
        return playerDef.stats.shield ? `${playerDef.stats.shield.toLocaleString()}` : '0';
      case 'speed':
        return `${playerDef.stats.speed} u/s`;
      default:
        return '0';
    }
  }

  /**
   * Updates statistics from the player
   */
  updateStats(): void {
    if (!this.container || !this.playerSystem) {
      return;
    }

    const playerEntity = this.playerSystem.getPlayerEntity();
    if (!playerEntity) return;

    // Ottieni componenti del giocatore
    const health = this.ecs.getComponent(playerEntity, Health);
    const shield = this.ecs.getComponent(playerEntity, Shield);
    const damage = this.ecs.getComponent(playerEntity, Damage);
    const playerUpgrades = this.ecs.getComponent(playerEntity, PlayerUpgrades);

    // Ottieni configurazione giocatore per limiti massimi
    const playerDef = getPlayerDefinition();

    // Update statistics in upgrade cards
    if (playerUpgrades) {
      // Show real HP from server (already includes upgrades)
      if (health) {
        const hpValue = this.container.querySelector('.stat-current-hp') as HTMLElement;
        if (hpValue) {
          hpValue.textContent = `${health.max.toLocaleString()}`;
        }
      }

      // Show real Shield from server (already includes upgrades)
      if (shield) {
        const shieldValue = this.container.querySelector('.stat-current-shield') as HTMLElement;
        if (shieldValue) {
          shieldValue.textContent = `${shield.max.toLocaleString()}`;
        }
      }

      // Update speed with bonus from upgrades
      const speedBonus = playerUpgrades.getSpeedBonus();
      const calculatedSpeed = Math.floor(playerDef.stats.speed * speedBonus);

      const speedValue = this.container.querySelector('.stat-current-speed') as HTMLElement;
      if (speedValue) {
        speedValue.textContent = `${calculatedSpeed} u/s`;
      }

      // Calculate and update damage with bonus from upgrades (same method as applyPlayerUpgrades)
      if (damage && playerDef.stats.damage) {
        const damageBonus = playerUpgrades.getDamageBonus();
        const calculatedDamage = Math.floor(playerDef.stats.damage * damageBonus);

        const damageValue = this.container.querySelector('.stat-current-damage') as HTMLElement;
        if (damageValue) {
          damageValue.textContent = calculatedDamage.toString();
        }
      }

      // Update displayed levels
      const hpLevel = this.container.querySelector('.stat-level-hp') as HTMLElement;
      if (hpLevel) hpLevel.textContent = `Lv.${playerUpgrades.hpUpgrades}`;
      
      const shieldLevel = this.container.querySelector('.stat-level-shield') as HTMLElement;
      if (shieldLevel) shieldLevel.textContent = `Lv.${playerUpgrades.shieldUpgrades}`;
      
      const speedLevel = this.container.querySelector('.stat-level-speed') as HTMLElement;
      if (speedLevel) speedLevel.textContent = `Lv.${playerUpgrades.speedUpgrades}`;
      
      const damageLevel = this.container.querySelector('.stat-level-damage') as HTMLElement;
      if (damageLevel) damageLevel.textContent = `Lv.${playerUpgrades.damageUpgrades}`;

      // Update upgrade button states (enabled/disabled)
      this.updateButtons(playerUpgrades, playerDef.upgrades, this.calculateCost);
    }

    // Update current resources in the panel
    if (this.playerSystem) {
      const playerEntity = this.playerSystem.getPlayerEntity();
      if (playerEntity) {
        const credits = this.ecs.getComponent(playerEntity, Credits);
        const cosmos = this.ecs.getComponent(playerEntity, Cosmos);

        // Update current credits
        if (credits) {
          const creditsValue = this.container.querySelector('.current-credits') as HTMLElement;
          if (creditsValue) {
            const creditsAmount = credits.credits || 0;
            creditsValue.textContent = creditsAmount.toLocaleString();
          }
        }

        // Update current cosmos
        if (cosmos) {
          const cosmosValue = this.container.querySelector('.current-cosmos') as HTMLElement;
          if (cosmosValue) {
            const cosmosAmount = cosmos.cosmos || 0;
            cosmosValue.textContent = cosmosAmount.toString();
          }
        }
      }
    }
  }

  /**
   * Updates upgrade button states based on maximum limits and costs
   */
  updateButtons(
    playerUpgrades: PlayerUpgrades,
    upgradeLimits: any,
    calculateCost: (statType: string, currentLevel: number) => { credits: number, cosmos: number }
  ): void {
    if (!this.container) return;

    // Map of containers by upgrade type
    const containerClasses = {
      hp: '.upgrade-hp',
      shield: '.upgrade-shield',
      speed: '.upgrade-speed',
      damage: '.upgrade-damage'
    };

    Object.entries(containerClasses).forEach(([statType, containerClass]) => {
      const currentValue = playerUpgrades[`${statType}Upgrades` as keyof PlayerUpgrades] as number;
      const maxValue = upgradeLimits[`max${statType.charAt(0).toUpperCase() + statType.slice(1)}Upgrades`];

      // Find the container and then the internal button
      const container = this.container.querySelector(containerClass) as HTMLElement;
      if (!container) return;

      const upgradeButton = container.querySelector('.ui-upgrade-btn') as HTMLElement;
      if (!upgradeButton) return;

      // Find the cost label
      const costLabel = container.querySelector('.upgrade-cost-label') as HTMLElement;

      if (currentValue >= maxValue) {
        // Limit reached - disable button
        upgradeButton.style.opacity = '0.5';
        upgradeButton.style.pointerEvents = 'none';
        upgradeButton.style.background = 'rgba(100, 100, 100, 0.3)';
        upgradeButton.style.borderColor = 'rgba(100, 100, 100, 0.5)';
        upgradeButton.textContent = 'MAX';

        // Nascondi il costo
        if (costLabel) {
          costLabel.style.display = 'none';
        }
      } else {
        // Not at limit - enable button and update costs
        upgradeButton.style.opacity = '1';
        upgradeButton.style.pointerEvents = 'auto';
        upgradeButton.textContent = 'UPGRADE';

        // Update the cost
        if (costLabel) {
          const newCost = calculateCost(statType, currentValue);
          
          // Update or create the credits line
          let creditsLine = costLabel.querySelector('.cost-credits') as HTMLElement;
          if (newCost.credits > 0) {
            if (!creditsLine) {
              creditsLine = document.createElement('div');
              creditsLine.className = 'cost-credits';
              creditsLine.style.cssText = `font-size: 11px; color: #fbbf24; font-weight: 500;`;
              const cosmosLine = costLabel.querySelector('.cost-cosmos');
              if (cosmosLine) {
                costLabel.insertBefore(creditsLine, cosmosLine);
              } else {
                costLabel.appendChild(creditsLine);
              }
            }
            creditsLine.textContent = `${newCost.credits.toLocaleString()} Credits`;
            creditsLine.style.display = 'block';
          } else if (creditsLine) {
            creditsLine.style.display = 'none';
          }

          // Update or create the cosmos line
          let cosmosLine = costLabel.querySelector('.cost-cosmos') as HTMLElement;
          if (newCost.cosmos > 0) {
            if (!cosmosLine) {
              cosmosLine = document.createElement('div');
              cosmosLine.className = 'cost-cosmos';
              cosmosLine.style.cssText = `font-size: 11px; color: #a78bfa; font-weight: 500;`;
              costLabel.appendChild(cosmosLine);
            }
            cosmosLine.textContent = `${newCost.cosmos.toLocaleString()} Cosmos`;
            cosmosLine.style.display = 'block';
          } else if (cosmosLine) {
            cosmosLine.style.display = 'none';
          }

          costLabel.style.display = 'flex';
        }
      }
    });
  }

  /**
   * Updates the player's physical statistics (HP, Shield, Speed) after an upgrade
   * @deprecated Questo metodo non è più utilizzato. Mantenuto solo per backward compatibility.
   * Da rimuovere in versione futura.
   */
  updatePlayerPhysicalStats(): void {
    if (!this.playerSystem) return;
    const playerEntity = this.playerSystem.getPlayerEntity();
    if (!playerEntity) return;

    const playerDef = getPlayerDefinition();
    const playerUpgrades = this.ecs.getComponent(playerEntity, PlayerUpgrades);
    if (!playerUpgrades) return;

    // Update HP
    const health = this.ecs.getComponent(playerEntity, Health);
    if (health) {
      const newMaxHP = Math.floor(playerDef.stats.health * playerUpgrades.getHPBonus());
      const currentHPPercent = health.current / health.max;
      health.max = newMaxHP;
      health.current = Math.floor(newMaxHP * currentHPPercent);
    }

    // Update Shield
    const shield = this.ecs.getComponent(playerEntity, Shield);
    if (shield && playerDef.stats.shield) {
      const newMaxShield = Math.floor(playerDef.stats.shield * playerUpgrades.getShieldBonus());
      const currentShieldPercent = shield.current / shield.max;
      shield.max = newMaxShield;
      shield.current = Math.floor(newMaxShield * currentShieldPercent);
    }

    // Update Damage
    const damage = this.ecs.getComponent(playerEntity, Damage);
    if (damage) {
      const bonus = playerUpgrades.getDamageBonus();
      const newDamage = Math.floor(playerDef.stats.damage * bonus);
      damage.damage = newDamage;
    }

    // Speed is updated automatically by PlayerControlSystem
  }
}
