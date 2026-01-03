import { BasePanel } from './UIManager';
import type { PanelConfig } from './PanelConfig';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Experience } from '../../entities/Experience';

/**
 * SkillsPanel - Pannello per visualizzare statistiche giocatore e gestire abilità
 */
export class SkillsPanel extends BasePanel {
  private ecs: ECS;
  private statsContainer: HTMLElement | null = null;

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
    this.statsContainer = document.createElement('div');
    this.statsContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 20px;
      overflow-y: auto;
      padding: 8px 0;
    `;

    // Sezione Statistiche Combattimento
    const combatStatsSection = this.createStatsSection('⚔️ Statistiche Combattimento', [
      { label: 'HP', icon: '❤️', value: '100,000/100,000', color: '#10b981' },
      { label: 'Shield', icon: '🛡️', value: '50,000/50,000', color: '#3b82f6' },
      { label: 'Speed', icon: '💨', value: '300 u/s', color: '#f59e0b' }
    ]);

    // Sezione Progressione
    const progressionStatsSection = this.createStatsSection('📈 Progressione', [
      { label: 'Livello', icon: '🏆', value: '1', color: '#fbbf24' },
      { label: 'Esperienza', icon: '⭐', value: '0/10,000', color: '#10b981' },
      { label: 'Punti Abilità', icon: '⚡', value: '0', color: '#a855f7' }
    ]);

    // Sezione placeholder per abilità future
    const skillsSection = this.createSkillsSection();

    this.statsContainer.appendChild(combatStatsSection);
    this.statsContainer.appendChild(progressionStatsSection);
    this.statsContainer.appendChild(skillsSection);

    content.appendChild(this.statsContainer);

    return content;
  }

  /**
   * Crea una sezione di statistiche
   */
  private createStatsSection(title: string, stats: Array<{label: string, icon: string, value: string, color: string}>): HTMLElement {
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
   * Crea la sezione delle abilità (placeholder per ora)
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
    sectionTitle.textContent = '🎯 Albero delle Abilità';
    sectionTitle.style.cssText = `
      margin: 0 0 12px 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 16px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;

    const placeholder = document.createElement('div');
    placeholder.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px;
      text-align: center;
      color: rgba(148, 163, 184, 0.5);
      font-size: 14px;
      gap: 8px;
    `;

    const placeholderIcon = document.createElement('div');
    placeholderIcon.textContent = '🌟';
    placeholderIcon.style.cssText = `
      font-size: 32px;
      opacity: 0.3;
    `;

    const placeholderText = document.createElement('div');
    placeholderText.textContent = 'Sistema abilità in arrivo...';
    placeholderText.style.cssText = `
      font-weight: 500;
    `;

    placeholder.appendChild(placeholderIcon);
    placeholder.appendChild(placeholderText);

    section.appendChild(sectionTitle);
    section.appendChild(placeholder);

    return section;
  }

  /**
   * Aggiorna le statistiche dal giocatore
   */
  private updatePlayerStats(): void {
    if (!this.statsContainer) {
      console.log('SkillsPanel: statsContainer not found');
      return;
    }

    const playerEntity = this.ecs.getPlayerEntity();
    console.log('SkillsPanel: playerEntity =', playerEntity?.id);

    if (!playerEntity) {
      console.log('SkillsPanel: no player entity found');
      return;
    }

    // Ottieni componenti del giocatore
    const health = this.ecs.getComponent(playerEntity, Health);
    const shield = this.ecs.getComponent(playerEntity, Shield);
    const experience = this.ecs.getComponent(playerEntity, Experience);

    console.log('SkillsPanel: components found - health:', !!health, 'shield:', !!shield, 'experience:', !!experience);
    console.log('SkillsPanel: health values:', health ? { current: health.current, max: health.max } : null);
    console.log('SkillsPanel: shield values:', shield ? { current: shield.current, max: shield.max } : null);

    // Aggiorna statistiche combattimento
    if (health) {
      const healthValue = this.statsContainer.querySelector('.stat-hp') as HTMLElement;
      console.log('SkillsPanel: health element found:', !!healthValue);
      if (healthValue) {
        const newText = `${health.current.toLocaleString()}/${health.max.toLocaleString()}`;
        console.log('SkillsPanel: setting health text to:', newText);
        healthValue.textContent = newText;
      }
    }

    if (shield) {
      const shieldValue = this.statsContainer.querySelector('.stat-shield') as HTMLElement;
      console.log('SkillsPanel: shield element found:', !!shieldValue);
      if (shieldValue) {
        const newText = `${shield.current.toLocaleString()}/${shield.max.toLocaleString()}`;
        console.log('SkillsPanel: setting shield text to:', newText);
        shieldValue.textContent = newText;
      }
    }

    // Speed rimane hardcoded per ora (300)
    const speedValue = this.statsContainer.querySelector('.stat-speed') as HTMLElement;
    if (speedValue) {
      speedValue.textContent = '300 u/s';
    }

    // Aggiorna statistiche progressione
    if (experience) {
      const levelValue = this.statsContainer.querySelector('.stat-livello') as HTMLElement;
      if (levelValue) {
        levelValue.textContent = experience.level.toString();
      }

      const expValue = this.statsContainer.querySelector('.stat-esperienza') as HTMLElement;
      if (expValue) {
        expValue.textContent = `${experience.exp.toLocaleString()}/${experience.expForNextLevel.toLocaleString()}`;
      }
    }

    // Punti abilità (placeholder - per ora 0)
    const skillPointsValue = this.statsContainer.querySelector('.stat-punti-abilità') as HTMLElement;
    if (skillPointsValue) {
      skillPointsValue.textContent = '0';
    }
  }

  /**
   * Callback quando il pannello viene mostrato
   */
  protected onShow(): void {
    console.log('SkillsPanel.onShow() called');
    // Le statistiche vengono aggiornate dal metodo update() ogni frame
  }

  /**
   * Callback quando il pannello viene nascosto
   */
  protected onHide(): void {
    console.log('SkillsPanel.onHide() called');
    // Le statistiche continuano ad aggiornarsi anche quando il pannello è chiuso
  }

  /**
   * Metodo update chiamato dal sistema ECS ogni frame
   */
  update(deltaTime: number): void {
    console.log('SkillsPanel.update() called, isVisible:', this.isVisible, 'statsContainer:', !!this.statsContainer);
    // Aggiorna le statistiche sempre (anche se il pannello è chiuso)
    // I calcoli sono leggeri e i valori saranno pronti quando il pannello si riapre
    if (this.statsContainer) {
      console.log('SkillsPanel: updating player stats');
      this.updatePlayerStats();
    }
  }
}
