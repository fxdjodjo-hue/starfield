import { BasePanel } from './UIManager';
import type { PanelConfig } from './PanelConfig';
import { ECS } from '../../infrastructure/ecs/ECS';
import { getPlayerDefinition } from '../../config/PlayerConfig';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Experience } from '../../entities/Experience';
import { SkillPoints } from '../../entities/SkillPoints';
import { PlayerUpgrades } from '../../entities/PlayerUpgrades';

/**
 * SkillsPanel - Pannello per visualizzare statistiche giocatore e gestire abilità
 */
export class SkillsPanel extends BasePanel {
  private ecs: ECS;

  constructor(config: PanelConfig, ecs: ECS) {
    super(config);
    this.ecs = ecs;
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
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
      border-radius: 16px;
      overflow-y: auto;
    `;

    // Pulsante di chiusura "X" nell'angolo superiore destro
    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
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
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 8px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
    `;

    const title = document.createElement('h2');
    title.textContent = '⚡ Skills & Abilità';
    title.style.cssText = `
      margin: 0;
      color: rgba(255, 255, 255, 0.95);
      font-size: 22px;
      font-weight: 700;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      background: linear-gradient(135deg, #60a5fa, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Sistema abilità e potenziamenti';
    subtitle.style.cssText = `
      margin: 4px 0 0 0;
      color: rgba(148, 163, 184, 0.7);
      font-size: 12px;
      font-weight: 400;
    `;

    header.appendChild(title);
    header.appendChild(subtitle);
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

    // Sezione Statistiche Combattimento
    const combatStatsSection = this.createStatsSection('⚔️ Statistiche Combattimento', [
      { label: 'HP', icon: '❤️', value: '100,000/100,000', color: '#10b981', upgradeKey: 'hp' },
      { label: 'Shield', icon: '🛡️', value: '50,000/50,000', color: '#3b82f6', upgradeKey: 'shield' },
      { label: 'Speed', icon: '💨', value: '300 u/s', color: '#f59e0b', upgradeKey: 'speed' }
    ]);

    // Sezione Progressione
    const progressionStatsSection = this.createStatsSection('📈 Progressione', [
      { label: 'Livello', icon: '🏆', value: '1', color: '#fbbf24' },
      { label: 'Esperienza', icon: '⭐', value: '0/10,000', color: '#10b981' },
      { label: 'Punti Abilità', icon: '⚡', value: '0', color: '#a855f7' }
    ]);

    // Sezione placeholder per abilità future
    const skillsSection = this.createSkillsSection();

    statsContainer.appendChild(combatStatsSection);
    statsContainer.appendChild(progressionStatsSection);
    statsContainer.appendChild(skillsSection);

    content.appendChild(statsContainer);

    return content;
  }

  /**
   * Crea una sezione di statistiche
   */
  private createStatsSection(title: string, stats: Array<{label: string, icon: string, value: string, color: string, upgradeKey?: string}>): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(148, 163, 184, 0.2);
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
        background: rgba(15, 23, 42, 0.6);
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
        color: rgba(148, 163, 184, 0.7);
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
   * Crea la sezione degli upgrade delle statistiche
   */
  private createSkillsSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    `;

    const sectionTitle = document.createElement('h3');
    sectionTitle.textContent = '⚡ Upgrade Statistiche';
    sectionTitle.style.cssText = `
      margin: 0 0 16px 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 16px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;

    // Upgrade HP
    const hpUpgrade = this.createUpgradeButton('❤️ HP +1%', 'upgrade-hp', '#10b981', () => this.upgradeStat('hp'));
    // Upgrade Shield
    const shieldUpgrade = this.createUpgradeButton('🛡️ Shield +1%', 'upgrade-shield', '#3b82f6', () => this.upgradeStat('shield'));
    // Upgrade Speed
    const speedUpgrade = this.createUpgradeButton('💨 Speed +1%', 'upgrade-speed', '#f59e0b', () => this.upgradeStat('speed'));

    section.appendChild(sectionTitle);
    section.appendChild(hpUpgrade);
    section.appendChild(shieldUpgrade);
    section.appendChild(speedUpgrade);

    return section;
  }

  /**
   * Crea un pulsante per l'upgrade di una statistica
   */
  private createUpgradeButton(label: string, upgradeType: string, color: string, onClick: () => void): HTMLElement {
    const button = document.createElement('button');
    button.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 12px 16px;
      margin-bottom: 8px;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid ${color}40;
      border-radius: 8px;
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = `rgba(15, 23, 42, 0.8)`;
      button.style.borderColor = color;
      button.style.transform = 'translateY(-1px)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = `rgba(15, 23, 42, 0.6)`;
      button.style.borderColor = `${color}40`;
      button.style.transform = 'translateY(0)';
    });

    button.addEventListener('click', onClick);

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    labelSpan.style.cssText = `flex: 1;`;

    const costSpan = document.createElement('span');
    costSpan.textContent = '1 SP';
    costSpan.style.cssText = `
      color: ${color};
      font-weight: 600;
      font-size: 12px;
    `;

    button.appendChild(labelSpan);
    button.appendChild(costSpan);

    return button;
  }

  /**
   * Aggiorna le statistiche dal giocatore
   */
  private updatePlayerStats(): void {
    if (!this.container) return;

    const playerEntity = this.ecs.getPlayerEntity();
    if (!playerEntity) return;

    // Ottieni componenti del giocatore
    const health = this.ecs.getComponent(playerEntity, Health);
    const shield = this.ecs.getComponent(playerEntity, Shield);
    const experience = this.ecs.getComponent(playerEntity, Experience);
    const skillPoints = this.ecs.getComponent(playerEntity, SkillPoints);
    const playerUpgrades = this.ecs.getComponent(playerEntity, PlayerUpgrades);

    // Aggiorna statistiche combattimento
    if (health) {
      const healthValue = this.container.querySelector('.stat-hp') as HTMLElement;
      if (healthValue) {
        healthValue.textContent = `${health.current.toLocaleString()}/${health.max.toLocaleString()}`;
      }
    }

    if (shield) {
      const shieldValue = this.container.querySelector('.stat-shield') as HTMLElement;
      if (shieldValue) {
        shieldValue.textContent = `${shield.current.toLocaleString()}/${shield.max.toLocaleString()}`;
      }
    }

    // Calcola velocità con bonus dagli upgrade
    if (playerUpgrades) {
      const playerDef = getPlayerDefinition();
      const speedBonus = playerUpgrades.getSpeedBonus();
      const calculatedSpeed = Math.floor(playerDef.stats.speed * speedBonus);

      const speedValue = this.container.querySelector('.stat-speed') as HTMLElement;
      if (speedValue) {
        speedValue.textContent = `${calculatedSpeed} u/s`;
      }
    }

    // Aggiorna statistiche progressione
    if (experience) {
      const levelValue = this.container.querySelector('.stat-livello') as HTMLElement;
      if (levelValue) {
        levelValue.textContent = experience.level.toString();
      }

      const expValue = this.container.querySelector('.stat-esperienza') as HTMLElement;
      if (expValue) {
        expValue.textContent = `${experience.exp.toLocaleString()}/${experience.expForNextLevel.toLocaleString()}`;
      }
    }

    // Punti abilità dal componente ECS
    if (skillPoints) {
      const skillPointsValue = this.container.querySelector('.stat-punti-abilità') as HTMLElement;
      if (skillPointsValue) {
        skillPointsValue.textContent = skillPoints.current.toString();
      }
    }
  }

  /**
   * Callback quando il pannello viene mostrato
   */
  protected onShow(): void {
    // Le statistiche vengono aggiornate dal metodo update() ogni frame
  }

  /**
   * Callback quando il pannello viene nascosto
   */
  protected onHide(): void {
    // Le statistiche continuano ad aggiornarsi anche quando il pannello è chiuso
  }

  /**
   * Acquista un upgrade per una statistica
   */
  private upgradeStat(statType: 'hp' | 'shield' | 'speed'): void {
    const playerEntity = this.ecs.getPlayerEntity();
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
    }

    if (success) {
      // Rimuovi skill point
      skillPoints.spendPoints(1);

      // Aggiorna le statistiche del giocatore
      this.updatePlayerStats();

      // Forza aggiornamento delle statistiche fisiche del giocatore
      this.updatePlayerPhysicalStats();
    }
  }

  /**
   * Aggiorna le statistiche fisiche del giocatore (HP, Shield, Speed) dopo un upgrade
   */
  private updatePlayerPhysicalStats(): void {
    const playerEntity = this.ecs.getPlayerEntity();
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

    // Speed viene aggiornata automaticamente dal PlayerControlSystem
  }

  /**
   * Metodo update chiamato dal sistema ECS ogni frame
   */
  update(deltaTime: number): void {
    // Aggiorna le statistiche sempre se il container esiste
    if (this.container) {
      this.updatePlayerStats();
    }
  }
}
