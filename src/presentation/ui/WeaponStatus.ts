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
      bottom: ${Math.round(130 * c)}px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      justify-content: center;
      align-items: center;
      gap: ${Math.round(12 * c)}px;
      pointer-events: auto; /* Enable hover */
      z-index: 1000;
      display: none; /* Hidden by default */
    `;

    container.innerHTML = `
      <div class="cooldown-square-container" id="laser-indicator">
        <div class="weapon-tooltip">LASER</div>
        <svg class="cooldown-svg" viewBox="0 0 36 36">
          <rect class="square-bg" x="3" y="3" width="30" height="30" rx="3" pathLength="100" />
          <rect id="laser-progress" class="square-progress" x="3" y="3" width="30" height="30" rx="3" pathLength="100" />
        </svg>
        <img src="assets/weapon_status/laser_icon.png" class="weapon-icon" id="laser-icon" alt="Laser">
        <div class="weapon-label" id="laser-timer"></div>
        <div class="weapon-shortcut">SPACEBAR</div>
      </div>
      <div class="cooldown-square-container" id="missile-indicator">
        <div class="weapon-tooltip">MISSILES</div>
        <svg class="cooldown-svg" viewBox="0 0 36 36">
          <rect class="square-bg" x="3" y="3" width="30" height="30" rx="3" pathLength="100" />
          <rect id="missile-progress" class="square-progress" x="3" y="3" width="30" height="30" rx="3" pathLength="100" />
        </svg>
        <img src="assets/weapon_status/missile_icon.png" class="weapon-icon" id="missile-icon" alt="Missiles">
        <div class="weapon-label" id="missile-timer"></div>
        <div class="weapon-shortcut">AUTO</div>
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
      .cooldown-square-container {
        position: relative;
        width: ${Math.round(52 * c)}px;
        height: ${Math.round(52 * c)}px;
        background: rgba(0, 0, 0, 0.45);
        border-radius: ${Math.round(6 * c)}px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(20px) saturate(160%);
        -webkit-backdrop-filter: blur(20px) saturate(160%);
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        pointer-events: auto;
        cursor: default;
      }

      .cooldown-square-container:hover {
        border-color: rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.05);
      }

      .weapon-tooltip {
        position: absolute;
        bottom: 110%;
        left: 50%;
        transform: translateX(-50%) translateY(5px);
        background: rgba(0, 0, 0, 0.6);
        color: rgba(255, 255, 255, 0.9);
        padding: ${Math.round(4 * c)}px ${Math.round(8 * c)}px;
        border-radius: ${Math.round(4 * c)}px;
        font-family: 'Segoe UI', sans-serif;
        font-size: ${Math.round(10 * c)}px;
        font-weight: 700;
        letter-spacing: 1px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: all 0.25s ease;
        border: 1px solid rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
      }

      .cooldown-square-container:hover .weapon-tooltip {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      .cooldown-svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }

      .square-bg {
        fill: none;
        stroke: rgba(255, 255, 255, 0.04);
        stroke-width: 1.2;
      }

      .square-progress {
        fill: none;
        stroke: rgba(255, 255, 255, 0.8);
        stroke-width: 1.8;
        stroke-linecap: round;
        transition: stroke-dasharray 0.08s linear, stroke 0.3s ease;
      }

      .weapon-icon {
        position: absolute;
        width: 100%;
        height: 100%;
        object-fit: contain;
        opacity: 0.8;
        transition: all 0.3s ease;
        z-index: 0;
      }

      .weapon-label {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: ${Math.round(14 * c)}px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.95);
        text-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
        z-index: 2;
        transition: all 0.3s ease;
        text-align: center;
        width: 100%;
        pointer-events: none;
      }
      
      .cooldown-active .weapon-icon {
        opacity: 0.2;
        filter: grayscale(1) scale(0.9);
      }

      .cooldown-active .weapon-label {
        font-size: ${Math.round(16 * c)}px;
      }

      .weapon-shortcut {
        position: absolute;
        top: 105%;
        left: 50%;
        transform: translateX(-50%);
        color: rgba(255, 255, 255, 0.3);
        font-size: ${Math.round(8 * c)}px;
        font-weight: 800;
        letter-spacing: 1px;
        text-transform: uppercase;
        pointer-events: none;
        white-space: nowrap;
        text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
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
      // 🚀 FIX ALLINEAMENTO: Passiamo 'translateX(-50%)' per evitare che l'animazione sovrascriva il centramento
      applyFadeIn(this.container, 'translateX(-50%)');
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
    const laserLabel = this.container.querySelector('#laser-timer') as HTMLElement;
    const missileLabel = this.container.querySelector('#missile-timer') as HTMLElement;
    const laserCont = this.container.querySelector('#laser-indicator') as HTMLElement;
    const missileCont = this.container.querySelector('#missile-indicator') as HTMLElement;

    if (laserPath) {
      const percentage = Math.min(100, Math.max(0, laserProgress * 100));
      laserPath.setAttribute('stroke-dasharray', `${percentage}, 100`);
      laserPath.style.stroke = percentage >= 100 ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.4)';

      if (laserLabel) {
        if (laserRemaining > 100) {
          laserLabel.textContent = (laserRemaining / 1000).toFixed(1);
          laserCont.classList.add('cooldown-active');
        } else {
          laserLabel.textContent = '';
          laserCont.classList.remove('cooldown-active');
        }
      }
    }

    if (missilePath) {
      const percentage = Math.min(100, Math.max(0, missileProgress * 100));
      missilePath.setAttribute('stroke-dasharray', `${percentage}, 100`);
      missilePath.style.stroke = percentage >= 100 ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.4)';

      if (missileLabel) {
        if (missileRemaining > 100) {
          missileLabel.textContent = (missileRemaining / 1000).toFixed(1);
          missileCont.classList.add('cooldown-active');
        } else {
          missileLabel.textContent = '';
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
