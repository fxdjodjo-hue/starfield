/**
 * Componente Minimap per gestire la minimappa quadrata
 * Mostra overview del mondo con entità rappresentate come pallini
 * Supporta click-to-move per navigazione rapida
 */
export class Minimap {
  // Posizione e dimensioni (in pixel dello schermo)
  public x: number;
  public y: number;
  public width: number;
  public height: number;

  // Configurazione visuale
  public backgroundColor: string;
  public borderColor: string;
  public playerColor: string;
  public npcColor: string;
  public selectedNpcColor: string;

  // Configurazione funzionale
  public worldWidth: number;
  public worldHeight: number;
  public scale: number; // Fattore di scala per adattare il mondo alla minimappa
  public entityDotSize: number; // Dimensione dei pallini per le entità

  // Stato interattivo
  public visible: boolean;
  public enabled: boolean;

  constructor(
    x: number = 0,
    y: number = 0,
    width: number = 200,
    height: number = 200,
    worldWidth: number = 21000,
    worldHeight: number = 13100
  ) {
    // Posizione in basso a destra per default
    this.x = x || window.innerWidth - width - 20;
    this.y = y || window.innerHeight - height - 20;
    this.width = width;
    this.height = height;

    // Colori tema spaziale
    this.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    this.borderColor = '#00ff88';
    this.playerColor = '#00ff88';
    this.npcColor = '#ff4444';
    this.selectedNpcColor = '#ffff00';

    // Dimensioni mondo
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // Calcola la scala per adattare il mondo rettangolare alla minimappa quadrata
    const worldAspectRatio = worldWidth / worldHeight;
    const minimapAspectRatio = width / height;

    if (worldAspectRatio > minimapAspectRatio) {
      // Mondo più largo: scala basata su larghezza
      this.scale = width / worldWidth;
    } else {
      // Mondo più alto: scala basata su altezza
      this.scale = height / worldHeight;
    }

    this.entityDotSize = 3; // Dimensione fissa dei pallini
    this.visible = true;
    this.enabled = true;
  }

  /**
   * Converte coordinate mondo in coordinate minimappa
   */
  worldToMinimap(worldX: number, worldY: number): { x: number, y: number } {
    // Centra il mondo nella minimappa
    const offsetX = (this.width - this.worldWidth * this.scale) / 2;
    const offsetY = (this.height - this.worldHeight * this.scale) / 2;

    return {
      x: this.x + offsetX + worldX * this.scale,
      y: this.y + offsetY + worldY * this.scale
    };
  }

  /**
   * Converte coordinate minimappa in coordinate mondo
   */
  minimapToWorld(minimapX: number, minimapY: number): { x: number, y: number } {
    // Centra il mondo nella minimappa
    const offsetX = (this.width - this.worldWidth * this.scale) / 2;
    const offsetY = (this.height - this.worldHeight * this.scale) / 2;

    return {
      x: (minimapX - this.x - offsetX) / this.scale,
      y: (minimapY - this.y - offsetY) / this.scale
    };
  }

  /**
   * Verifica se un punto (screen coordinates) è dentro la minimappa
   */
  isPointInside(screenX: number, screenY: number): boolean {
    return screenX >= this.x && screenX <= this.x + this.width &&
           screenY >= this.y && screenY <= this.y + this.height;
  }

  /**
   * Aggiorna dimensioni e posizione se la finestra cambia
   */
  updateViewport(canvasWidth: number, canvasHeight: number): void {
    // Ricalcola posizione per rimanere in basso a destra
    this.x = canvasWidth - this.width - 20;
    this.y = canvasHeight - this.height - 20;
  }
}
