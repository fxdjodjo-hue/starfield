import { InputValidator } from '../../core/utils/InputValidator';
import { LoggerWrapper } from '../../core/data/LoggerWrapper';

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
  private smoothingFactor: number = 0.1;   // Smoothing basso (10% per frame) - elimina effetto "lag" mantenendo movimento fluido
  private angularSmoothing: number = 0.1;  // Smoothing rotazione basso (10% per frame) - rotazioni fluide e reattive senza lag visivo

  constructor(initialX: number, initialY: number, initialRotation: number) {
    // Inizializza render = target
    this.renderX = this.targetX = initialX;
    this.renderY = this.targetY = initialY;
    this.renderRotation = this.targetRotation = initialRotation;
  }

  /**
   * AGGIORNA TARGET - Versione semplificata con validazione
   * Chiamato quando arriva un pacchetto server per remote player
   */
  updateTarget(x: number, y: number, rotation: number): void {
    // Valida e sanitizza le posizioni prima di aggiornarle
    const sanitizedPos = InterpolationTarget.sanitizePosition(x, y, this.targetX, this.targetY);

    // Valida rotazione
    let sanitizedRotation = rotation;
    const rotationValidation = InputValidator.validateNumber(rotation, 'rotation');
    if (!rotationValidation.isValid) {
      LoggerWrapper.warn('SYSTEM', `Invalid rotation ${rotation}, keeping current ${this.targetRotation}`, {
        rotation,
        currentRotation: this.targetRotation
      });
      sanitizedRotation = this.targetRotation;
    }

    // Aggiorna i target solo se validi
    this.targetX = sanitizedPos.x;
    this.targetY = sanitizedPos.y;
    this.targetRotation = sanitizedRotation;
  }

  /**
   * UPDATE RENDER - Versione ottimizzata per ridurre scatti
   * Interpolazione lineare semplice con smoothing fisso per frame (non dipendente da deltaTime)
   */
  updateRender(deltaTime: number): void {
    // Usa smoothing fisso per frame - non dipendente da deltaTime
    // Questo garantisce comportamento consistente indipendentemente dal framerate
    // e permette di raggiungere il target rapidamente con aggiornamenti a 20 FPS
    
    // Interpolazione lineare semplice ottimizzata per ridurre scatti irregolari
    this.renderX += (this.targetX - this.renderX) * this.smoothingFactor;
    this.renderY += (this.targetY - this.renderY) * this.smoothingFactor;

    // Interpolazione angolare con shortest path
    const angleDiff = this.calculateShortestAngle(this.renderRotation, this.targetRotation);
    this.renderRotation += angleDiff * this.angularSmoothing;
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
