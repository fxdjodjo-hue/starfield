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

  constructor() {
    this.container = this.createHUDContainer();
  }

  /**
   * Crea il contenitore principale dell'HUD con stile glass
   */
  private createHUDContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'player-hud';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      display: flex;
      align-items: center;
      gap: 15px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 25px;
      padding: 12px 20px;
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
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
    `;

    this.attachGlassStyles();
    return container;
  }

  /**
   * Applica gli stili glass moderni
   */
  private attachGlassStyles(): void {
    const existingStyle = document.getElementById('player-hud-styles');
    if (existingStyle) return;

    const style = document.createElement('style');
    style.id = 'player-hud-styles';
    style.textContent = `
      /* Container principale con effetto glassmorphism */
      #player-hud {
        background: rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
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
        gap: 4px;
      }

      .level-circle {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        box-shadow: 0 0 12px rgba(255, 255, 255, 0.1);
      }

      .level-number {
        color: rgba(255, 255, 255, 0.95);
        font-weight: 800;
        font-size: 18px;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        z-index: 1;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
      }

      .player-id {
        color: rgba(255, 255, 255, 0.7);
        font-size: 10px;
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
        gap: 24px;
        align-items: center;
        margin-left: 8px;
      }


      .stat-label {
        color: rgba(255, 255, 255, 0.8);
        font-size: 9px;
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
        font-size: 12px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
      }


      /* Elementi statistica orizzontali */
      .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        min-width: 90px;
        text-align: center;
      }



      /* Responsive design */
      @media (max-width: 1400px) {
        #player-hud {
          padding: 10px 16px;
          gap: 12px;
        }

        .level-circle {
          width: 42px;
          height: 42px;
        }

        .level-number {
          font-size: 15px;
        }

        .player-id {
          font-size: 9px;
        }


        .stats-row {
          gap: 20px;
          margin-left: 6px;
        }

        .stat-item {
          min-width: 80px;
        }
      }

      @media (max-width: 1200px) {
        .stats-row {
          gap: 16px;
        }

        .stat-item {
          min-width: 70px;
        }
      }

      @media (max-width: 1000px) {
        .stats-row {
          gap: 12px;
        }

        .stat-item {
          min-width: 65px;
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
    if (!this.isVisible) {
      this.show();
    }

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
   * Formatta numeri - mostra sempre il numero completo senza abbreviazioni
   */
  private formatNumber(num: number): string {
    return Math.floor(num).toString();
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
