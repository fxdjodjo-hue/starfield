import { System } from '../infrastructure/ecs/System';
import { ECS } from '../infrastructure/ecs/ECS';
import { Health } from '../entities/combat/Health';
import { Shield } from '../entities/combat/Shield';

/**
 * PlayerStatusDisplaySystem - Sistema semplice per mostrare HP e Shield del giocatore
 * Mostra solo testo centrato in basso per test rapidi
 */
export class PlayerStatusDisplaySystem extends System {
  private playerEntity: any = null;
  private statusElement: HTMLElement | null = null;

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Imposta l'entità player da monitorare
   */
  setPlayerEntity(entity: any): void {
    this.playerEntity = entity;
    this.createStatusDisplay();
  }

  /**
   * Crea l'elemento di display per HP e Shield
   */
  private createStatusDisplay(): void {
    if (this.statusElement) {
      this.statusElement.remove();
    }

    this.statusElement = document.createElement('div');
    this.statusElement.id = 'player-status-display';
    this.statusElement.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 24px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 25px;
      padding: 12px 24px;
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      z-index: 1000;
      pointer-events: none;
      transition: all 0.3s ease;
    `;

    document.body.appendChild(this.statusElement);
    this.updateDisplay();
  }

  /**
   * Aggiorna il display con i valori attuali di HP e Shield
   */
  private updateDisplay(): void {
    if (!this.statusElement || !this.playerEntity) return;

    const health = this.ecs.getComponent(this.playerEntity, Health);
    const shield = this.ecs.getComponent(this.playerEntity, Shield);

    // Svuota il contenitore
    this.statusElement.innerHTML = '';

    // Aggiungi sezione HP se presente
    if (health) {
      const healthSection = this.createStatSection('❤️', 'HP', health.current, health.max, '#10b981');
      this.statusElement.appendChild(healthSection);
    }

    // Aggiungi sezione Shield se presente
    if (shield) {
      const shieldSection = this.createStatSection('🛡️', 'Shield', shield.current, shield.max, '#3b82f6');
      this.statusElement.appendChild(shieldSection);
    }

    // Se non ci sono dati, mostra messaggio
    if (!health && !shield) {
      this.statusElement.textContent = 'No health/shield data';
    }
  }

  /**
   * Crea una sezione per una statistica con icona, barra e valori
   */
  private createStatSection(icon: string, label: string, current: number, max: number, color: string): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 140px;
    `;

    // Icona
    const iconElement = document.createElement('span');
    iconElement.textContent = icon;
    iconElement.style.cssText = `
      font-size: 20px;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
    `;

    // Contenitore valori
    const valuesContainer = document.createElement('div');
    valuesContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    `;

    // Label
    const labelElement = document.createElement('div');
    labelElement.textContent = label;
    labelElement.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.7);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    `;

    // Valori
    const valuesElement = document.createElement('div');
    const percent = Math.round((current / max) * 100);
    valuesElement.textContent = `${current.toLocaleString()}/${max.toLocaleString()}`;
    valuesElement.style.cssText = `
      font-size: 14px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.95);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      font-variant-numeric: tabular-nums;
    `;

    // Barra di progresso
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      overflow: hidden;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
    `;

    const progressFill = document.createElement('div');
    progressFill.style.cssText = `
      width: ${percent}%;
      height: 100%;
      background: linear-gradient(90deg, ${color}, ${this.adjustColor(color, 20)});
      border-radius: 2px;
      transition: width 0.3s ease;
      box-shadow: 0 0 6px ${color}40;
    `;

    progressBar.appendChild(progressFill);
    valuesContainer.appendChild(labelElement);
    valuesContainer.appendChild(valuesElement);
    valuesContainer.appendChild(progressBar);

    section.appendChild(iconElement);
    section.appendChild(valuesContainer);

    return section;
  }

  /**
   * Schiarisce leggermente un colore per il gradiente
   */
  private adjustColor(color: string, amount: number): string {
    // Semplice funzione per schiarire colori hex
    const hex = color.replace('#', '');
    const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + amount);
    const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + amount);
    const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Aggiorna il sistema (chiamato ogni frame)
   */
  update(deltaTime: number): void {
    if (this.playerEntity && this.statusElement) {
      this.updateDisplay();
    }
  }

  /**
   * Rimuove il display quando il sistema viene distrutto
   */
  destroy(): void {
    if (this.statusElement) {
      this.statusElement.remove();
      this.statusElement = null;
    }
  }
}
