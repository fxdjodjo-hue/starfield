import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { DisplayManager } from '../../infrastructure/display';
import { applyFadeIn } from '../../core/utils/rendering/UIFadeAnimation';

/**
 * PlayerStatusDisplaySystem - Sistema semplice per mostrare HP e Shield del giocatore
 * Mostra solo testo centrato in basso per test rapidi
 */
export class PlayerStatusDisplaySystem extends System {
  private playerEntity: Entity | null = null;
  private statusElement: HTMLElement | null = null;
  private dprCompensation: number;

  constructor(ecs: ECS) {
    super(ecs);
    const dpr = DisplayManager.getInstance().getDevicePixelRatio();
    this.dprCompensation = 1 / dpr;
  }

  /**
   * Imposta l'entità player da monitorare
   */
  setPlayerEntity(entity: Entity): void {
    this.playerEntity = entity;
    this.createStatusDisplay();
  }

  /**
   * Crea l'elemento di display per HP e Shield con dimensioni compensate per DPR
   */
  private createStatusDisplay(): void {
    if (this.statusElement) {
      this.statusElement.remove();
    }

    const c = this.dprCompensation;
    
    this.statusElement = document.createElement('div');
    this.statusElement.id = 'player-status-display';
    this.statusElement.style.cssText = `
      position: fixed;
      bottom: ${Math.round(20 * c)}px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      align-items: stretch;
      gap: ${Math.round(32 * c)}px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: ${Math.round(25 * c)}px;
      padding: ${Math.round(16 * c)}px ${Math.round(24 * c)}px;
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      z-index: 1000;
      pointer-events: none;
    `;

    document.body.appendChild(this.statusElement);
    this.updateDisplay();
    
    // Nascondi inizialmente - verrà mostrato quando la schermata di autenticazione viene nascosta
    this.hide();
  }

  /**
   * Aggiorna il display con i valori attuali di HP e Shield
   * Metodo pubblico per permettere aggiornamenti forzati da altri sistemi
   */
  public updateDisplay(): void {
    if (!this.statusElement || !this.playerEntity) return;

    const health = this.ecs.getComponent(this.playerEntity, Health);
    const shield = this.ecs.getComponent(this.playerEntity, Shield);


    // Svuota il contenitore
    this.statusElement.innerHTML = '';

    // Aggiungi sezione HP se presente
    if (health) {
      const healthSection = this.createStatSection('HP', health.current, health.max, '#10b981');
      this.statusElement.appendChild(healthSection);
    }

    // Aggiungi sezione Shield se presente
    if (shield) {
      const shieldSection = this.createStatSection('SHD', shield.current, shield.max, '#3b82f6');
      this.statusElement.appendChild(shieldSection);
    }

    // Se non ci sono dati, mostra messaggio
    if (!health && !shield) {
      this.statusElement.textContent = 'No health/shield data';
    }
  }

  /**
   * Crea una sezione per una statistica con barra e valori (dimensioni compensate per DPR)
   */
  private createStatSection(label: string, current: number, max: number, color: string): HTMLElement {
    const c = this.dprCompensation;
    
    const section = document.createElement('div');
    section.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: ${Math.round(8 * c)}px;
      min-width: ${Math.round(120 * c)}px;
      align-items: center;
    `;

    // Contenitore header con label e valori
    const headerContainer = document.createElement('div');
    headerContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      gap: ${Math.round(12 * c)}px;
    `;

    // Label
    const labelElement = document.createElement('div');
    labelElement.textContent = label;
    labelElement.style.cssText = `
      font-size: ${Math.round(11 * c)}px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.8);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    `;

    // Valori
    const valuesElement = document.createElement('div');
    const percent = Math.round((current / max) * 100);
    valuesElement.textContent = `${current.toLocaleString()}/${max.toLocaleString()}`;
    valuesElement.style.cssText = `
      font-size: ${Math.round(12 * c)}px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.95);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      font-variant-numeric: tabular-nums;
    `;

    // Barra di progresso
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
      width: 100%;
      height: ${Math.round(6 * c)}px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: ${Math.round(3 * c)}px;
      overflow: hidden;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;

    const progressFill = document.createElement('div');
    progressFill.style.cssText = `
      width: ${percent}%;
      height: 100%;
      background: linear-gradient(90deg, ${color}, ${this.adjustColor(color, 30)});
      border-radius: ${Math.round(2 * c)}px;
      transition: width 0.4s ease;
      box-shadow: 0 0 ${Math.round(8 * c)}px ${color}60;
    `;

    progressBar.appendChild(progressFill);
    headerContainer.appendChild(labelElement);
    headerContainer.appendChild(valuesElement);

    section.appendChild(headerContainer);
    section.appendChild(progressBar);

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

  private lastUpdateTime: number = 0;
  private readonly UPDATE_INTERVAL = 100; // Update ogni 100ms invece che ogni frame

  /**
   * Aggiorna il sistema (chiamato ogni frame)
   */
  update(deltaTime: number): void {
    if (this.playerEntity && this.statusElement) {
      const now = Date.now();
      if (now - this.lastUpdateTime >= this.UPDATE_INTERVAL) {
        this.lastUpdateTime = now;
        this.updateDisplay();
      }
    }
  }

  /**
   * Verifica se un click è dentro l'area dell'HUD del player status
   */
  isClickInHUD(screenX: number, screenY: number): boolean {
    if (!this.statusElement || !this.statusElement.parentElement) return false;

    const rect = this.statusElement.getBoundingClientRect();
    return screenX >= rect.left && screenX <= rect.right &&
           screenY >= rect.top && screenY <= rect.bottom;
  }

  /**
   * Mostra il display HP/Shield
   */
  show(): void {
    if (this.statusElement) {
      this.statusElement.style.display = 'flex';
      // Usa fade-in sincronizzato (mantiene translateX(-50%) per centrare)
      applyFadeIn(this.statusElement, 'translateX(-50%)');
    }
  }

  /**
   * Nasconde il display HP/Shield
   */
  hide(): void {
    if (this.statusElement) {
      this.statusElement.style.display = 'none';
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