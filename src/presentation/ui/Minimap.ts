import { CONFIG } from '../../core/utils/config/GameConfig';
import { DisplayManager, DISPLAY_CONSTANTS } from '../../infrastructure/display';

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
  
  // DPR compensation
  private dprCompensation: number;

  constructor(
    x: number = 0,
    y: number = 0,
    width: number = CONFIG.MINIMAP_WIDTH,
    height: number = CONFIG.MINIMAP_HEIGHT,
    worldWidth: number = 21000,
    worldHeight: number = 13100
  ) {
    // Calcola compensazione DPR
    const dpr = DisplayManager.getInstance().getDevicePixelRatio();
    this.dprCompensation = 1 / dpr;
    
    // Dimensioni compensate per DPR
    const compensatedWidth = Math.round(width * this.dprCompensation);
    const compensatedHeight = Math.round(height * this.dprCompensation);
    
    // Posizione in basso a destra per default usando DisplayManager
    const { width: viewportWidth, height: viewportHeight } = DisplayManager.getInstance().getLogicalSize();
    const margin = Math.round(DISPLAY_CONSTANTS.SCREEN_MARGIN * this.dprCompensation);
    
    this.x = x || viewportWidth - compensatedWidth - margin;
    this.y = y || viewportHeight - compensatedHeight - margin;
    this.width = compensatedWidth;
    this.height = compensatedHeight;

    // Colori tema glass spaziale
    this.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    this.borderColor = '#00ff88';
    this.playerColor = 'rgba(255, 255, 255, 0.9)'; // Bianco glass per il player
    this.npcColor = 'rgba(255, 100, 100, 0.8)';   // Rosso tenue per gli NPC
    this.selectedNpcColor = 'rgba(255, 255, 100, 0.8)'; // Giallo tenue per NPC selezionati

    // Dimensioni mondo
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // Calcola la scala per adattare tutto il mondo nella minimappa mantenendo proporzioni
    // Scala uniformemente per far entrare tutto il mondo nella minimappa
    const scaleX = this.width / worldWidth;
    const scaleY = this.height / worldHeight;
    this.scale = Math.min(scaleX, scaleY); // Usa la scala più piccola per far entrare tutto

    this.entityDotSize = Math.round(3 * this.dprCompensation); // Dimensione compensata dei pallini
    this.visible = false; // Inizia nascosta, verrà mostrata dopo l'animazione camera
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
    // Ricalcola posizione per rimanere in basso a destra con margine compensato
    const margin = Math.round(DISPLAY_CONSTANTS.SCREEN_MARGIN * this.dprCompensation);
    this.x = canvasWidth - this.width - margin;
    this.y = canvasHeight - this.height - margin;
  }
  
  /**
   * Restituisce il fattore di compensazione DPR
   */
  getDprCompensation(): number {
    return this.dprCompensation;
  }
}
