import { BasePanel } from './UIManager';
import type { PanelConfig } from './PanelConfig';
import { ECS } from '../../infrastructure/ecs/ECS';
import { getPlayerDefinition } from '../../config/PlayerConfig';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { PlayerUpgrades } from '../../entities/player/PlayerUpgrades';
import { Credits, Cosmos } from '../../entities/currency/Currency';
import { PlayerSystem } from '../../systems/player/PlayerSystem';
import { ClientNetworkSystem } from '../../multiplayer/client/ClientNetworkSystem';

/**
 * UpgradePanel - Pannello per visualizzare statistiche giocatore e gestire upgrade
 */
export class UpgradePanel extends BasePanel {
  private ecs: ECS;
  private playerSystem: PlayerSystem | null = null;
  private clientNetworkSystem: ClientNetworkSystem | null = null;
  private tooltipElement: HTMLElement | null = null;
  private upgradeInProgress: { [key: string]: boolean } = {};

  constructor(config: PanelConfig, ecs: ECS, playerSystem?: PlayerSystem, clientNetworkSystem?: ClientNetworkSystem) {
    super(config);
    this.ecs = ecs;
    this.playerSystem = playerSystem || null;
    this.clientNetworkSystem = clientNetworkSystem || null;
  }

  /**
   * Imposta il riferimento al PlayerSystem
   */
  setPlayerSystem(playerSystem: PlayerSystem): void {
    this.playerSystem = playerSystem;
    // Aggiorna immediatamente le statistiche quando riceviamo il riferimento
    this.updatePlayerStats();
  }

  /**
   * Imposta il riferimento al ClientNetworkSystem
   */
  setClientNetworkSystem(clientNetworkSystem: ClientNetworkSystem): void {
    this.clientNetworkSystem = clientNetworkSystem;
  }

  /**
   * Crea il contenuto del pannello upgrade
   */
  protected createPanelContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'skills-content';
    content.style.cssText = `
      padding: 24px;
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 20px;
      position: relative;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 25px;
      overflow-y: auto;
    `;

    // Pulsante di chiusura "X" nell'angolo superiore destro
    const closeButton = document.createElement('button');
    closeButton.textContent = 'X';
    closeButton.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(239, 68, 68, 0.9);
      border: 1px solid rgba(239, 68, 68, 0.5);
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 8px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
      transition: all 0.2s ease;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(239, 68, 68, 1)';
      closeButton.style.borderColor = 'rgba(239, 68, 68, 0.8)';
      closeButton.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
      closeButton.style.transform = 'translateY(-1px)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(239, 68, 68, 0.9)';
      closeButton.style.borderColor = 'rgba(239, 68, 68, 0.5)';
      closeButton.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3)';
      closeButton.style.transform = 'translateY(0)';
    });

    closeButton.addEventListener('click', () => {
      this.hide();
    });

    content.appendChild(closeButton);

    // Header con gradiente
    const header = document.createElement('div');
    header.style.cssText = `
      text-align: center;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 8px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
    `;

    const title = document.createElement('h2');
    title.textContent = 'Upgrade';
    title.style.cssText = `
      margin: 0;
      color: rgba(255, 255, 255, 0.95);
      font-size: 22px;
      font-weight: 700;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      background: rgba(255, 255, 255, 0.08);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Upgrade system';
    subtitle.style.cssText = `
      margin: 4px 0 8px 0;
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      font-weight: 400;
    `;

    header.appendChild(title);
    header.appendChild(subtitle);
    content.appendChild(header);

    // Sezione Risorse e Costi
    const resourcesSection = this.createResourcesSection();
    content.appendChild(resourcesSection);

    // Contenitore principale per le statistiche
    const statsContainer = document.createElement('div');
    statsContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 20px;
      overflow-y: auto;
      padding: 8px 0;
    `;

    // Sezione Upgrade con statistiche integrate
    const upgradeSection = this.createUpgradeSection();

    statsContainer.appendChild(upgradeSection);

    content.appendChild(statsContainer);

    return content;
  }

  /**
   * Crea una sezione di statistiche
   */
  private createStatsSection(title: string, stats: Array<{label: string, icon: string, value: string, color: string, upgradeKey?: string}>): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
        background: rgba(255, 255, 255, 0.03);
        border-radius: 8px;
        border-left: 3px solid ${stat.color};
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
   * Calcola il costo di un upgrade basato sul livello corrente
   */
  private calculateUpgradeCost(statType: string, currentLevel: number): { credits: number, cosmos: number } {
    const baseCosts = {
      hp: { credits: 5000, cosmos: 10 },
      shield: { credits: 3000, cosmos: 5 },
      speed: { credits: 8000, cosmos: 15 },
      damage: { credits: 10000, cosmos: 20 }
    };

    const baseCost = baseCosts[statType as keyof typeof baseCosts];

    if (currentLevel < 20) {
      // Fase 1: Solo crediti (primi 20 livelli)
      return { credits: baseCost.credits, cosmos: 0 };
    } else if (currentLevel < 40) {
      // Fase 2: Crediti + Cosmos (livelli 21-40)
      return { credits: baseCost.credits, cosmos: baseCost.cosmos };
    } else {
      // Fase 3: Solo Cosmos (livello 41+)
      return { credits: 0, cosmos: baseCost.cosmos * 2 };
    }
  }

  /**
   * Crea la sezione risorse e costi
   */
  private createResourcesSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    `;

    const sectionTitle = document.createElement('h3');
    sectionTitle.textContent = 'Current Resources';
    sectionTitle.style.cssText = `
      margin: 0 0 16px 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 16px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: center;
    `;

    section.appendChild(sectionTitle);

    // Contenitore risorse attuali
    const currentResources = document.createElement('div');
    currentResources.style.cssText = `
      display: flex;
      gap: 20px;
      justify-content: center;
      align-items: center;
    `;

    // Crediti attuali
    const creditsDisplay = document.createElement('div');
    creditsDisplay.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(0, 255, 136, 0.1);
      border: 1px solid rgba(0, 255, 136, 0.3);
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
    `;

    const creditsIcon = document.createElement('span');
    creditsIcon.textContent = 'CR';
    creditsIcon.style.cssText = 'font-weight: bold;';

    const creditsValue = document.createElement('span');
    creditsValue.className = 'current-credits';
    creditsValue.textContent = '0';
    creditsValue.style.cssText = 'font-variant-numeric: tabular-nums;';

    creditsDisplay.appendChild(creditsIcon);
    creditsDisplay.appendChild(creditsValue);

    // Cosmos attuali
    const cosmosDisplay = document.createElement('div');
    cosmosDisplay.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(0, 136, 255, 0.1);
      border: 1px solid rgba(0, 136, 255, 0.3);
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
    `;

    const cosmosIcon = document.createElement('span');
    cosmosIcon.textContent = 'CO';
    cosmosIcon.style.cssText = 'font-weight: bold;';

    const cosmosValue = document.createElement('span');
    cosmosValue.className = 'current-cosmos';
    cosmosValue.textContent = '0';
    cosmosValue.style.cssText = 'font-variant-numeric: tabular-nums;';

    cosmosDisplay.appendChild(cosmosIcon);
    cosmosDisplay.appendChild(cosmosValue);

    currentResources.appendChild(creditsDisplay);
    currentResources.appendChild(cosmosDisplay);


    section.appendChild(currentResources);

    return section;
  }

  /**
   * Crea la sezione degli upgrade con statistiche integrate
   */
  private createUpgradeSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    `;

    const sectionTitle = document.createElement('h3');
    sectionTitle.textContent = 'Statistics & Upgrades';
    sectionTitle.style.cssText = `
      margin: 0 0 16px 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 16px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;

    section.appendChild(sectionTitle);

    // Ottieni i livelli correnti degli upgrade
    const playerEntity = this.playerSystem?.getPlayerEntity();
    const playerUpgrades = playerEntity ? this.ecs.getComponent(playerEntity, PlayerUpgrades) : null;

    const hpLevel = playerUpgrades ? playerUpgrades.hpUpgrades : 0;
    const shieldLevel = playerUpgrades ? playerUpgrades.shieldUpgrades : 0;
    const speedLevel = playerUpgrades ? playerUpgrades.speedUpgrades : 0;
    const damageLevel = playerUpgrades ? playerUpgrades.damageUpgrades : 0;

    // Crea i quattro pulsanti di upgrade con statistiche integrate
    const hpUpgrade = this.createStatUpgradeButton('Hull', '+', '#10b981', 'hp', hpLevel);
    hpUpgrade.classList.add('upgrade-hp');
    const shieldUpgrade = this.createStatUpgradeButton('Shield', '+', '#3b82f6', 'shield', shieldLevel);
    shieldUpgrade.classList.add('upgrade-shield');
    const speedUpgrade = this.createStatUpgradeButton('Speed', '+', '#f59e0b', 'speed', speedLevel);
    speedUpgrade.classList.add('upgrade-speed');
    const damageUpgrade = this.createStatUpgradeButton('Laser', '+', '#ef4444', 'damage', damageLevel);
    damageUpgrade.classList.add('upgrade-damage');

    section.appendChild(hpUpgrade);
    section.appendChild(shieldUpgrade);
    section.appendChild(speedUpgrade);
    section.appendChild(damageUpgrade);

    return section;
  }

  /**
   * Crea un pulsante di upgrade con statistica integrata
   */
  private createStatUpgradeButton(statName: string, icon: string, color: string, upgradeType: string, currentLevel: number = 0): HTMLElement {
    const button = document.createElement('button');
    button.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
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
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = `rgba(255, 255, 255, 0.1)`;
      button.style.borderColor = color;
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = `0 4px 12px rgba(0, 0, 0, 0.2)`;
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = `rgba(255, 255, 255, 0.05)`;
      button.style.borderColor = `${color}40`;
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = 'none';
    });

    // Click sul pulsante principale mostra spiegazione
    button.addEventListener('click', (e) => {
      // Se il click è sul bottone di upgrade, non mostrare la spiegazione
      if (!(e.target as HTMLElement).closest('.upgrade-button')) {
        this.showStatExplanation(statName, upgradeType, button);
      }
    });

    // Parte sinistra: icona + nome statistica
    const leftSide = document.createElement('div');
    leftSide.style.cssText = 'display: flex; align-items: center; gap: 10px; flex: 1;';

    const statIcon = document.createElement('span');
    statIcon.textContent = icon;
    statIcon.style.cssText = `font-size: 18px; color: ${color};`;

    const statLabel = document.createElement('span');
    statLabel.textContent = statName;
    statLabel.style.cssText = 'font-weight: 600; color: rgba(255, 255, 255, 0.9);';

    leftSide.appendChild(statIcon);
    leftSide.appendChild(statLabel);

    // Parte destra: valore corrente + pulsante upgrade
    const rightSide = document.createElement('div');
    rightSide.style.cssText = 'display: flex; align-items: center; gap: 12px;';

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
    upgradeButton.className = 'upgrade-button';
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
    const cost = this.calculateUpgradeCost(upgradeType, currentLevel);

    const upgradeText = document.createElement('div');
    upgradeText.textContent = 'UPGRADE';
    upgradeText.style.cssText = 'font-size: 11px; font-weight: 700;';

    const costDetails = document.createElement('div');
    costDetails.textContent = `${cost.credits}CR + ${cost.cosmos}CO`;
    costDetails.style.cssText = 'font-size: 9px; opacity: 0.8; margin-top: 2px;';

    upgradeButton.appendChild(upgradeText);
    upgradeButton.appendChild(costDetails);

    // Click sul bottone di upgrade
    upgradeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.upgradeStat(upgradeType as 'hp' | 'shield' | 'speed' | 'damage');
    });

    // Effetto hover sul pulsante interno
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

    rightSide.appendChild(currentValue);
    rightSide.appendChild(upgradeButton);

    button.appendChild(leftSide);
    button.appendChild(rightSide);

    return button;
  }

  /**
   * Ottiene il valore iniziale di una statistica
   */
  private getInitialStatValue(statType: string): string {
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
   * Aggiorna le statistiche dal giocatore
   */
  public updatePlayerStats(): void {
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

    // Aggiorna statistiche nelle card di upgrade
    if (playerUpgrades) {
      // Mostra HP reali dal server (già includono gli upgrade)
      if (health) {
        const hpValue = this.container.querySelector('.stat-current-hp') as HTMLElement;
        if (hpValue) {
          hpValue.textContent = `${health.max.toLocaleString()}`;
        }
      }

      // Mostra Shield reali dal server (già includono gli upgrade)
      if (shield) {
        const shieldValue = this.container.querySelector('.stat-current-shield') as HTMLElement;
        if (shieldValue) {
          shieldValue.textContent = `${shield.max.toLocaleString()}`;
        }
      }

      // Aggiorna velocità con bonus dagli upgrade
      const speedBonus = playerUpgrades.getSpeedBonus();
      const calculatedSpeed = Math.floor(playerDef.stats.speed * speedBonus);

      const speedValue = this.container.querySelector('.stat-current-speed') as HTMLElement;
      if (speedValue) {
        speedValue.textContent = `${calculatedSpeed} u/s`;
      }

      // Calcola e aggiorna damage con bonus dagli upgrade (stesso metodo di applyPlayerUpgrades)
      if (damage && playerDef.stats.damage) {
        const damageBonus = playerUpgrades.getDamageBonus();
        const calculatedDamage = Math.floor(playerDef.stats.damage * damageBonus);

        const damageValue = this.container.querySelector('.stat-current-damage') as HTMLElement;
        if (damageValue) {
          damageValue.textContent = calculatedDamage.toString();
        }
      }

      // Aggiorna stato dei pulsanti di upgrade (abilitati/disabilitati)
      this.updateUpgradeButtons(playerUpgrades, playerDef.upgrades);
    }

    // Aggiorna risorse attuali nel pannello
    if (this.playerSystem) {
      const playerEntity = this.playerSystem.getPlayerEntity();
      if (playerEntity) {
        const credits = this.ecs.getComponent(playerEntity, Credits);
        const cosmos = this.ecs.getComponent(playerEntity, Cosmos);

        // Aggiorna crediti attuali
        if (credits) {
          const creditsValue = this.container.querySelector('.current-credits') as HTMLElement;
          if (creditsValue) {
            const creditsAmount = credits.credits || 0;
            creditsValue.textContent = creditsAmount.toLocaleString();
          }
        } else {
        }

        // Aggiorna cosmos attuali
        if (cosmos) {
          const cosmosValue = this.container.querySelector('.current-cosmos') as HTMLElement;
          if (cosmosValue) {
            const cosmosAmount = cosmos.cosmos || 0;
            cosmosValue.textContent = cosmosAmount.toString();
          }
        } else {
        }
      }
    }
  }

  /**
   * Callback quando il pannello viene mostrato
   */
  protected onShow(): void {
    // Aggiorna immediatamente quando viene mostrato
    this.updatePlayerStats();

    // E continua ad aggiornare ogni frame mentre è visibile
    this.startRealtimeUpdates();
  }

  /**
   * Callback quando il pannello viene nascosto
   */
  protected onHide(): void {
    // Chiude eventuali tooltip aperti
    this.hideTooltip();
    // Ferma aggiornamenti real-time quando nascosto per risparmiare risorse
    this.stopRealtimeUpdates();
  }


  /**
   * Acquista un upgrade per una statistica
   */
  private upgradeStat(statType: 'hp' | 'shield' | 'speed' | 'damage'): void {
    console.log(`🔧 [UPGRADE] Attempting to upgrade ${statType}`);

    if (!this.playerSystem) {
      console.log('🔧 [UPGRADE] No playerSystem available');
      return;
    }

    const playerEntity = this.playerSystem.getPlayerEntity();
    if (!playerEntity) {
      console.log('🔧 [UPGRADE] No playerEntity available');
      return;
    }

    const playerUpgrades = this.ecs.getComponent(playerEntity, PlayerUpgrades);
    if (!playerUpgrades) {
      console.log('🔧 [UPGRADE] No playerUpgrades component');
      return;
    }

    // Controlla livello corrente
    const currentLevel = playerUpgrades[`${statType}Upgrades`] || 0;
    console.log(`🔧 [UPGRADE] Current ${statType} level: ${currentLevel}`);

    // SERVER AUTHORITATIVE: Non applicare upgrade localmente
    // Invia richiesta al server e aspetta risposta

    // Controlla se siamo già in attesa di una risposta del server per questo upgrade
    if (this.isUpgradeInProgress(statType)) {
      console.log(`🔧 [UPGRADE] Upgrade ${statType} already in progress`);
      return;
    }

    if (this.clientNetworkSystem) {
      // Marca l'upgrade come in corso
      this.setUpgradeInProgress(statType, true);
      console.log(`🔧 [UPGRADE] Sending upgrade request for ${statType} to server`);

      this.clientNetworkSystem.requestSkillUpgrade(statType);

      // Timeout di sicurezza - se non riceviamo risposta entro 5 secondi, resettiamo
      setTimeout(() => {
        console.log(`🔧 [UPGRADE] Timeout reached for ${statType}, resetting progress`);
        this.setUpgradeInProgress(statType, false);
      }, 5000);

    } else {
      console.log('🔧 [UPGRADE] No clientNetworkSystem available');
    }
  }

  /**
   * Aggiorna le statistiche fisiche del giocatore (HP, Shield, Speed) dopo un upgrade
   */
  private updatePlayerPhysicalStats(): void {
    if (!this.playerSystem) return;
    const playerEntity = this.playerSystem.getPlayerEntity();
    if (!playerEntity) return;

    const playerDef = getPlayerDefinition();
    const playerUpgrades = this.ecs.getComponent(playerEntity, PlayerUpgrades);
    if (!playerUpgrades) return;

    // Aggiorna HP
    const health = this.ecs.getComponent(playerEntity, Health);
    if (health) {
      const newMaxHP = Math.floor(playerDef.stats.health * playerUpgrades.getHPBonus());
      const currentHPPercent = health.current / health.max;
      health.max = newMaxHP;
      health.current = Math.floor(newMaxHP * currentHPPercent);
    }

    // Aggiorna Shield
    const shield = this.ecs.getComponent(playerEntity, Shield);
    if (shield && playerDef.stats.shield) {
      const newMaxShield = Math.floor(playerDef.stats.shield * playerUpgrades.getShieldBonus());
      const currentShieldPercent = shield.current / shield.max;
      shield.max = newMaxShield;
      shield.current = Math.floor(newMaxShield * currentShieldPercent);
    }

    // Aggiorna Damage
    const damage = this.ecs.getComponent(playerEntity, Damage);
    if (damage) {
      const bonus = playerUpgrades.getDamageBonus();
      const newDamage = Math.floor(playerDef.stats.damage * bonus);
      damage.damage = newDamage;
    }

    // Speed viene aggiornata automaticamente dal PlayerControlSystem
  }

  /**
   * Mostra una spiegazione della statistica selezionata
   */
  private showStatExplanation(statName: string, statType: string, buttonElement: HTMLElement): void {
    // Nasconde tooltip esistente se presente
    this.hideTooltip();

    let title = '';
    let description = '';

    switch (statType) {
      case 'hp':
        title = '💚 HEALTH POINTS (HP)';
        description = 'They represent your ship\'s health. When they reach 0, the ship is destroyed. Upgrades increase damage resistance. More HP = more survival chances.';
        break;
      case 'shield':
        title = 'ENERGY SHIELD';
        description = 'Protects the ship from damage before HP. Recharges automatically over time. Upgrades increase maximum capacity. More shields = better initial protection.';
        break;
      case 'speed':
        title = '💨 MOVEMENT SPEED';
        description = 'Determines how fast the ship moves. Affects maneuverability in combat. Upgrades improve acceleration. More speed = better control in battle.';
        break;
    }

    // Crea il tooltip
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'stat-tooltip';
    this.tooltipElement.style.cssText = `
      position: absolute;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 1000;
      max-width: 300px;
      font-size: 14px;
      line-height: 1.5;
      pointer-events: auto;
    `;

    // Contenuto del tooltip
    this.tooltipElement.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <h4 style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 16px; font-weight: 600;">
          ${title}
        </h4>
        <button class="tooltip-close" style="
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          font-size: 18px;
          padding: 0;
          line-height: 1;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">×</button>
      </div>
      <p style="margin: 0; color: rgba(148, 163, 184, 0.8);">
        ${description}
      </p>
    `;

    // Posiziona il tooltip vicino al pulsante
    const buttonRect = buttonElement.getBoundingClientRect();
    const panelRect = this.container!.getBoundingClientRect();

    // Posiziona sopra il pulsante se c'è spazio, altrimenti sotto
    const spaceAbove = buttonRect.top - panelRect.top;
    const tooltipHeight = 120; // Altezza approssimativa

    if (spaceAbove > tooltipHeight) {
      // Posiziona sopra
      this.tooltipElement.style.top = `${buttonRect.top - panelRect.top - tooltipHeight - 10}px`;
    } else {
      // Posiziona sotto
      this.tooltipElement.style.top = `${buttonRect.bottom - panelRect.top + 10}px`;
    }

    this.tooltipElement.style.left = `${buttonRect.left - panelRect.left}px`;

    // Aggiunge il tooltip al container
    this.container!.appendChild(this.tooltipElement);

    // Event listener per chiudere
    const closeButton = this.tooltipElement.querySelector('.tooltip-close') as HTMLElement;
    closeButton.addEventListener('click', () => this.hideTooltip());

    // Chiudi automaticamente dopo 8 secondi
    setTimeout(() => this.hideTooltip(), 8000);

    // Chiudi quando si clicca fuori
    const handleOutsideClick = (e: MouseEvent) => {
      if ((!this.tooltipElement || !this.tooltipElement.contains(e.target as Node)) && !buttonElement.contains(e.target as Node)) {
        this.hideTooltip();
        document.removeEventListener('click', handleOutsideClick);
      }
    };

    // Aspetta un po' prima di aggiungere l'event listener per evitare che si chiuda immediatamente
    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 10);
  }

  /**
   * Nasconde il tooltip se presente
   */
  private hideTooltip(): void {
    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = null;
    }
  }

  /**
   * Sincronizza gli upgrade del player al server (Server Authoritative)
   */
  private syncUpgradesToServer(): void {

    if (!this.clientNetworkSystem) {
      return;
    }

    const playerEntity = this.playerSystem?.getPlayerEntity();
    if (!playerEntity) {
      return;
    }

    const playerUpgrades = this.ecs.getComponent(playerEntity, PlayerUpgrades);
    if (!playerUpgrades) {
      return;
    }

    // Invia upgrade aggiornati al server
    this.clientNetworkSystem.sendPlayerUpgrades({
      hpUpgrades: playerUpgrades.hpUpgrades,
      shieldUpgrades: playerUpgrades.shieldUpgrades,
      speedUpgrades: playerUpgrades.speedUpgrades,
      damageUpgrades: playerUpgrades.damageUpgrades
    });
  }

  private realtimeUpdateActive: boolean = false;

  /**
   * Avvia aggiornamenti real-time quando il pannello è visibile
   */
  private startRealtimeUpdates(): void {
    this.realtimeUpdateActive = true;
  }

  /**
   * Ferma aggiornamenti real-time quando il pannello è nascosto
   */
  private stopRealtimeUpdates(): void {
    this.realtimeUpdateActive = false;
  }

  /**
   * Metodo update chiamato dal sistema ECS ogni frame
   */
  updateECS(deltaTime: number): void {
    // Aggiorna le statistiche solo se il pannello è attivo (visibile o ha aggiornamenti real-time attivi)
    if (this.container && (this.isPanelVisible() || this.realtimeUpdateActive)) {
      this.updatePlayerStats();
    }
  }

  /**
   * Controlla se un upgrade è attualmente in corso
   */
  private isUpgradeInProgress(statType: 'hp' | 'shield' | 'speed' | 'damage'): boolean {
    return this.upgradeInProgress?.[statType] || false;
  }

  /**
   * Imposta lo stato di progresso di un upgrade
   */
  private setUpgradeInProgress(statType: 'hp' | 'shield' | 'speed' | 'damage', inProgress: boolean): void {
    if (!this.upgradeInProgress) {
      this.upgradeInProgress = {};
    }
    this.upgradeInProgress[statType] = inProgress;
  }

  /**
   * Resetta tutti gli stati di progresso degli upgrade (chiamato quando riceviamo risposta dal server)
   */
  public resetUpgradeProgress(): void {
    this.upgradeInProgress = {};
  }

  /**
   * Rollback di un upgrade locale se la richiesta al server fallisce
   */
  private rollbackUpgrade(statType: 'hp' | 'shield' | 'speed' | 'damage'): void {
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

    // Forza aggiornamento UI
    this.updatePlayerStats();
  }

  /**
   * Aggiorna lo stato dei pulsanti di upgrade in base ai limiti massimi e costi
   */
  private updateUpgradeButtons(playerUpgrades: any, upgradeLimits: any): void {
    // Mappa dei pulsanti per tipo di upgrade
    const buttonClasses = {
      hp: '.upgrade-hp',
      shield: '.upgrade-shield',
      speed: '.upgrade-speed',
      damage: '.upgrade-damage'
    };

    Object.entries(buttonClasses).forEach(([statType, buttonClass]) => {
      const currentValue = playerUpgrades[`${statType}Upgrades`];
      const maxValue = upgradeLimits[`max${statType.charAt(0).toUpperCase() + statType.slice(1)}Upgrades`];


      const upgradeButton = this.container.querySelector(buttonClass) as HTMLElement;
      if (upgradeButton) {
        if (currentValue >= maxValue) {
          // Limite raggiunto - disabilita pulsante
          upgradeButton.style.opacity = '0.5';
          upgradeButton.style.pointerEvents = 'none';
          upgradeButton.style.background = 'rgba(100, 100, 100, 0.3)';
          upgradeButton.style.borderColor = 'rgba(100, 100, 100, 0.5)';

          // Cambia il testo per mostrare che è maxato
          const upgradeText = upgradeButton.querySelector('div:first-child');
          if (upgradeText) {
            upgradeText.textContent = 'MAX LEVEL';
          }

          // Rimuovi i costi dal pulsante dato che non è più disponibile
          const costDetails = upgradeButton.querySelector('div:last-child') as HTMLElement;
          if (costDetails) {
            costDetails.style.display = 'none';
          }
        } else {
          // Non al limite - abilita pulsante e aggiorna costi
          upgradeButton.style.opacity = '1';
          upgradeButton.style.pointerEvents = 'auto';
          upgradeButton.style.background = 'rgba(255, 255, 255, 0.1)';
          upgradeButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';

          // Ripristina il testo
          const upgradeText = upgradeButton.querySelector('div:first-child');
          if (upgradeText) {
            upgradeText.textContent = 'UPGRADE';
          }

          // Aggiorna i costi nel pulsante
          const costDetails = upgradeButton.querySelector('div:last-child') as HTMLElement;
          if (costDetails) {
            const newCost = this.calculateUpgradeCost(statType, currentValue);
            let costText = '';
            if (newCost.credits > 0 && newCost.cosmos > 0) {
              costText = `${newCost.credits}CR + ${newCost.cosmos}CO`;
            } else if (newCost.credits > 0) {
              costText = `${newCost.credits}CR`;
            } else if (newCost.cosmos > 0) {
              costText = `${newCost.cosmos}CO`;
            }
            costDetails.textContent = costText;
            costDetails.style.display = 'block';
          }
        }
      }
    });
  }

  /**
   * Mostra un popup quando non si hanno abbastanza risorse
   */
  public showInsufficientResourcesPopup(message: string): void {
    // Controlla se il pannello è ancora valido e visibile
    if (!this.container || !document.body.contains(this.container) || !this.isPanelVisible()) {
      console.log('🔧 [POPUP] Panel not valid or not visible, skipping popup');
      return;
    }

    // Rimuovi popup esistente se presente
    this.hideInsufficientResourcesPopup();

    // Crea il popup
    const popup = document.createElement('div');
    popup.id = 'insufficient-resources-popup';
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 25px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      z-index: 2000;
      max-width: 400px;
      font-family: 'Courier New', monospace;
    `;

    // Titolo
    const title = document.createElement('h3');
    title.textContent = 'INSUFFICIENT RESOURCES';
    title.style.cssText = `
      margin: 0 0 16px 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 18px;
      font-weight: 700;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;

    // Messaggio
    const messageElement = document.createElement('p');
    messageElement.style.cssText = `
      margin: 0 0 20px 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      line-height: 1.5;
      text-align: center;
      font-weight: 400;
    `;

    messageElement.textContent = message;

    // Pulsante OK
    const okButton = document.createElement('button');
    okButton.textContent = 'OK';
    okButton.style.cssText = `
      display: block;
      margin: 0 auto;
      padding: 10px 24px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    okButton.addEventListener('mouseenter', () => {
      okButton.style.background = 'rgba(255, 255, 255, 0.2)';
      okButton.style.borderColor = 'rgba(255, 255, 255, 0.4)';
      okButton.style.transform = 'translateY(-1px)';
    });

    okButton.addEventListener('mouseleave', () => {
      okButton.style.background = 'rgba(255, 255, 255, 0.1)';
      okButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      okButton.style.transform = 'translateY(0)';
    });

    okButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideInsufficientResourcesPopup();
    });

    // Assembla il popup
    popup.appendChild(title);
    popup.appendChild(messageElement);
    popup.appendChild(okButton);

    // Aggiungi overlay
    const overlay = document.createElement('div');
    overlay.id = 'insufficient-resources-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      z-index: 1999;
    `;

    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideInsufficientResourcesPopup();
    });

    // Aggiungi al DOM
    document.body.appendChild(overlay);
    document.body.appendChild(popup);

    // Auto-hide dopo 8 secondi
    setTimeout(() => {
      this.hideInsufficientResourcesPopup();
    }, 8000);
  }

  /**
   * Nasconde il popup di risorse insufficienti
   */
  public hideInsufficientResourcesPopup(): void {
    const popup = document.getElementById('insufficient-resources-popup');
    const overlay = document.getElementById('insufficient-resources-overlay');

    if (popup) popup.remove();
    if (overlay) overlay.remove();
  }


}