import { ECS } from '../../../../infrastructure/ecs/ECS';
import { NumberFormatter } from '../../../../core/utils/ui/NumberFormatter';
import { PlayerSystem } from '../../../../systems/player/PlayerSystem';
import { Health } from '../../../../entities/combat/Health';
import { Shield } from '../../../../entities/combat/Shield';
import { Damage } from '../../../../entities/combat/Damage';
import { PlayerUpgrades } from '../../../../entities/player/PlayerUpgrades';
import { Credits } from '../../../../entities/currency/Credits';
import { Cosmos } from '../../../../entities/currency/Cosmos';
import { Inventory } from '../../../../entities/player/Inventory';
import { getPlayerDefinition } from '../../../../config/PlayerConfig';

/**
 * Manages player statistics rendering and updates
 */
export class UpgradeStatsManager {
  // Element cache to avoid per-frame querySelector calls
  private elementCache: Map<string, HTMLElement> = new Map();
  // Value cache to avoid redundant DOM updates (memoization)
  private lastValues: Map<string, string> = new Map();

  constructor(
    private readonly ecs: ECS,
    private readonly playerSystem: PlayerSystem | null,
    private readonly container: HTMLElement | null,
    private readonly calculateCost: (statType: string, currentLevel: number) => { credits: number, cosmos: number }
  ) { }

  /**
   * Helper to get or cache an element
   */
  private getElement(selector: string): HTMLElement | null {
    if (!this.container) return null;
    let element = this.elementCache.get(selector);
    if (!element) {
      element = this.container.querySelector(selector) as HTMLElement;
      if (element) {
        this.elementCache.set(selector, element);
      }
    }
    return element;
  }

  /**
   * Updates text content only if it has changed
   */
  private updateText(selector: string, value: string): void {
    const element = this.getElement(selector);
    if (element && this.lastValues.get(selector) !== value) {
      element.textContent = value;
      this.lastValues.set(selector, value);
    }
  }

  /**
   * Gets the initial value of a statistic
   */
  getInitialStatValue(statType: string): string {
    const playerDef = getPlayerDefinition();

    switch (statType) {
      case 'hp':
        return NumberFormatter.format(playerDef.stats.health);
      case 'shield':
        return playerDef.stats.shield ? NumberFormatter.format(playerDef.stats.shield) : '0';
      case 'speed':
        return `${NumberFormatter.format(playerDef.stats.speed)} u/s`;
      case 'damage':
        return NumberFormatter.format(playerDef.stats.damage);
      case 'missileDamage':
        return NumberFormatter.format(playerDef.stats.missileDamage || 100);
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
    const inventory = this.ecs.getComponent(playerEntity, Inventory) as Inventory | undefined;
    const playerUpgrades = this.ecs.getComponent(playerEntity, PlayerUpgrades);

    // Ottieni configurazione giocatore per limiti massimi
    const playerDef = getPlayerDefinition();

    // Update statistics in upgrade cards
    if (playerUpgrades) {
      // Show real HP from server (already includes upgrades)
      if (health) {
        this.updateText('.stat-current-hp', NumberFormatter.format(health.max));
      }

      // Show real Shield from server (already includes upgrades)
      if (shield) {
        this.updateText('.stat-current-shield', NumberFormatter.format(shield.max));
      }

      // Update speed with bonus from upgrades and items
      const speedBonus = playerUpgrades.getSpeedBonus(inventory);
      const calculatedSpeed = Math.floor(playerDef.stats.speed * speedBonus);
      this.updateText('.stat-current-speed', `${NumberFormatter.format(calculatedSpeed)} u/s`);

      // Calculate and update damage with bonus from upgrades and items
      if (damage && playerDef.stats.damage) {
        const damageBonus = playerUpgrades.getDamageBonus(inventory);
        const calculatedDamage = Math.floor(playerDef.stats.damage * damageBonus);
        this.updateText('.stat-current-damage', NumberFormatter.format(calculatedDamage));
      }

      // Update missile damage with bonus from upgrades and items
      const missileDamageBonus = playerUpgrades.getMissileDamageBonus(inventory);
      const baseMissileDamage = playerDef.stats.missileDamage || 100;
      const calculatedMissileDamage = Math.floor(baseMissileDamage * missileDamageBonus);
      this.updateText('.stat-current-missileDamage', NumberFormatter.format(calculatedMissileDamage));

      // Update displayed levels
      this.updateText('.stat-level-hp', `Lv.${playerUpgrades.hpUpgrades}`);
      this.updateText('.stat-level-shield', `Lv.${playerUpgrades.shieldUpgrades}`);
      this.updateText('.stat-level-speed', `Lv.${playerUpgrades.speedUpgrades}`);
      this.updateText('.stat-level-damage', `Lv.${playerUpgrades.damageUpgrades}`);
      this.updateText('.stat-level-missileDamage', `Lv.${playerUpgrades.missileDamageUpgrades}`);

      // Update upgrade button states (enabled/disabled)
      this.updateButtons(playerUpgrades, playerDef.upgrades, this.calculateCost);
    }

    // Update current resources in the panel
    const credits = this.ecs.getComponent(playerEntity, Credits);
    const cosmos = this.ecs.getComponent(playerEntity, Cosmos);

    // Update current credits
    if (credits) {
      const creditsAmount = credits.credits || 0;
      this.updateText('.current-credits', NumberFormatter.format(creditsAmount));
    }

    // Update current cosmos
    if (cosmos) {
      const cosmosAmount = cosmos.cosmos || 0;
      this.updateText('.current-cosmos', NumberFormatter.format(cosmosAmount));
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
      damage: '.upgrade-damage',
      missileDamage: '.upgrade-missileDamage'
    };

    const uiContainer = this.container;
    Object.entries(containerClasses).forEach(([statType, containerClass]) => {
      const currentValue = playerUpgrades[`${statType}Upgrades` as keyof PlayerUpgrades] as number;
      const maxValue = upgradeLimits[`max${statType.charAt(0).toUpperCase() + statType.slice(1)}Upgrades`];

      // Find the container and then the internal button
      const container = this.getElement(containerClass);
      if (!container) return;

      const upgradeButton = container.querySelector('.ui-upgrade-btn') as HTMLElement;
      if (!upgradeButton) return;

      // Find the cost label
      const costLabel = container.querySelector('.upgrade-cost-label') as HTMLElement;

      if (currentValue >= maxValue) {
        // Limit reached - disable button
        if (upgradeButton.textContent !== 'MAX') {
          upgradeButton.style.opacity = '0.5';
          upgradeButton.style.pointerEvents = 'none';
          upgradeButton.style.background = 'rgba(100, 100, 100, 0.3)';
          upgradeButton.style.borderColor = 'rgba(100, 100, 100, 0.5)';
          upgradeButton.textContent = 'MAX';
        }

        // Nascondi il costo
        if (costLabel && costLabel.style.display !== 'none') {
          costLabel.style.display = 'none';
        }
      } else {
        // Not at limit - enable button and update costs
        if (upgradeButton.textContent !== 'UPGRADE') {
          upgradeButton.style.opacity = '1';
          upgradeButton.style.pointerEvents = 'auto';
          upgradeButton.textContent = 'UPGRADE';
        }

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
            const creditsText = `${NumberFormatter.format(newCost.credits)} Credits`;
            if (creditsLine.textContent !== creditsText) {
              creditsLine.textContent = creditsText;
            }
            if (creditsLine.style.display !== 'block') creditsLine.style.display = 'block';
          } else if (creditsLine && creditsLine.style.display !== 'none') {
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
            const cosmosText = `${NumberFormatter.format(newCost.cosmos)} Cosmos`;
            if (cosmosLine.textContent !== cosmosText) {
              cosmosLine.textContent = cosmosText;
            }
            if (cosmosLine.style.display !== 'block') cosmosLine.style.display = 'block';
          } else if (cosmosLine && cosmosLine.style.display !== 'none') {
            cosmosLine.style.display = 'none';
          }

          if (costLabel.style.display !== 'flex') costLabel.style.display = 'flex';
        }
      }
    });
  }

  /**
   * Updates the player's physical statistics (HP, Shield, Speed) after an upgrade
   * @deprecated Questo metodo non è più utilizzato.
   */
  updatePlayerPhysicalStats(): void {
    if (!this.playerSystem) return;
    const playerEntity = this.playerSystem.getPlayerEntity();
    if (!playerEntity) return;

    const playerDef = getPlayerDefinition();
    const health = this.ecs.getComponent(playerEntity, Health);
    const shield = this.ecs.getComponent(playerEntity, Shield);
    const damage = this.ecs.getComponent(playerEntity, Damage);
    const playerUpgrades = this.ecs.getComponent(playerEntity, PlayerUpgrades);

    if (!playerUpgrades) return;

    // Update HP
    if (health) {
      const newMaxHP = Math.floor(playerDef.stats.health * playerUpgrades.getHPBonus());
      const currentHPPercent = health.current / health.max;
      health.max = newMaxHP;
      health.current = Math.floor(newMaxHP * currentHPPercent);
    }

    // Update Shield
    if (shield && playerDef.stats.shield) {
      const newMaxShield = Math.floor(playerDef.stats.shield * playerUpgrades.getShieldBonus());
      const currentShieldPercent = shield.current / shield.max;
      shield.max = newMaxShield;
      shield.current = Math.floor(newMaxShield * currentShieldPercent);
    }

    // Update Damage
    if (damage) {
      const bonus = playerUpgrades.getDamageBonus();
      const newDamage = Math.floor(playerDef.stats.damage * bonus);
      damage.damage = newDamage;
    }
  }
}
