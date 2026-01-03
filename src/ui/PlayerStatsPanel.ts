import { BasePanel } from './UIManager';
import type { PanelConfig, PanelData } from './UIManager';

/**
 * Dati per il pannello delle statistiche del giocatore
 */
export interface PlayerStatsData {
  level: number;
  experience: number;
  experienceForNext: number;
  credits: number;
  honor: number;
  kills: number;
  playtime: number; // in minuti
}

/**
 * PlayerStatsPanel - Pannello che mostra le statistiche dettagliate del giocatore
 * Implementa l'interfaccia BasePanel per l'integrazione nel sistema UI
 */
export class PlayerStatsPanel extends BasePanel {
  private statsData: PlayerStatsData = {
    level: 1,
    experience: 0,
    experienceForNext: 1000,
    credits: 0,
    honor: 0,
    kills: 0,
    playtime: 0
  };

  constructor() {
    const config: PanelConfig = {
      id: 'player-stats',
      icon: '📊',
      title: 'Statistiche Giocatore',
      position: 'top-right',
      size: { width: 320, height: 400 }
    };

    super(config);
  }

  /**
   * Crea il contenuto del pannello delle statistiche
   */
  protected createPanelContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'player-stats-content';
    content.style.cssText = `
      padding: 20px;
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      text-align: center;
      border-bottom: 1px solid rgba(148, 163, 184, 0.3);
      padding-bottom: 12px;
      margin-bottom: 8px;
    `;

    const title = document.createElement('h3');
    title.textContent = '📊 Statistiche';
    title.style.cssText = `
      margin: 0;
      color: rgba(148, 163, 184, 0.9);
      font-size: 18px;
      font-weight: 600;
    `;

    header.appendChild(title);
    content.appendChild(header);

    // Stats container
    const statsContainer = document.createElement('div');
    statsContainer.className = 'stats-container';
    statsContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    // Livello ed esperienza
    const levelSection = this.createStatSection('🏆 Livello', 'level-display');
    const expSection = this.createStatSection('⭐ Esperienza', 'exp-display');

    // Risorse
    const creditsSection = this.createStatSection('💰 Crediti', 'credits-display');
    const honorSection = this.createStatSection('⚔️ Onore', 'honor-display');

    // Statistiche di gioco
    const killsSection = this.createStatSection('💀 Uccisioni', 'kills-display');
    const timeSection = this.createStatSection('⏱️ Tempo di gioco', 'time-display');

    statsContainer.appendChild(levelSection);
    statsContainer.appendChild(expSection);
    statsContainer.appendChild(creditsSection);
    statsContainer.appendChild(honorSection);
    statsContainer.appendChild(killsSection);
    statsContainer.appendChild(timeSection);

    content.appendChild(statsContainer);

    // Footer con pulsante di chiusura
    const footer = document.createElement('div');
    footer.style.cssText = `
      border-top: 1px solid rgba(148, 163, 184, 0.3);
      padding-top: 12px;
      text-align: center;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Chiudi';
    closeButton.style.cssText = `
      background: rgba(239, 68, 68, 0.8);
      border: none;
      border-radius: 6px;
      color: white;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s ease;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(239, 68, 68, 1)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(239, 68, 68, 0.8)';
    });

    closeButton.addEventListener('click', () => {
      this.hide();
    });

    footer.appendChild(closeButton);
    content.appendChild(footer);

    return content;
  }

  /**
   * Crea una sezione per una statistica
   */
  private createStatSection(label: string, elementId: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'stat-section';
    section.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: rgba(148, 163, 184, 0.1);
      border-radius: 8px;
      border: 1px solid rgba(148, 163, 184, 0.2);
    `;

    const labelElement = document.createElement('span');
    labelElement.textContent = label;
    labelElement.style.cssText = `
      color: rgba(148, 163, 184, 0.8);
      font-size: 14px;
      font-weight: 500;
    `;

    const valueElement = document.createElement('span');
    valueElement.id = elementId;
    valueElement.style.cssText = `
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    `;

    section.appendChild(labelElement);
    section.appendChild(valueElement);

    return section;
  }

  /**
   * Aggiorna i dati del pannello
   */
  update(data: PanelData): void {
    const statsData = data as PlayerStatsData;
    if (!statsData) return;

    // Aggiorna i dati interni
    Object.assign(this.statsData, statsData);

    // Aggiorna l'interfaccia
    this.updateDisplay();
  }

  /**
   * Aggiorna la visualizzazione dei dati
   */
  private updateDisplay(): void {
    // Livello
    const levelElement = this.container.querySelector('#level-display') as HTMLElement;
    if (levelElement) {
      levelElement.textContent = this.statsData.level.toString();
    }

    // Esperienza
    const expElement = this.container.querySelector('#exp-display') as HTMLElement;
    if (expElement) {
      const expPercent = Math.round((this.statsData.experience / this.statsData.experienceForNext) * 100);
      expElement.textContent = `${this.statsData.experience.toLocaleString()}/${this.statsData.experienceForNext.toLocaleString()} (${expPercent}%)`;
    }

    // Crediti
    const creditsElement = this.container.querySelector('#credits-display') as HTMLElement;
    if (creditsElement) {
      creditsElement.textContent = this.statsData.credits.toLocaleString();
    }

    // Onore
    const honorElement = this.container.querySelector('#honor-display') as HTMLElement;
    if (honorElement) {
      honorElement.textContent = this.statsData.honor.toLocaleString();
    }

    // Uccisioni
    const killsElement = this.container.querySelector('#kills-display') as HTMLElement;
    if (killsElement) {
      killsElement.textContent = this.statsData.kills.toLocaleString();
    }

    // Tempo di gioco
    const timeElement = this.container.querySelector('#time-display') as HTMLElement;
    if (timeElement) {
      const hours = Math.floor(this.statsData.playtime / 60);
      const minutes = this.statsData.playtime % 60;
      timeElement.textContent = `${hours}h ${minutes}m`;
    }
  }

  /**
   * Callback quando il pannello viene mostrato
   */
  protected onShow(): void {
    console.log('PlayerStatsPanel: Panel opened');
    // Potrebbe servire per aggiornare dati in tempo reale o animazioni
  }

  /**
   * Callback quando il pannello viene nascosto
   */
  protected onHide(): void {
    console.log('PlayerStatsPanel: Panel closed');
    // Potrebbe servire per salvare stato o cleanup
  }
}
