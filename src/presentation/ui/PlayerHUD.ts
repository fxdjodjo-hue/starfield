import { DisplayManager, DISPLAY_CONSTANTS } from '../../infrastructure/display';
import { applyFadeIn } from '../../core/utils/rendering/UIFadeAnimation';
import { NumberFormatter } from '../../core/utils/ui/NumberFormatter';

/**
 * Interfaccia per i dati del Player HUD
 * Definisce il contratto tra logica di business e presentazione
 */
export interface PlayerHUDData {
  level: number;
  playerId: number;
  credits: number;
  cosmos: number;
  experience: number;
  expForNextLevel: number;
  honor: number;
  currentHealth?: number;
  maxHealth?: number;
  currentShield?: number;
  maxShield?: number;
}

/**
 * PlayerHUD - Gestisce la presentazione dell'HUD del giocatore
 * Separazione completa tra logica di business e presentazione UI
 */
export class PlayerHUD {
  private container: HTMLElement;
  private isVisible: boolean = false;
  private _isExpanded: boolean = false;
  private dprCompensation: number;

  constructor() {
    // Calcola compensazione DPR per dimensioni UI corrette
    const dpr = DisplayManager.getInstance().getDevicePixelRatio();
    this.dprCompensation = 1 / dpr;
    this.container = this.createHUDContainer();
  }

  /**
   * Crea il contenitore principale dell'HUD con stile glass
   * Dimensioni compensate per DPR di Windows
   */
  private createHUDContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'player-hud';

    // Dimensioni compensate per DPR
    const c = this.dprCompensation;
    const margin = Math.round(15 * c);
    const edgeOverlap = Math.max(4, Math.round(10 * c));
    // Arrotondamento degli angoli come gli altri pannelli (compensato)
    // The following lines appear to be a mix of canvas drawing code and variable declarations.
    // Assuming the intent was to ensure borderRadius is 25px scaled, which is already present.
    // The canvas drawing calls (this.roundedRect, ctx.fill) are not applicable here as this method creates a DOM element.
    // The 'onst gap' is a syntax error.
    // I will only apply the part that makes sense in this context, which is ensuring borderRadius is set.
    // Since 'const borderRadius = Math.round(25 * c);' already exists, I will ensure it's there.
    // The instruction's provided snippet seems to have extraneous code.
    const gap = Math.round(30 * c); // Increased from 15
    const borderRadius = Math.round(12 * c);
    const cornerCut = Math.max(8, Math.round(18 * c));
    const paddingV = Math.round(15 * c); // Increased from 12
    const paddingH = Math.round(40 * c); // Increased from 30 (more width)

    container.style.cssText = `
      position: fixed;
      top: -${edgeOverlap}px;
      left: 0;
      right: 0;
      width: fit-content;
      max-width: calc(100vw - ${margin * 2}px);
      margin-left: auto;
      margin-right: auto;
      box-sizing: border-box;
      display: none;
      align-items: center;
      gap: ${gap}px;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(20px) saturate(160%);
      -webkit-backdrop-filter: blur(20px) saturate(160%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: ${borderRadius}px;
      clip-path: polygon(
        ${cornerCut}px 0,
        calc(100% - ${cornerCut}px) 0,
        100% ${cornerCut}px,
        100% calc(100% - ${cornerCut}px),
        calc(100% - ${cornerCut}px) 100%,
        ${cornerCut}px 100%,
        0 calc(100% - ${cornerCut}px),
        0 ${cornerCut}px
      );
      padding: ${paddingV}px ${paddingH}px;
      box-shadow:
        0 12px 48px rgba(0, 0, 0, 0.5),
        inset 0 1px 1px rgba(255, 255, 255, 0.05);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      z-index: 1000;
      overflow: hidden;
      pointer-events: none;
    `;

    // Struttura HTML pulita
    container.innerHTML = `
      <div class="stats-side stats-side-left">
        <div class="stat-item" data-stat="experience">
          <div class="stat-label">EXPERIENCE</div>
          <div class="stat-value">0</div>
        </div>
        <div class="stat-item" data-stat="honor">
          <div class="stat-label">HONOR</div>
          <div class="stat-value">0</div>
        </div>
      </div>

      <div class="level-indicator">
        <div class="level-circle">
          <span class="level-number">1</span>
        </div>
        <div class="player-id">ID: 0</div>
        <div class="center-vitals">
          <div class="vital-row" data-vital="health">
            <div class="vital-header">
              <span class="vital-label">HITPOINTS</span>
              <span class="vital-value">0 / 1</span>
            </div>
            <div class="vital-track">
              <div class="vital-fill"></div>
            </div>
          </div>
          <div class="vital-row" data-vital="shield">
            <div class="vital-header">
              <span class="vital-label">SHIELD</span>
              <span class="vital-value">0 / 1</span>
            </div>
            <div class="vital-track">
              <div class="vital-fill"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="stats-side stats-side-right">
        <div class="stat-item" data-stat="credits">
          <div class="stat-label">CREDITS</div>
          <div class="stat-value">0</div>
        </div>
        <div class="stat-item" data-stat="cosmos">
          <div class="stat-label">COSMOS</div>
          <div class="stat-value">0</div>
        </div>
      </div>
    `;

    this.attachGlassStyles();
    return container;
  }

  /**
   * Applica gli stili glass moderni con dimensioni compensate per DPR
   */
  private attachGlassStyles(): void {
    const existingStyle = document.getElementById('player-hud-styles');
    if (existingStyle) {
      existingStyle.remove(); // Rimuovi per aggiornare con nuovi valori DPR
    }

    const style = document.createElement('style');
    style.id = 'player-hud-styles';

    // Calcola dimensioni compensate per DPR
    const c = this.dprCompensation;
    const circleSize = Math.round(50 * c);
    const levelFontSize = Math.round(18 * c);
    const idFontSize = Math.round(10 * c);
    const labelFontSize = Math.round(9 * c);
    const valueFontSize = Math.round(12 * c);
    const gap4 = Math.round(4 * c);
    const statsGap = Math.round(28 * c);
    const vitalContainerWidth = Math.round(420 * c);
    const vitalTrackHeight = Math.max(5, Math.round(6 * c));
    const vitalLabelFontSize = Math.round(8 * c);
    const vitalValueFontSize = Math.round(9 * c);
    const hudRadius = Math.round(12 * c);
    const hudCornerCut = Math.max(8, Math.round(18 * c));

    style.textContent = `
      /* Container principale con effetto glassmorphism */
      #player-hud {
        background:
          linear-gradient(130deg, rgba(37, 99, 235, 0.12) 0%, rgba(255, 255, 255, 0.03) 42%, rgba(14, 165, 233, 0.08) 100%),
          rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(20px) saturate(160%);
        -webkit-backdrop-filter: blur(20px) saturate(160%);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: ${hudRadius}px;
        clip-path: polygon(
          ${hudCornerCut}px 0,
          calc(100% - ${hudCornerCut}px) 0,
          100% ${hudCornerCut}px,
          100% calc(100% - ${hudCornerCut}px),
          calc(100% - ${hudCornerCut}px) 100%,
          ${hudCornerCut}px 100%,
          0 calc(100% - ${hudCornerCut}px),
          0 ${hudCornerCut}px
        );
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
        cursor: default;
        pointer-events: none;
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
      }


      /* Indicatore livello circolare */
      .level-indicator {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: ${gap4}px;
      }

      .level-circle {
        width: ${circleSize}px;
        height: ${circleSize}px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
      }

      .level-number {
        color: rgba(255, 255, 255, 0.95);
        font-weight: 800;
        font-size: ${levelFontSize}px;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        z-index: 1;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
      }

      .player-id {
        color: rgba(255, 255, 255, 0.7);
        font-size: ${idFontSize}px;
        font-weight: 500;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        letter-spacing: 0.5px;
      }

      .center-vitals {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        column-gap: ${Math.round(14 * c)}px;
        row-gap: 0;
        width: ${vitalContainerWidth}px;
        margin-top: ${Math.round(8 * c)}px;
      }

      .vital-row {
        display: flex;
        flex-direction: column;
        gap: ${Math.round(2 * c)}px;
      }

      .vital-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: ${Math.round(8 * c)}px;
      }

      .vital-label {
        color: rgba(255, 255, 255, 0.78);
        font-size: ${vitalLabelFontSize}px;
        font-weight: 700;
        letter-spacing: 0.6px;
        text-transform: uppercase;
      }

      .vital-value {
        color: rgba(255, 255, 255, 0.95);
        font-size: ${vitalValueFontSize}px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }

      .vital-track {
        width: 100%;
        height: ${vitalTrackHeight}px;
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.08);
        overflow: hidden;
      }

      .vital-fill {
        width: 0%;
        height: 100%;
        transition: width 0.25s ease-out;
      }

      .vital-row[data-vital="health"] .vital-fill {
        background: linear-gradient(90deg, #16a34a, #4ade80);
      }

      .vital-row[data-vital="shield"] .vital-fill {
        background: linear-gradient(90deg, #2563eb, #60a5fa);
      }


      .stats-side {
        display: flex;
        gap: ${statsGap}px;
        align-items: center;
        width: max-content;
      }

      .stats-side-left {
        justify-content: flex-end;
      }

      .stats-side-right {
        justify-content: flex-start;
      }

      .stat-item {
        min-width: max-content;
      }

      .stats-side-left .stat-item {
        text-align: right;
      }

      .stats-side-right .stat-item {
        text-align: left;
      }


      .stat-label {
        color: rgba(255, 255, 255, 0.8);
        font-size: ${labelFontSize}px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
      }

      .stat-value {
        color: rgba(255, 255, 255, 0.95);
        font-size: ${valueFontSize}px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
      }



      /* Responsive design - dimensioni già compensate per DPR */
      @media (max-width: 1400px) {
        #player-hud {
          padding: ${Math.round(10 * c)}px ${Math.round(16 * c)}px;
          gap: ${Math.round(12 * c)}px;
        }

        .level-circle {
          width: ${Math.round(42 * c)}px;
          height: ${Math.round(42 * c)}px;
        }

        .level-number {
          font-size: ${Math.round(15 * c)}px;
        }

        .player-id {
          font-size: ${Math.round(9 * c)}px;
        }

        .center-vitals {
          width: ${Math.round(340 * c)}px;
        }


        .stats-side {
          gap: ${Math.round(20 * c)}px;
        }

      }

      @media (max-width: 1200px) {
        .center-vitals {
          width: ${Math.round(290 * c)}px;
        }

        .stats-side {
          gap: ${Math.round(16 * c)}px;
        }

      }

      @media (max-width: 1000px) {
        .center-vitals {
          width: ${Math.round(240 * c)}px;
        }

        .stats-side {
          gap: ${Math.round(12 * c)}px;
        }

      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Mostra l'HUD
   */
  show(): void {
    if (!document.body.contains(this.container)) {
      document.body.appendChild(this.container);
    }

    this.container.style.display = 'flex';
    this.isVisible = true;

    // Usa fade-in sincronizzato
    applyFadeIn(this.container);
  }

  /**
   * Nasconde l'HUD
   */
  hide(): void {
    this.container.style.display = 'none';
    this.isVisible = false;
  }

  /**
   * Aggiorna i dati dell'HUD (solo presentazione, nessuna logica di business)
   */
  updateData(data: PlayerHUDData): void {
    // NON mostrare automaticamente - deve essere chiamato esplicitamente show()
    // if (!this.isVisible) {
    //   this.show();
    // }

    // Aggiorna livello
    const levelElement = this.container.querySelector('.level-number') as HTMLElement;
    if (levelElement) {
      levelElement.textContent = data.level.toString();
    }

    // Aggiorna ID giocatore
    const playerIdElement = this.container.querySelector('.player-id') as HTMLElement;
    if (playerIdElement) {
      playerIdElement.textContent = `ID: ${data.playerId}`;
    }

    const setStatValue = (stat: 'credits' | 'cosmos' | 'experience' | 'honor', value: number): void => {
      const valueElement = this.container.querySelector<HTMLElement>(
        `.stat-item[data-stat="${stat}"] .stat-value`
      );
      if (valueElement) {
        valueElement.textContent = this.formatNumber(value);
      }
    };

    setStatValue('credits', data.credits);
    setStatValue('cosmos', data.cosmos);
    setStatValue('experience', data.experience);
    setStatValue('honor', data.honor);

    this.updateCombatStatus({
      currentHealth: data.currentHealth ?? 0,
      maxHealth: data.maxHealth ?? 1,
      currentShield: data.currentShield ?? 0,
      maxShield: data.maxShield ?? 1
    });
  }

  /**
   * Aggiorna HP e Shield nel blocco centrale dell'HUD
   */
  updateCombatStatus(data: {
    currentHealth: number;
    maxHealth: number;
    currentShield: number;
    maxShield: number;
  }): void {
    this.updateVitalRow('health', data.currentHealth, data.maxHealth);
    this.updateVitalRow('shield', data.currentShield, data.maxShield);
  }

  private updateVitalRow(vital: 'health' | 'shield', currentRaw: number, maxRaw: number): void {
    const current = Math.max(0, Math.floor(Number(currentRaw || 0)));
    const max = Math.max(1, Math.floor(Number(maxRaw || 1)));
    const safeCurrent = Math.min(current, max);
    const percent = Math.max(0, Math.min(100, Math.round((safeCurrent / max) * 100)));

    const valueElement = this.container.querySelector<HTMLElement>(
      `.vital-row[data-vital="${vital}"] .vital-value`
    );
    if (valueElement) {
      valueElement.textContent = `${this.formatNumber(safeCurrent)} / ${this.formatNumber(max)}`;
    }

    const fillElement = this.container.querySelector<HTMLElement>(
      `.vital-row[data-vital="${vital}"] .vital-fill`
    );
    if (fillElement) {
      fillElement.style.width = `${percent}%`;
    }
  }

  /**
   * Formats numbers - uses thousands separators for better readability
   */
  private formatNumber(num: number): string {
    return NumberFormatter.format(num);
  }

  /**
   * Distrugge l'HUD e rimuove gli elementi dal DOM
   */
  destroy(): void {
    if (document.body.contains(this.container)) {
      document.body.removeChild(this.container);
    }

    const styleElement = document.getElementById('player-hud-styles');
    if (styleElement) {
      document.head.removeChild(styleElement);
    }
  }

  /**
   * Espande l'HUD mostrando più dettagli
   */
  expand(): void {
    this._isExpanded = true;
    // Per ora, espansione semplice - possiamo aggiungere animazioni dopo
    this.container.style.transform = 'scale(1.05)';
    this.container.style.padding = '16px 24px';
  }

  /**
   * Collassa l'HUD alla dimensione normale
   */
  collapse(): void {
    this._isExpanded = false;
    this.container.style.transform = 'scale(1)';
    this.container.style.padding = '12px 20px';
  }

  /**
   * Restituisce true se l'HUD è espanso
   */
  isExpanded(): boolean {
    return this._isExpanded;
  }

  /**
   * Restituisce il contenitore DOM per manipolazioni esterne
   */
  getContainer(): HTMLElement {
    return this.container;
  }
}
