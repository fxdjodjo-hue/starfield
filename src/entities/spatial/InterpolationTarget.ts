/**
 * InterpolationTarget OTTIMIZZATO - Sistema Persistente per Remote Player
 *
 * Elimina completamente gli scatti nei remote player durante movimento continuo
 * del player locale attraverso:
 * - Interpolazione persistente (componente mai rimosso)
 * - Exponential smoothing adattivo
 * - Dead reckoning per pacchetti mancanti
 * - Frame-rate independence
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
  // SMOOTHING ADATTIVO
  // ==========================================
  private baseSmoothing: number = 0.15;    // 15% smoothing base
  private adaptiveMultiplier: number = 2.0; // 2x quando lontano
  private minSmoothing: number = 0.08;     // Min per stabilità

  // ==========================================
  // DEAD RECKONING
  // ==========================================
  private lastVelocityX: number = 0;
  private lastVelocityY: number = 0;
  private lastUpdateTime: number = 0;
  private deadReckoningDelay: number = 150;    // ms prima di estrapolare
  private maxExtrapolationTime: number = 0.2;  // secondi max estrapolazione

  // ==========================================
  // DELTATIME NORMALIZATION
  // ==========================================
  private targetFrameTime: number = 16.67;     // 60 FPS baseline
  private maxDeltaMultiplier: number = 2.0;    // Max 2x velocità

  constructor(initialX: number, initialY: number, initialRotation: number) {
    // Inizializza render = target
    this.renderX = this.targetX = initialX;
    this.renderY = this.targetY = initialY;
    this.renderRotation = this.targetRotation = initialRotation;
    this.lastUpdateTime = Date.now();
  }

  /**
   * AGGIORNA TARGET - Componente rimane PERSISTENTE
   * Chiamato quando arriva un pacchetto server per remote player
   */
  updateTarget(x: number, y: number, rotation: number): void {
    const now = Date.now();

    // Calcola velocity per dead reckoning
    if (this.lastUpdateTime > 0) {
      const deltaTime = (now - this.lastUpdateTime) / 1000;
      if (deltaTime > 0) {
        this.lastVelocityX = (x - this.targetX) / deltaTime;
        this.lastVelocityY = (y - this.targetY) / deltaTime;
      }
    }

    // Aggiorna target (NON rimuove mai il componente)
    this.targetX = x;
    this.targetY = y;
    this.targetRotation = rotation;
    this.lastUpdateTime = now;
  }

  /**
   * UPDATE RENDER - Exponential Smoothing Adattivo + Dead Reckoning
   * Chiamato ogni frame per interpolazione fluida
   */
  updateRender(deltaTime: number): void {
    const now = Date.now();
    const timeSinceUpdate = now - this.lastUpdateTime;

    // ==========================================
    // DEAD RECKONING - Estrapola se pacchetti mancanti
    // ==========================================
    let effectiveTargetX = this.targetX;
    let effectiveTargetY = this.targetY;

    if (timeSinceUpdate > this.deadReckoningDelay) {
      // Estrapola posizione futura basata su ultima velocity
      const extrapolateTime = Math.min(
        (timeSinceUpdate - this.deadReckoningDelay) / 1000,
        this.maxExtrapolationTime
      );
      effectiveTargetX += this.lastVelocityX * extrapolateTime;
      effectiveTargetY += this.lastVelocityY * extrapolateTime;
    }

    // ==========================================
    // ADAPTIVE SMOOTHING - Basato su distanza dal target
    // ==========================================
    const distance = Math.sqrt(
      Math.pow(effectiveTargetX - this.renderX, 2) +
      Math.pow(effectiveTargetY - this.renderY, 2)
    );

    // Più lontano = smoothing più alto (convergenza veloce)
    let adaptiveSmoothing = this.baseSmoothing;
    if (distance > 50) {
      adaptiveSmoothing *= this.adaptiveMultiplier;  // 2x quando lontano
    } else if (distance < 5) {
      adaptiveSmoothing = Math.max(this.minSmoothing, adaptiveSmoothing * 0.5); // 0.5x quando vicino
    }

    // ==========================================
    // DELTATIME NORMALIZATION - Frame-rate independence
    // ==========================================
    const normalizedDelta = Math.min(deltaTime / this.targetFrameTime, this.maxDeltaMultiplier);
    const finalSmoothing = adaptiveSmoothing * normalizedDelta;

    // ==========================================
    // EXPONENTIAL SMOOTHING
    // ==========================================
    this.renderX += (effectiveTargetX - this.renderX) * finalSmoothing;
    this.renderY += (effectiveTargetY - this.renderY) * finalSmoothing;

    // Interpolazione angolare con shortest path
    const angleDiff = this.calculateShortestAngle(this.renderRotation, this.targetRotation);
    this.renderRotation += angleDiff * finalSmoothing;
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

  // ==========================================
  // DEBUGGING
  // ==========================================
  getDebugInfo(): any {
    const distance = Math.sqrt(
      Math.pow(this.targetX - this.renderX, 2) +
      Math.pow(this.targetY - this.renderY, 2)
    );

    return {
      renderPosition: `${this.renderX.toFixed(1)}, ${this.renderY.toFixed(1)}`,
      targetPosition: `${this.targetX.toFixed(1)}, ${this.targetY.toFixed(1)}`,
      distance: distance.toFixed(1),
      timeSinceUpdate: Date.now() - this.lastUpdateTime,
      lastVelocity: `${this.lastVelocityX.toFixed(1)}, ${this.lastVelocityY.toFixed(1)}`
    };
  }
}
