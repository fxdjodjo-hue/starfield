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
    console.log('PlayerStatusDisplay: setPlayerEntity called with entity:', entity?.id);
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
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px 20px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 16px;
      font-weight: bold;
      text-align: center;
      border: 2px solid rgba(255, 255, 255, 0.3);
      z-index: 1000;
      pointer-events: none;
    `;

    document.body.appendChild(this.statusElement);
    this.updateDisplay();
  }

  /**
   * Aggiorna il display con i valori attuali di HP e Shield
   */
  private updateDisplay(): void {
    if (!this.statusElement || !this.playerEntity) {
      console.log('PlayerStatusDisplay: No statusElement or playerEntity');
      return;
    }

    const health = this.ecs.getComponent(this.playerEntity, Health);
    const shield = this.ecs.getComponent(this.playerEntity, Shield);

    console.log('PlayerStatusDisplay update:', {
      playerEntity: this.playerEntity?.id,
      health: health ? { current: health.current, max: health.max } : null,
      shield: shield ? { current: shield.current, max: shield.max } : null
    });

    let statusText = '';

    if (health) {
      const healthPercent = Math.round((health.current / health.max) * 100);
      statusText += `HP: ${health.current.toLocaleString()}/${health.max.toLocaleString()} (${healthPercent}%)`;
    }

    if (shield) {
      if (statusText) statusText += ' | ';
      const shieldPercent = Math.round((shield.current / shield.max) * 100);
      statusText += `Shield: ${shield.current.toLocaleString()}/${shield.max.toLocaleString()} (${shieldPercent}%)`;
    }

    if (!statusText) {
      statusText = 'No health/shield data';
    }

    this.statusElement.textContent = statusText;
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
