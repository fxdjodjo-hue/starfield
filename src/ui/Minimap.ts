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
    width: number = 400,
    height: number = 250,
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
    this.playerColor = '#0088ff'; // Blu per il player
    this.npcColor = '#ff4444';   // Rosso per gli NPC
    this.selectedNpcColor = '#ffff00';

    // Dimensioni mondo
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // Calcola la scala per adattare tutto il mondo nella minimappa mantenendo proporzioni
    // Scala uniformemente per far entrare tutto il mondo nella minimappa
    const scaleX = width / worldWidth;
    const scaleY = height / worldHeight;
    this.scale = Math.min(scaleX, scaleY); // Usa la scala più piccola per far entrare tutto

    this.entityDotSize = 3; // Dimensione fissa dei pallini
    this.visible = true;
    this.enabled = true;
  }

  /**
   * Converte coordinate mondo in coordinate minimappa
   */
  worldToMinimap(worldX: number, worldY: number): { x: number, y: number } {
    // Il mondo è centrato su (0,0), quindi trasliamo le coordinate per adattarle
    // Alle coordinate mondo aggiungiamo worldWidth/2 e worldHeight/2 per renderle positive
    const translatedX = worldX + this.worldWidth / 2;
    const translatedY = worldY + this.worldHeight / 2;

    // Centra il mondo scalato nella minimappa
    const scaledWorldWidth = this.worldWidth * this.scale;
    const scaledWorldHeight = this.worldHeight * this.scale;
    const offsetX = (this.width - scaledWorldWidth) / 2;
    const offsetY = (this.height - scaledWorldHeight) / 2;

    return {
      x: this.x + offsetX + translatedX * this.scale,
      y: this.y + offsetY + translatedY * this.scale
    };
  }

  /**
   * Converte coordinate minimappa in coordinate mondo
   */
  minimapToWorld(minimapX: number, minimapY: number): { x: number, y: number } {
    // Centra il mondo scalato nella minimappa
    const scaledWorldWidth = this.worldWidth * this.scale;
    const scaledWorldHeight = this.worldHeight * this.scale;
    const offsetX = (this.width - scaledWorldWidth) / 2;
    const offsetY = (this.height - scaledWorldHeight) / 2;

    // Converti alle coordinate mondo scalate
    const translatedX = (minimapX - this.x - offsetX) / this.scale;
    const translatedY = (minimapY - this.y - offsetY) / this.scale;

    // Sottrai worldWidth/2 e worldHeight/2 per tornare alle coordinate mondo centrate su (0,0)
    return {
      x: translatedX - this.worldWidth / 2,
      y: translatedY - this.worldHeight / 2
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
