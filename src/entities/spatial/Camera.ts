import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente Camera - gestisce la vista del mondo
 */
export class Camera extends Component {
  public x: number;
  public y: number;
  public zoom: number;

  constructor(
    x: number = 0,
    y: number = 0,
    zoom: number = 1
  ) {
    super();
    this.x = x;
    this.y = y;
    this.zoom = zoom;
  }

  /**
   * Centra la camera su una posizione
   */
  centerOn(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /**
   * Trasla la camera
   */
  translate(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  /**
   * Imposta lo zoom
   */
  setZoom(zoom: number): void {
    this.zoom = Math.max(0.1, zoom); // Zoom minimo 0.1
  }

  /**
   * Converte coordinate mondo in coordinate schermo
   */
  worldToScreen(worldX: number, worldY: number, canvasWidth: number, canvasHeight: number): { x: number; y: number } {
    const screenX = (worldX - this.x) * this.zoom + canvasWidth / 2;
    const screenY = (worldY - this.y) * this.zoom + canvasHeight / 2;
    return { x: screenX, y: screenY };
  }

  /**
   * Converte coordinate schermo in coordinate mondo
   */
  screenToWorld(screenX: number, screenY: number, canvasWidth: number, canvasHeight: number): { x: number; y: number } {
    const worldX = (screenX - canvasWidth / 2) / this.zoom + this.x;
    const worldY = (screenY - canvasHeight / 2) / this.zoom + this.y;
    return { x: worldX, y: worldY };
  }
}
