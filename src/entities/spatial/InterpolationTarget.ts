/**
 * InterpolationTarget SEMPLIFICATO - Sistema essenziale per Remote Player
 *
 * Interpolazione fluida ma semplificata per ridurre complessità:
 * - Smoothing fisso invece di adattivo
 * - Senza dead reckoning avanzato
 * - Frame-rate independence base
 */
export class InterpolationTarget {
  // ==========================================
  // POSIZIONE RENDERIZZATA (visibile)
  // ==========================================
  renderX: number;
  renderY: number;
  renderRotation: number;

  // ==========================================
  // POSIZIONE TARGET (aggiornata da pacchetti server)
  // ==========================================
  targetX: number;
  targetY: number;
  targetRotation: number;

  // ==========================================
  // SMOOTHING SEMPLIFICATO
  // ==========================================
  private smoothingFactor: number = 0.3;   // Smoothing fisso (30% per frame)
  private angularSmoothing: number = 0.4;  // Smoothing separato per rotazione

  constructor(initialX: number, initialY: number, initialRotation: number) {
    // Inizializza render = target
    this.renderX = this.targetX = initialX;
    this.renderY = this.targetY = initialY;
    this.renderRotation = this.targetRotation = initialRotation;
  }

  /**
   * AGGIORNA TARGET - Versione semplificata
   * Chiamato quando arriva un pacchetto server per remote player
   */
  updateTarget(x: number, y: number, rotation: number): void {
    // Aggiorna semplicemente i target (senza calcoli di velocity complessi)
    this.targetX = x;
    this.targetY = y;
    this.targetRotation = rotation;
  }

  /**
   * UPDATE RENDER - Versione semplificata
   * Interpolazione lineare semplice ogni frame
   */
  updateRender(deltaTime: number): void {
    // Normalizza deltaTime per frame-rate independence (max 2x velocità)
    const normalizedDelta = Math.min(deltaTime / 16.67, 2.0);

    // Calcola smoothing finale
    const positionSmoothing = this.smoothingFactor * normalizedDelta;
    const rotationSmoothing = this.angularSmoothing * normalizedDelta;

    // Interpolazione lineare semplice per posizione
    this.renderX += (this.targetX - this.renderX) * positionSmoothing;
    this.renderY += (this.targetY - this.renderY) * positionSmoothing;

    // Interpolazione angolare con shortest path
    const angleDiff = this.calculateShortestAngle(this.renderRotation, this.targetRotation);
    this.renderRotation += angleDiff * rotationSmoothing;
    this.renderRotation = this.normalizeAngle(this.renderRotation);
  }

  // ==========================================
  // UTILITIES ANGOLARI
  // ==========================================
  private calculateShortestAngle(from: number, to: number): number {
    let diff = to - from;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return diff;
  }

  private normalizeAngle(angle: number): number {
    while (angle < 0) angle += 2 * Math.PI;
    while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
    return angle;
  }
}
