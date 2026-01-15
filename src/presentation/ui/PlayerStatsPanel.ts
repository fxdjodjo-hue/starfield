import { BasePanel } from './UIManager';
import type { PanelConfig } from './PanelConfig';
import type { PanelData } from './UIManager';

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

  constructor(config: PanelConfig) {
    super(config);
  }

  /**
   * Crea il contenuto del pannello delle statistiche
   */
  protected createPanelContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'player-stats-content';
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
      scrollbar-width: none;
      -ms-overflow-style: none;
    `;
    // Hide scrollbar for webkit browsers
    const style = document.createElement('style');
    style.textContent = `.player-stats-content::-webkit-scrollbar { display: none; }`;
    content.appendChild(style);


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
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(239, 68, 68, 0.9)';
      closeButton.style.borderColor = 'rgba(239, 68, 68, 0.5)';
      closeButton.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3)';
    });

    closeButton.addEventListener('click', () => {
      this.hide();
    });

    content.appendChild(closeButton);

    // Header moderno con gradiente
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
    title.textContent = 'Player Statistics';
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
    subtitle.textContent = 'Monitor your progress and statistics';
    subtitle.style.cssText = `
      margin: 4px 0 0 0;
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      font-weight: 400;
    `;

    header.appendChild(title);
    header.appendChild(subtitle);
    content.appendChild(header);

    // Stats container con griglia moderna
    const statsContainer = document.createElement('div');
    statsContainer.className = 'stats-container';
    statsContainer.style.cssText = `
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      align-items: start;
    `;

    // Sezioni statistiche con design moderno
    const levelSection = this.createModernStatCard('', 'Livello', 'level-display', '#fbbf24');
    const expSection = this.createModernStatCard('', 'Esperienza', 'exp-display', '#10b981');
    const creditsSection = this.createModernStatCard('', 'Crediti', 'credits-display', '#f59e0b');
    const honorSection = this.createModernStatCard('', 'Onore', 'honor-display', '#ef4444');
    const killsSection = this.createModernStatCard('', 'Uccisioni', 'kills-display', '#8b5cf6');
    const timeSection = this.createModernStatCard('', 'Tempo Gioco', 'time-display', '#06b6d4');

    statsContainer.appendChild(levelSection);
    statsContainer.appendChild(expSection);
    statsContainer.appendChild(creditsSection);
    statsContainer.appendChild(honorSection);
    statsContainer.appendChild(killsSection);
    statsContainer.appendChild(timeSection);

    content.appendChild(statsContainer);

    return content;
  }

  /**
   * Crea una card moderna per una statistica
   */
  private createModernStatCard(icon: string, label: string, elementId: string, accentColor: string): HTMLElement {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      border-left: 4px solid ${accentColor};
    `;

    // Hover effect
    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
      card.style.borderColor = accentColor;
    });

    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
      card.style.borderColor = 'rgba(148, 163, 184, 0.2)';
    });

    // Header con icona
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    `;

    const iconElement = document.createElement('span');
    iconElement.textContent = icon;
    iconElement.style.cssText = `
      font-size: 18px;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
    `;

    const labelElement = document.createElement('span');
    labelElement.textContent = label;
    labelElement.style.cssText = `
      color: rgba(255, 255, 255, 0.8);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;

    header.appendChild(iconElement);
    header.appendChild(labelElement);

    // Valore
    const valueElement = document.createElement('div');
    valueElement.id = elementId;
    valueElement.style.cssText = `
      color: rgba(255, 255, 255, 0.95);
      font-size: 18px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    `;

    card.appendChild(header);
    card.appendChild(valueElement);

    return card;
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
      levelElement.textContent = `${this.statsData.level}`;
    }

    // Esperienza con progress bar
    const expElement = this.container.querySelector('#exp-display') as HTMLElement;
    if (expElement) {
      const expPercent = Math.round((this.statsData.experience / this.statsData.experienceForNext) * 100);
      expElement.innerHTML = `
        <div style="margin-bottom: 6px; font-size: 14px;">
          ${this.statsData.experience.toLocaleString()}/${this.statsData.experienceForNext.toLocaleString()}
        </div>
        <div style="width: 100%; height: 6px; background: rgba(148, 163, 184, 0.2); border-radius: 3px; overflow: hidden;">
          <div style="width: ${expPercent}%; height: 100%; background: linear-gradient(90deg, #10b981, #34d399); border-radius: 3px; transition: width 0.5s ease;"></div>
        </div>
        <div style="margin-top: 4px; font-size: 11px; color: rgba(255, 255, 255, 0.6);">
          ${expPercent}% al prossimo livello
        </div>
      `;
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
  /**
   * Callback chiamato quando il pannello viene mostrato
   */
  protected onShow(): void {
    // Potrebbe servire per aggiornare dati in tempo reale o animazioni
  }

  /**
   * Callback chiamato quando il pannello viene nascosto
   */
  protected onHide(): void {
    // Potrebbe servire per salvare stato o cleanup
  }
}
