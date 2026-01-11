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
  targetVelocityX: number;
  targetVelocityY: number;

  // ==========================================
  // VALIDAZIONE POSIZIONI
  // ==========================================
  private static readonly MAX_POSITION = 50000;
  private static readonly MIN_POSITION = -50000;

  /**
   * Valida che una posizione sia ragionevole (non NaN, non infinita, entro limiti)
   */
  private static isValidPosition(x: number, y: number): boolean {
    return Number.isFinite(x) && Number.isFinite(y) &&
           x >= this.MIN_POSITION && x <= this.MAX_POSITION &&
           y >= this.MIN_POSITION && y <= this.MAX_POSITION;
  }

  /**
   * Sanitizza una posizione, restituendo valori di fallback se invalidi
   */
  private static sanitizePosition(x: number, y: number, fallbackX: number, fallbackY: number): { x: number; y: number } {
    if (!this.isValidPosition(x, y)) {
      console.warn(`[INTERPOLATION] Invalid position (${x}, ${y}), using fallback (${fallbackX}, ${fallbackY})`);
      return { x: fallbackX, y: fallbackY };
    }
    return { x, y };
  }

  // ==========================================
  // SMOOTHING OTTIMIZZATO PER FLUIDITÀ
  // ==========================================
  private smoothingFactor: number = 0.5;   // Smoothing aumentato (50% per frame) da 0.3 → 0.5 per ridurre lag
  private angularSmoothing: number = 0.6;  // Smoothing separato per rotazione - aumentato per più fluidità

  constructor(initialX: number, initialY: number, initialRotation: number, initialVelocityX: number = 0, initialVelocityY: number = 0) {
    // Inizializza render = target
    this.renderX = this.targetX = initialX;
    this.renderY = this.targetY = initialY;
    this.renderRotation = this.targetRotation = initialRotation;
    this.targetVelocityX = initialVelocityX;
    this.targetVelocityY = initialVelocityY;
  }

  /**
   * AGGIORNA TARGET - Versione semplificata con validazione
   * Chiamato quando arriva un pacchetto server per remote player
   */
  updateTarget(x: number, y: number, rotation: number, velocityX: number = 0, velocityY: number = 0): void {
    // Valida e sanitizza le posizioni prima di aggiornarle
    const sanitizedPos = InterpolationTarget.sanitizePosition(x, y, this.targetX, this.targetY);

    // Valida rotazione
    let sanitizedRotation = rotation;
    if (!Number.isFinite(rotation)) {
      console.warn(`[INTERPOLATION] Invalid rotation ${rotation}, keeping current ${this.targetRotation}`);
      sanitizedRotation = this.targetRotation;
    }

    // Aggiorna i target solo se validi
    this.targetX = sanitizedPos.x;
    this.targetY = sanitizedPos.y;
    this.targetRotation = sanitizedRotation;
    this.targetVelocityX = velocityX;
    this.targetVelocityY = velocityY;
  }

  /**
   * UPDATE RENDER - Versione con extrapolation per fluidità
   * Interpolazione lineare con leggera extrapolation basata su velocità
   */
  updateRender(deltaTime: number): void {
    // Normalizza deltaTime per frame-rate independence (max 2x velocità)
    const normalizedDelta = Math.min(deltaTime / 16.67, 2.0);

    // Calcola smoothing finale
    const positionSmoothing = this.smoothingFactor * normalizedDelta;
    const rotationSmoothing = this.angularSmoothing * normalizedDelta;

    // Se abbiamo velocità, facciamo una leggera extrapolation per riempire i gap
    // Questo aiuta quando gli aggiornamenti dal server sono sporadici
    const extrapolationFactor = 0.1; // Piccola extrapolation (10% della velocità)
    const extrapolatedX = this.targetX + (this.targetVelocityX * deltaTime * extrapolationFactor);
    const extrapolatedY = this.targetY + (this.targetVelocityY * deltaTime * extrapolationFactor);

    // Interpolazione lineare semplice con extrapolation
    this.renderX += (extrapolatedX - this.renderX) * positionSmoothing;
    this.renderY += (extrapolatedY - this.renderY) * positionSmoothing;

    // Interpolazione angolare con shortest path
    const angleDiff = this.calculateShortestAngle(this.renderRotation, this.targetRotation);
    this.renderRotation += angleDiff * rotationSmoothing;
    this.renderRotation = this.normalizeAngle(this.renderRotation);

    // Validazione finale: assicurati che i valori renderizzati siano ancora validi
    if (!InterpolationTarget.isValidPosition(this.renderX, this.renderY)) {
      console.error(`[INTERPOLATION] Render position became invalid (${this.renderX}, ${this.renderY}), resetting to target`);
      this.renderX = this.targetX;
      this.renderY = this.targetY;
    }

    if (!Number.isFinite(this.renderRotation)) {
      console.error(`[INTERPOLATION] Render rotation became invalid ${this.renderRotation}, resetting to target`);
      this.renderRotation = this.targetRotation;
    }
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
