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
    const margin = Math.round(20 * c);
    // Arrotondamento degli angoli come gli altri pannelli (compensato)
    // The following lines appear to be a mix of canvas drawing code and variable declarations.
    // Assuming the intent was to ensure borderRadius is 25px scaled, which is already present.
    // The canvas drawing calls (this.roundedRect, ctx.fill) are not applicable here as this method creates a DOM element.
    // The 'onst gap' is a syntax error.
    // I will only apply the part that makes sense in this context, which is ensuring borderRadius is set.
    // Since 'const borderRadius = Math.round(25 * c);' already exists, I will ensure it's there.
    // The instruction's provided snippet seems to have extraneous code.
    const gap = Math.round(15 * c);
    const borderRadius = Math.round(25 * c);
    const paddingV = Math.round(12 * c);
    const paddingH = Math.round(20 * c);

    container.style.cssText = `
      position: fixed;
      top: ${margin}px;
      left: ${margin}px;
      display: none;
      align-items: center;
      gap: ${gap}px;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(20px) saturate(160%);
      -webkit-backdrop-filter: blur(20px) saturate(160%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: ${borderRadius}px;
      padding: ${paddingV}px ${paddingH}px;
      box-shadow:
        0 12px 48px rgba(0, 0, 0, 0.5),
        inset 0 1px 1px rgba(255, 255, 255, 0.05);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      z-index: 1000;
    `;

    // Struttura HTML pulita
    container.innerHTML = `
      <div class="level-indicator">
        <div class="level-circle">
          <span class="level-number">1</span>
        </div>
        <div class="player-id">ID: 0</div>
      </div>

      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-label">CREDITS</div>
          <div class="stat-value">0</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">COSMOS</div>
          <div class="stat-value">0</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">EXPERIENCE</div>
          <div class="stat-value">0</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">HONOR</div>
          <div class="stat-value">0</div>
        </div>
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
    const gap24 = Math.round(24 * c);
    const marginLeft8 = Math.round(8 * c);
    const minWidth90 = Math.round(90 * c);

    style.textContent = `
      /* Container principale con effetto glassmorphism */
      #player-hud {
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(20px) saturate(160%);
        -webkit-backdrop-filter: blur(20px) saturate(160%);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: ${Math.round(25 * c)}px;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
        cursor: default;
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


      /* Riga statistiche orizzontale */
      .stats-row {
        display: flex;
        gap: ${gap24}px;
        align-items: center;
        margin-left: ${marginLeft8}px;
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


        }
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


        .stats-row {
          gap: ${Math.round(20 * c)}px;
          margin-left: ${Math.round(6 * c)}px;
        }

        .stat-item {
          min-width: ${Math.round(80 * c)}px;
        }
      }

      @media (max-width: 1200px) {
        .stats-row {
          gap: ${Math.round(16 * c)}px;
        }

        .stat-item {
          min-width: ${Math.round(70 * c)}px;
        }
      }

      @media (max-width: 1000px) {
        .stats-row {
          gap: ${Math.round(12 * c)}px;
        }

        .stat-item {
          min-width: ${Math.round(65 * c)}px;
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

    // Aggiorna risorse - usa gli indici di posizione dato che non abbiamo data-stat
    const statItems = this.container.querySelectorAll('.stat-item .stat-value');
    if (statItems.length >= 4) {
      // CR (Credits) - primo elemento
      (statItems[0] as HTMLElement).textContent = this.formatNumber(data.credits);
      // CO (Cosmos) - secondo elemento
      (statItems[1] as HTMLElement).textContent = this.formatNumber(data.cosmos);
      // XP (Experience) - terzo elemento
      (statItems[2] as HTMLElement).textContent = this.formatNumber(data.experience);
      // HN (Honor) - quarto elemento
      (statItems[3] as HTMLElement).textContent = this.formatNumber(data.honor);
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
