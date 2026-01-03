import { BasePanel } from './UIManager';
import type { PanelConfig } from './PanelConfig';
import { ECS } from '../../infrastructure/ecs/ECS';
import { PlayerStatusDisplaySystem } from '../../systems/PlayerStatusDisplaySystem';
import { Experience } from '../../entities/Experience';
import { getPlayerDefinition } from '../../config/PlayerConfig';

/**
 * SkillsPanel - Pannello per visualizzare statistiche giocatore e gestire abilità
 */
export class SkillsPanel extends BasePanel {
  private ecs: ECS;
  private statsContainer: HTMLElement | null = null;
  private updateInterval: number | null = null;
  private isVisible: boolean = false;
  private playerStatusDisplaySystem: PlayerStatusDisplaySystem;

  constructor(config: PanelConfig, ecs: ECS, playerStatusDisplaySystem: PlayerStatusDisplaySystem) {
    super(config);
    this.ecs = ecs;
    this.playerStatusDisplaySystem = playerStatusDisplaySystem;
  }

  /**
   * Imposta l'entità player da monitorare
   */
  setPlayerEntity(entity: any): void {
    this.playerEntity = entity;
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

    // Le statistiche verranno aggiornate quando il pannello diventa visibile (onShow)

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
      const dataStat = stat.label.toLowerCase().replace(' ', '-');
      value.setAttribute('data-stat', dataStat);
      value.className = 'stat-value';
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
    if (!this.statsContainer) return;

    // Usa gli stessi valori del PlayerStatusDisplaySystem per garantire sincronizzazione
    const health = this.playerStatusDisplaySystem.getPlayerHealth();
    const shield = this.playerStatusDisplaySystem.getPlayerShield();

    // Per experience e velocità usa ancora l'ECS dato che non sono nel PlayerStatusDisplaySystem
    const experience = this.playerEntity ? this.ecs.getComponent(this.playerEntity, Experience) : null;
    const playerDef = getPlayerDefinition();


    // Aggiorna statistiche combattimento
    if (health) {
      const healthElements = this.statsContainer.querySelectorAll('[data-stat="hp"]');
      healthElements.forEach((el: HTMLElement) => {
        el.textContent = `${health.current.toLocaleString()}/${health.max.toLocaleString()}`;
      });
    }

    if (shield) {
      const shieldElements = this.statsContainer.querySelectorAll('[data-stat="shield"]');
      shieldElements.forEach((el: HTMLElement) => {
        el.textContent = `${shield.current.toLocaleString()}/${shield.max.toLocaleString()}`;
      });
    }

    // Usa la velocità del player dal config
    const speedElements = this.statsContainer.querySelectorAll('[data-stat="speed"]');
    speedElements.forEach((el: HTMLElement) => {
      const playerDef = getPlayerDefinition();
      el.textContent = `${playerDef.stats.speed} u/s`;
    });

    // Aggiorna statistiche progressione
    if (experience) {
      const levelElements = this.statsContainer.querySelectorAll('[data-stat="livello"]');
      levelElements.forEach((el: HTMLElement) => {
        el.textContent = experience.level.toString();
      });

      const expElements = this.statsContainer.querySelectorAll('[data-stat="esperienza"]');
      expElements.forEach((el: HTMLElement) => {
        el.textContent = `${experience.exp.toLocaleString()}/${experience.expForNextLevel.toLocaleString()}`;
      });
    }

    // Punti abilità (placeholder - per ora 0)
    const skillElements = this.statsContainer.querySelectorAll('[data-stat="punti-abilità"]');
    skillElements.forEach((el: HTMLElement) => {
      el.textContent = '0';
    });
  }

  /**
   * Metodo update chiamato dal sistema ECS ogni frame
   */
  update(deltaTime: number): void {
    // Aggiorna solo se il pannello è visibile
    if (this.isVisible) {
      this.updatePlayerStats();
    }
  }

  /**
   * Callback quando il pannello viene mostrato
   */
  protected onShow(): void {
    this.isVisible = true;
    // Aggiorna le statistiche quando il pannello diventa visibile
    this.updatePlayerStats();
  }

  /**
   * Callback quando il pannello viene nascosto
   */
  protected onHide(): void {
    this.isVisible = false;
  }
}
