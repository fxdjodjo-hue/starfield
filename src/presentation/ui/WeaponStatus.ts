import { DisplayManager } from '../../infrastructure/display';
import { applyFadeIn } from '../../core/utils/rendering/UIFadeAnimation';

/**
 * WeaponStatus - Componente UI standalone per i cooldown delle armi
 * Visualizza cerchi di ricarica per Laser e Missili al centro-bottom
 */
export class WeaponStatus {
  private container: HTMLElement;
  private isVisible: boolean = false;
  private dprCompensation: number;

  constructor() {
    const dpr = DisplayManager.getInstance().getDevicePixelRatio();
    this.dprCompensation = 1 / dpr;
    this.container = this.createStatusContainer();
    document.body.appendChild(this.container);
  }

  /**
   * Crea il contenitore DOM per i cooldown
   */
  private createStatusContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'weapon-status';

    const c = this.dprCompensation;

    container.style.cssText = `
      position: fixed;
      bottom: ${Math.round(120 * c)}px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: ${Math.round(15 * c)}px;
      pointer-events: none;
      z-index: 1000;
      display: none; /* Hidden by default */
    `;

    container.innerHTML = `
      <div class="cooldown-circle-container" id="laser-indicator">
        <svg class="cooldown-svg" viewBox="0 0 36 36">
          <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          <path id="laser-progress" class="circle-progress" stroke-dasharray="0, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        </svg>
        <div class="weapon-label">L</div>
      </div>
      <div class="cooldown-circle-container" id="missile-indicator">
        <svg class="cooldown-svg" viewBox="0 0 36 36">
          <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          <path id="missile-progress" class="circle-progress" stroke-dasharray="0, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        </svg>
        <div class="weapon-label">M</div>
      </div>
    `;

    this.attachStyles();
    return container;
  }

  /**
   * Applica gli stili CSS specifici
   */
  private attachStyles(): void {
    const id = 'weapon-status-styles';
    if (document.getElementById(id)) return;

    const c = this.dprCompensation;
    const style = document.createElement('style');
    style.id = id;

    style.textContent = `
      .cooldown-circle-container {
        position: relative;
        width: ${Math.round(50 * c)}px;
        height: ${Math.round(50 * c)}px;
        background: rgba(0, 20, 30, 0.6);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(0, 255, 255, 0.2);
        box-shadow: 0 0 15px rgba(0, 255, 255, 0.1);
        backdrop-filter: blur(5px);
      }

      .cooldown-svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }

      .circle-bg {
        fill: none;
        stroke: rgba(0, 255, 255, 0.1);
        stroke-width: 2;
      }

      .circle-progress {
        fill: none;
        stroke: rgba(0, 255, 255, 0.8);
        stroke-width: 2.5;
        stroke-linecap: round;
        transition: stroke-dasharray 0.05s linear, stroke 0.3s ease;
      }

      #missile-indicator .circle-progress {
        stroke: rgba(255, 100, 0, 0.8);
      }

      #missile-indicator .circle-bg {
        stroke: rgba(255, 100, 0, 0.1);
      }

      .weapon-label {
        font-family: 'Segoe UI', Roboto, sans-serif;
        font-size: ${Math.round(14 * c)}px;
        font-weight: 800;
        color: white;
        text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
        z-index: 1;
        transition: color 0.3s ease, transform 0.2s ease;
        text-align: center;
        width: 100%;
      }
      
      .cooldown-active .weapon-label {
        color: #ffcc00;
        font-size: ${Math.round(16 * c)}px;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Mostra il componente
   */
  public show(): void {
    this.container.style.display = 'flex';
    if (!this.isVisible) {
      applyFadeIn(this.container);
      this.isVisible = true;
    }
  }

  /**
   * Nasconde il componente
   */
  public hide(): void {
    this.container.style.display = 'none';
    this.isVisible = false;
  }

  /**
   * Aggiorna lo stato dei cooldown
   * @param laserProgress 0.0 to 1.0
   * @param missileProgress 0.0 to 1.0
   * @param laserRemaining ms rimanenti
   * @param missileRemaining ms rimanenti
   */
  public update(laserProgress: number, missileProgress: number, laserRemaining: number = 0, missileRemaining: number = 0): void {
    const laserPath = this.container.querySelector('#laser-progress') as SVGPathElement;
    const missilePath = this.container.querySelector('#missile-progress') as SVGPathElement;
    const laserLabel = this.container.querySelector('#laser-indicator .weapon-label') as HTMLElement;
    const missileLabel = this.container.querySelector('#missile-indicator .weapon-label') as HTMLElement;
    const laserCont = this.container.querySelector('#laser-indicator') as HTMLElement;
    const missileCont = this.container.querySelector('#missile-indicator') as HTMLElement;

    if (laserPath) {
      const percentage = Math.min(100, Math.max(0, laserProgress * 100));
      laserPath.setAttribute('stroke-dasharray', `${percentage}, 100`);
      laserPath.style.stroke = percentage >= 100 ? 'rgba(0, 255, 255, 0.9)' : 'rgba(0, 255, 255, 0.5)';

      if (laserLabel) {
        if (laserRemaining > 100) {
          laserLabel.textContent = (laserRemaining / 1000).toFixed(1);
          laserCont.classList.add('cooldown-active');
        } else {
          laserLabel.textContent = 'L';
          laserCont.classList.remove('cooldown-active');
        }
      }
    }

    if (missilePath) {
      const percentage = Math.min(100, Math.max(0, missileProgress * 100));
      missilePath.setAttribute('stroke-dasharray', `${percentage}, 100`);
      missilePath.style.stroke = percentage >= 100 ? 'rgba(255, 150, 0, 0.9)' : 'rgba(255, 100, 0, 0.5)';

      if (missileLabel) {
        if (missileRemaining > 100) {
          missileLabel.textContent = (missileRemaining / 1000).toFixed(1);
          missileCont.classList.add('cooldown-active');
        } else {
          missileLabel.textContent = 'M';
          missileCont.classList.remove('cooldown-active');
        }
      }
    }
  }

  /**
   * Distrugge il componente
   */
  public destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    const style = document.getElementById('weapon-status-styles');
    if (style) style.remove();
  }
}
