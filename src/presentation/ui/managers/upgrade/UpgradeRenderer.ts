import { ECS } from '../../../../infrastructure/ecs/ECS';
import { PlayerSystem } from '../../../../systems/player/PlayerSystem';
import { PlayerUpgrades } from '../../../../entities/player/PlayerUpgrades';

/**
 * Manages UI rendering for upgrade panel components
 * Uses dependency injection to avoid circular dependencies
 */
export class UpgradeRenderer {
  constructor(
    private readonly ecs: ECS,
    private readonly playerSystem: PlayerSystem | null,
    private readonly calculateCost: (statType: string, currentLevel: number) => { credits: number, cosmos: number },
    private readonly getInitialStatValue: (statType: string) => string,
    private readonly getStatDescription: (statType: string) => string,
    private readonly onUpgradeClick: (upgradeType: 'hp' | 'shield' | 'speed' | 'damage' | 'missileDamage') => void,
    private readonly onShowExplanation: (statName: string, statType: string, buttonElement: HTMLElement) => void
  ) { }

  /**
   * Creates a statistics section
   */
  createStatsSection(title: string, stats: Array<{ label: string, icon: string, value: string, color: string, upgradeKey?: string }>): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 16px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    `;

    const sectionTitle = document.createElement('h3');
    sectionTitle.textContent = title;
    sectionTitle.style.cssText = `
      margin: 0 0 12px 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 16px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;

    section.appendChild(sectionTitle);

    const statsGrid = document.createElement('div');
    statsGrid.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    `;

    stats.forEach(stat => {
      const statCard = document.createElement('div');
      statCard.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.15);
        border-radius: 8px;
        border-left: 3px solid ${stat.color};
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
      `;

      const icon = document.createElement('span');
      icon.textContent = stat.icon;
      icon.style.cssText = `
        font-size: 16px;
        opacity: 0.8;
      `;

      const content = document.createElement('div');
      content.style.cssText = `
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
      `;

      const label = document.createElement('div');
      label.textContent = stat.label;
      label.style.cssText = `
        font-size: 11px;
        color: rgba(255, 255, 255, 0.7);
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      `;

      const value = document.createElement('div');
      value.textContent = stat.value;
      value.className = `stat-value stat-${stat.label.toLowerCase().replace(' ', '-')}`;
      value.style.cssText = `
        font-size: 13px;
        color: rgba(255, 255, 255, 0.9);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      `;

      content.appendChild(label);
      content.appendChild(value);

      statCard.appendChild(icon);
      statCard.appendChild(content);

      statsGrid.appendChild(statCard);
    });

    section.appendChild(statsGrid);
    return section;
  }

  /**
   * Creates the upgrade section with horizontal grid layout
   */
  createUpgradeSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 16px;
      box-sizing: border-box;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    `;

    // Griglia per le card degli upgrade (2x2) che occupa tutto lo spazio
    const upgradeGrid = document.createElement('div');
    upgradeGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: 12px;
      flex: 1;
      min-height: 0;
    `;

    // Ottieni i livelli correnti degli upgrade
    const playerEntity = this.playerSystem?.getPlayerEntity();
    const playerUpgrades = playerEntity ? this.ecs.getComponent(playerEntity, PlayerUpgrades) : null;

    const hpLevel = playerUpgrades ? playerUpgrades.hpUpgrades : 0;
    const shieldLevel = playerUpgrades ? playerUpgrades.shieldUpgrades : 0;
    const speedLevel = playerUpgrades ? playerUpgrades.speedUpgrades : 0;
    const damageLevel = playerUpgrades ? playerUpgrades.damageUpgrades : 0;
    const missileDamageLevel = playerUpgrades ? playerUpgrades.missileDamageUpgrades : 0;

    // Create the five upgrade cards
    const hpUpgrade = this.createUpgradeCard('Hull', '#10b981', 'hp', hpLevel);
    hpUpgrade.classList.add('upgrade-hp');
    const shieldUpgrade = this.createUpgradeCard('Shield', '#3b82f6', 'shield', shieldLevel);
    shieldUpgrade.classList.add('upgrade-shield');
    const speedUpgrade = this.createUpgradeCard('Speed', '#f59e0b', 'speed', speedLevel);
    speedUpgrade.classList.add('upgrade-speed');
    const damageUpgrade = this.createUpgradeCard('Weapons', '#ef4444', 'damage', damageLevel);
    damageUpgrade.classList.add('upgrade-damage');
    const missileUpgrade = this.createUpgradeCard('Missiles', '#ec4899', 'missileDamage', missileDamageLevel);
    missileUpgrade.classList.add('upgrade-missileDamage');

    upgradeGrid.appendChild(hpUpgrade);
    upgradeGrid.appendChild(shieldUpgrade);
    upgradeGrid.appendChild(speedUpgrade);
    upgradeGrid.appendChild(damageUpgrade);
    upgradeGrid.appendChild(missileUpgrade);

    section.appendChild(upgradeGrid);

    return section;
  }

  /**
   * Creates a compact card for an upgrade with description toggle
   */
  createUpgradeCard(statName: string, color: string, upgradeType: string, currentLevel: number = 0): HTMLElement {
    const card = document.createElement('div');
    card.className = 'upgrade-card-container';
    card.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      padding: 16px 12px;
      height: 100%;
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid ${color}30;
      border-radius: 8px;
      color: rgba(255, 255, 255, 0.9);
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      user-select: none;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
    `;

    card.addEventListener('mouseenter', () => {
      card.style.background = `rgba(255, 255, 255, 0.05)`;
      card.style.borderColor = color;
      card.style.transform = 'translateY(-1px)';
      card.style.boxShadow = `0 4px 12px ${color}20`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.background = `rgba(0, 0, 0, 0.2)`;
      card.style.borderColor = `${color}30`;
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'none';
    });

    // Contenuto normale (visibile di default)
    const normalContent = document.createElement('div');
    normalContent.className = 'card-normal-content';
    normalContent.style.cssText = `display: flex; flex-direction: column; align-items: center; gap: 4px;`;

    const nameEl = document.createElement('div');
    nameEl.textContent = statName;
    nameEl.style.cssText = `font-size: 16px; font-weight: 700; color: #fff;`;

    const levelEl = document.createElement('div');
    levelEl.className = `stat-level-${upgradeType}`;
    levelEl.textContent = `Lv.${currentLevel}`;
    levelEl.style.cssText = `font-size: 14px; color: ${color}; font-weight: 600;`;

    const valueEl = document.createElement('div');
    valueEl.className = `stat-current-${upgradeType}`;
    valueEl.textContent = this.getInitialStatValue(upgradeType);
    valueEl.style.cssText = `font-size: 12px; color: rgba(255, 255, 255, 0.6); font-variant-numeric: tabular-nums;`;

    normalContent.appendChild(nameEl);
    normalContent.appendChild(levelEl);
    normalContent.appendChild(valueEl);

    // Contenuto descrizione (nascosto di default)
    const descContent = document.createElement('div');
    descContent.className = 'card-desc-content';
    descContent.style.cssText = `display: none; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 4px;`;

    const descText = document.createElement('div');
    descText.textContent = this.getStatDescription(upgradeType);
    descText.style.cssText = `font-size: 14px; color: rgba(255, 255, 255, 0.95); text-align: center; line-height: 1.5; font-weight: 500; padding: 8px;`;

    descContent.appendChild(descText);

    // Cost shown above the button
    const cost = this.calculateCost(upgradeType, currentLevel);
    const costLabel = document.createElement('div');
    costLabel.className = 'upgrade-cost-label';
    costLabel.style.cssText = `
      margin-top: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    `;

    const costTitle = document.createElement('div');
    costTitle.className = 'cost-title';
    costTitle.textContent = 'Cost';
    costTitle.style.cssText = `
      font-size: 10px;
      color: rgba(255, 255, 255, 0.5);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;
    costLabel.appendChild(costTitle);

    if (cost.credits > 0) {
      const creditsLine = document.createElement('div');
      creditsLine.className = 'cost-credits';
      creditsLine.textContent = `${cost.credits.toLocaleString()} Credits`;
      creditsLine.style.cssText = `font-size: 11px; color: #fbbf24; font-weight: 500;`;
      costLabel.appendChild(creditsLine);
    }

    if (cost.cosmos > 0) {
      const cosmosLine = document.createElement('div');
      cosmosLine.className = 'cost-cosmos';
      cosmosLine.textContent = `${cost.cosmos.toLocaleString()} Cosmos`;
      cosmosLine.style.cssText = `font-size: 11px; color: #a78bfa; font-weight: 500;`;
      costLabel.appendChild(cosmosLine);
    }

    // Upgrade button
    const upgradeBtn = document.createElement('button');
    upgradeBtn.className = 'ui-upgrade-btn';
    upgradeBtn.textContent = 'UPGRADE';
    upgradeBtn.style.cssText = `
      margin-top: 6px;
      padding: 8px 20px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.9);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    upgradeBtn.addEventListener('mouseenter', () => {
      upgradeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
      upgradeBtn.style.borderColor = 'rgba(255, 255, 255, 0.5)';
    });

    upgradeBtn.addEventListener('mouseleave', () => {
      upgradeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      upgradeBtn.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    });

    upgradeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onUpgradeClick(upgradeType as 'hp' | 'shield' | 'speed' | 'damage' | 'missileDamage');
    });

    // Toggle contenuto al click
    card.dataset.showingDesc = 'false';
    card.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.ui-upgrade-btn')) {
        const showingDesc = card.dataset.showingDesc === 'true';
        card.dataset.showingDesc = (!showingDesc).toString();
        if (!showingDesc) {
          normalContent.style.display = 'none';
          descContent.style.display = 'flex';
          costLabel.style.display = 'none';
          upgradeBtn.style.display = 'none';
        } else {
          normalContent.style.display = 'flex';
          descContent.style.display = 'none';
          costLabel.style.display = 'block';
          upgradeBtn.style.display = 'block';
        }
      }
    });

    card.appendChild(normalContent);
    card.appendChild(descContent);
    card.appendChild(costLabel);
    card.appendChild(upgradeBtn);

    return card;
  }

  /**
   * Creates an upgrade button with integrated statistics
   * @deprecated Metodo legacy, sostituito da createUpgradeCard().
   * Mantenuto solo per compatibilità.
   */
  createStatUpgradeButton(statName: string, icon: string, color: string, upgradeType: string, currentLevel: number = 0): HTMLElement {
    const container = document.createElement('div');
    container.className = 'upgrade-row-container';
    container.style.cssText = `
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 14px 16px;
      margin-bottom: 10px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid ${color}40;
      border-radius: 10px;
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      user-select: none;
      box-sizing: border-box;
    `;

    container.addEventListener('mouseenter', () => {
      container.style.background = `rgba(255, 255, 255, 0.1)`;
      container.style.borderColor = color;
      container.style.transform = 'translateY(-2px)';
      container.style.boxShadow = `0 4px 12px rgba(0, 0, 0, 0.2)`;
    });

    container.addEventListener('mouseleave', () => {
      container.style.background = `rgba(255, 255, 255, 0.05)`;
      container.style.borderColor = `${color}40`;
      container.style.transform = 'translateY(0)';
      container.style.boxShadow = 'none';
    });

    // Click on container shows explanation
    container.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.ui-upgrade-btn')) {
        this.onShowExplanation(statName, upgradeType, container);
      }
    });

    // Parte sinistra: Label + Livello
    const leftCol = document.createElement('div');
    leftCol.style.cssText = 'display: flex; align-items: center; gap: 10px; overflow: hidden;';

    const statIcon = document.createElement('span');
    statIcon.textContent = icon;
    statIcon.style.cssText = `font-size: 18px; color: ${color}; display: inline-block; width: 24px; text-align: center; flex-shrink: 0;`;

    const statLabel = document.createElement('span');
    statLabel.textContent = statName;
    statLabel.style.cssText = 'font-weight: 700; color: #ffffff; white-space: nowrap; font-size: 16px;';

    const levelLabel = document.createElement('span');
    levelLabel.className = `stat-level-${upgradeType}`;
    levelLabel.textContent = `Lv.${currentLevel}`;
    levelLabel.style.cssText = `
      font-size: 12px;
      color: ${color};
      font-weight: 600;
      opacity: 0.9;
      margin-left: 4px;
    `;

    leftCol.appendChild(statIcon);
    leftCol.appendChild(statLabel);
    leftCol.appendChild(levelLabel);

    // Parte destra: Valore + Bottone
    const rightCol = document.createElement('div');
    rightCol.style.cssText = 'display: flex; align-items: center; gap: 12px;';

    const currentValue = document.createElement('span');
    currentValue.className = `stat-current-${upgradeType}`;
    currentValue.textContent = this.getInitialStatValue(upgradeType);
    currentValue.style.cssText = `
      font-size: 13px;
      color: rgba(255, 255, 255, 0.8);
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    `;

    const upgradeButton = document.createElement('div');
    upgradeButton.className = 'ui-upgrade-btn';
    upgradeButton.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 6px 8px;
      background: ${color}20;
      border: 1px solid ${color}40;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 600;
      color: ${color};
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 80px;
      text-align: center;
    `;

    // Calcola il costo basato sul livello corrente
    const cost = this.calculateCost(upgradeType, currentLevel);

    const upgradeText = document.createElement('div');
    upgradeText.textContent = 'BUY';
    upgradeText.style.cssText = 'font-size: 11px; font-weight: 700;';

    const costDetails = document.createElement('div');
    costDetails.textContent = `${cost.credits}CR + ${cost.cosmos}CO`;
    costDetails.style.cssText = 'font-size: 9px; opacity: 0.8; margin-top: 2px;';

    upgradeButton.appendChild(upgradeText);
    upgradeButton.appendChild(costDetails);

    // Click on upgrade button
    upgradeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onUpgradeClick(upgradeType as 'hp' | 'shield' | 'speed' | 'damage' | 'missileDamage');
    });

    upgradeButton.addEventListener('mouseenter', (e) => {
      e.stopPropagation();
      upgradeButton.style.background = color;
      upgradeButton.style.color = 'white';
      upgradeButton.style.transform = 'scale(1.05)';
    });

    upgradeButton.addEventListener('mouseleave', (e) => {
      e.stopPropagation();
      upgradeButton.style.background = `${color}20`;
      upgradeButton.style.color = color;
      upgradeButton.style.transform = 'scale(1)';
    });

    rightCol.appendChild(currentValue);
    rightCol.appendChild(upgradeButton);

    container.appendChild(leftCol);
    container.appendChild(rightCol);

    return container;
  }
}
