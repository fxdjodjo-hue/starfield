/**
 * Utility class per operazioni di rendering Canvas
 * Fornisce metodi helper per il rendering comune
 */
export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /**
   * Pulisce l'intero canvas
   */
  clear(): void {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }

  /**
   * Imposta il colore di riempimento
   */
  setFillColor(color: string): void {
    this.ctx.fillStyle = color;
  }

  /**
   * Imposta il colore del bordo
   */
  setStrokeColor(color: string): void {
    this.ctx.strokeStyle = color;
  }

  /**
   * Imposta lo spessore del bordo
   */
  setLineWidth(width: number): void {
    this.ctx.lineWidth = width;
  }

  /**
   * Salva il contesto corrente
   */
  save(): void {
    this.ctx.save();
  }

  /**
   * Ripristina il contesto precedente
   */
  restore(): void {
    this.ctx.restore();
  }

  /**
   * Trasla il contesto
   */
  translate(x: number, y: number): void {
    this.ctx.translate(x, y);
  }

  /**
   * Ruota il contesto
   */
  rotate(angle: number): void {
    this.ctx.rotate(angle);
  }

  /**
   * Scala il contesto
   */
  scale(x: number, y: number): void {
    this.ctx.scale(x, y);
  }

  /**
   * Disegna un rettangolo riempito
   */
  fillRect(x: number, y: number, width: number, height: number): void {
    this.ctx.fillRect(x, y, width, height);
  }

  /**
   * Disegna un rettangolo vuoto
   */
  strokeRect(x: number, y: number, width: number, height: number): void {
    this.ctx.strokeRect(x, y, width, height);
  }

  /**
   * Disegna un cerchio riempito
   */
  fillCircle(x: number, y: number, radius: number): void {
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * Disegna un cerchio vuoto
   */
  strokeCircle(x: number, y: number, radius: number): void {
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  /**
   * Restituisce il contesto Canvas
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }
}
