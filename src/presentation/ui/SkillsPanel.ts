import { BasePanel } from './UIManager';
import type { PanelConfig } from './PanelConfig';
import { ECS } from '../../infrastructure/ecs/ECS';
import { getPlayerDefinition } from '../../config/PlayerConfig';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { SkillPoints } from '../../entities/currency/SkillPoints';
import { PlayerUpgrades } from '../../entities/player/PlayerUpgrades';
import { PlayerSystem } from '../../systems/player/PlayerSystem';

/**
 * SkillsPanel - Pannello per visualizzare statistiche giocatore e gestire abilità
 */
export class SkillsPanel extends BasePanel {
  private ecs: ECS;
  private playerSystem: PlayerSystem | null = null;
  private tooltipElement: HTMLElement | null = null;

  constructor(config: PanelConfig, ecs: ECS, playerSystem?: PlayerSystem) {
    super(config);
    this.ecs = ecs;
    this.playerSystem = playerSystem || null;
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
   * Crea il contenuto del pannello skills
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
    title.textContent = 'Skills & Abilità';
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
    subtitle.textContent = 'Sistema abilità e potenziamenti';
    subtitle.style.cssText = `
      margin: 4px 0 8px 0;
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      font-weight: 400;
    `;

    // Punti abilità come testo prominente
    const skillPointsDisplay = document.createElement('div');
    skillPointsDisplay.className = 'skill-points-display';
    skillPointsDisplay.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 16px;
      background: rgba(168, 85, 247, 0.1);
      border: 1px solid rgba(168, 85, 247, 0.3);
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.95);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    `;

    const skillIcon = document.createElement('span');
    skillIcon.textContent = '★';
    skillIcon.style.cssText = 'font-size: 16px;';

    const skillText = document.createElement('span');
    skillText.textContent = 'Punti Abilità: ';
    skillText.style.cssText = 'color: rgba(255, 255, 255, 0.9);';

    const skillValue = document.createElement('span');
    skillValue.className = 'skill-points-value';
    skillValue.textContent = '10';
    skillValue.style.cssText = `
      color: rgba(255, 255, 255, 0.95);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    `;

    skillPointsDisplay.appendChild(skillIcon);
    skillPointsDisplay.appendChild(skillText);
    skillPointsDisplay.appendChild(skillValue);

    header.appendChild(title);
    header.appendChild(subtitle);
    header.appendChild(skillPointsDisplay);
    content.appendChild(header);

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
    sectionTitle.textContent = 'Statistiche & Upgrade';
    sectionTitle.style.cssText = `
      margin: 0 0 16px 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 16px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;

    section.appendChild(sectionTitle);

    // Crea i quattro pulsanti di upgrade con statistiche integrate
    const hpUpgrade = this.createStatUpgradeButton('HP', '+', '#10b981', 'hp');
    const shieldUpgrade = this.createStatUpgradeButton('Shield', '+', '#3b82f6', 'shield');
    const speedUpgrade = this.createStatUpgradeButton('Speed', '+', '#f59e0b', 'speed');
    const damageUpgrade = this.createStatUpgradeButton('Damage', '+', '#ef4444', 'damage');

    section.appendChild(hpUpgrade);
    section.appendChild(shieldUpgrade);
    section.appendChild(speedUpgrade);
    section.appendChild(damageUpgrade);

    return section;
  }

  /**
   * Crea un pulsante di upgrade con statistica integrata
   */
  private createStatUpgradeButton(statName: string, icon: string, color: string, upgradeType: string): HTMLElement {
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
      align-items: center;
      justify-content: center;
      padding: 6px 12px;
      background: ${color}20;
      border: 1px solid ${color}40;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      color: ${color};
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 70px;
    `;

    const upgradeText = document.createElement('span');
    upgradeText.textContent = 'UPGRADE';

    upgradeButton.appendChild(upgradeText);

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
  private updatePlayerStats(): void {
    if (!this.container || !this.playerSystem) return;

    const playerEntity = this.playerSystem.getPlayerEntity();
    if (!playerEntity) return;

    // Ottieni componenti del giocatore
    const health = this.ecs.getComponent(playerEntity, Health);
    const shield = this.ecs.getComponent(playerEntity, Shield);
    const damage = this.ecs.getComponent(playerEntity, Damage);
    const skillPoints = this.ecs.getComponent(playerEntity, SkillPoints);
    const playerUpgrades = this.ecs.getComponent(playerEntity, PlayerUpgrades);

    // Aggiorna statistiche nelle card di upgrade
    if (health) {
      const hpValue = this.container.querySelector('.stat-current-hp') as HTMLElement;
      if (hpValue) {
        hpValue.textContent = `${health.current.toLocaleString()}`;
      }
    }

    if (shield) {
      const shieldValue = this.container.querySelector('.stat-current-shield') as HTMLElement;
      if (shieldValue) {
        shieldValue.textContent = `${shield.current.toLocaleString()}`;
      }
    }

    // Aggiorna velocità con bonus dagli upgrade
    if (playerUpgrades) {
      const playerDef = getPlayerDefinition();
      const speedBonus = playerUpgrades.getSpeedBonus();
      const calculatedSpeed = Math.floor(playerDef.stats.speed * speedBonus);

      const speedValue = this.container.querySelector('.stat-current-speed') as HTMLElement;
      if (speedValue) {
        speedValue.textContent = `${calculatedSpeed} u/s`;
      }

      // Aggiorna damage dal componente Damage del player
      if (damage) {
        const damageValue = this.container.querySelector('.stat-current-damage') as HTMLElement;
        if (damageValue) {
          damageValue.textContent = damage.damage.toString();
        }
      }
    }

    // Punti abilità dal componente ECS (nell'header)
    if (skillPoints) {
      const skillPointsValue = this.container.querySelector('.skill-points-value') as HTMLElement;
      if (skillPointsValue) {
        skillPointsValue.textContent = skillPoints.current.toString();
      }
    }
  }

  /**
   * Callback quando il pannello viene mostrato
   */
  protected onShow(): void {
    this.updatePlayerStats();
  }

  /**
   * Callback quando il pannello viene nascosto
   */
  protected onHide(): void {
    // Chiude eventuali tooltip aperti
    this.hideTooltip();
    // Le statistiche continuano ad aggiornarsi anche quando il pannello è chiuso
  }

  /**
   * Acquista un upgrade per una statistica
   */
  private upgradeStat(statType: 'hp' | 'shield' | 'speed' | 'damage'): void {
    if (!this.playerSystem) return;
    const playerEntity = this.playerSystem.getPlayerEntity();
    if (!playerEntity) return;

    const skillPoints = this.ecs.getComponent(playerEntity, SkillPoints);
    const playerUpgrades = this.ecs.getComponent(playerEntity, PlayerUpgrades);

    if (!skillPoints || !playerUpgrades) return;

    // Controlla se ha abbastanza skill points
    if (skillPoints.current < 1) {
      // TODO: Mostra messaggio di errore
      console.log('Non hai abbastanza skill points!');
      return;
    }

    // Acquista l'upgrade
    let success = false;
    switch (statType) {
      case 'hp':
        success = playerUpgrades.upgradeHP();
        break;
      case 'shield':
        success = playerUpgrades.upgradeShield();
        break;
      case 'speed':
        success = playerUpgrades.upgradeSpeed();
        break;
      case 'damage':
        success = playerUpgrades.upgradeDamage();
        break;
    }

    if (success) {
      // Rimuovi skill point
      skillPoints.spendPoints(1);

      // Forza aggiornamento delle statistiche fisiche del giocatore
      this.updatePlayerPhysicalStats();

      // Aggiorna le statistiche del giocatore (dopo aver aggiornato i componenti)
      this.updatePlayerStats();
    } else {
      console.log('❌ SkillsPanel: Upgrade failed for', statType);
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
      const newDamage = Math.floor(playerDef.stats.damage * playerUpgrades.getDamageBonus());
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
        title = '💚 PUNTI VITA (HP)';
        description = 'Rappresentano la salute della tua nave. Quando arrivano a 0, la nave viene distrutta. Gli upgrade aumentano la resistenza ai danni. Più HP = più possibilità di sopravvivenza.';
        break;
      case 'shield':
        title = 'SCUDO ENERGETICO';
        description = 'Protegge la nave dai danni prima degli HP. Si ricarica automaticamente nel tempo. Gli upgrade aumentano la capacità massima. Più scudi = migliore protezione iniziale.';
        break;
      case 'speed':
        title = '💨 VELOCITÀ DI MOVIMENTO';
        description = 'Determina quanto velocemente si muove la nave. Influenza la manovrabilità in combattimento. Gli upgrade migliorano l\'accelerazione. Più velocità = migliore controllo in battaglia.';
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
      if (!this.tooltipElement!.contains(e.target as Node) && !buttonElement.contains(e.target as Node)) {
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
   * Metodo update chiamato dal sistema ECS ogni frame
   */
  updateECS(deltaTime: number): void {
    // Aggiorna le statistiche sempre se il container esiste
    if (this.container) {
      this.updatePlayerStats();
    }
  }

  /**
   * Implementazione del metodo update richiesto da BasePanel
   */
  update(data: PanelData): void {
    // Per SkillsPanel, l'update con PanelData non è necessario
    // dato che aggiorna automaticamente le statistiche ogni frame
    this.updatePlayerStats();
  }
}
