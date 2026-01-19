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

  // Flag per identificare se è un NPC (per smoothing diverso se necessario)
  private isNpc: boolean = false;

  // Controllo aggiornamenti per NPC (evita tremolio da aggiornamenti troppo frequenti/piccoli)
  private lastUpdateTime: number = 0;
  private minUpdateInterval: number = 50; // minimo 50ms tra aggiornamenti per NPC

  // Tracking per stabilità NPC (riduce tremolio quando fermo)
  private lastStableX: number = 0;
  private lastStableY: number = 0;
  private stabilityCounter: number = 0;
  private readonly STABILITY_THRESHOLD = 3; // numero di aggiornamenti simili per considerare stabile

  constructor(initialX: number, initialY: number, initialRotation: number, isNpc: boolean = false) {
    // Inizializza render = target
    this.renderX = this.targetX = initialX;
    this.renderY = this.targetY = initialY;
    this.renderRotation = this.targetRotation = initialRotation;
    this.isNpc = isNpc;

    // Configurazione smoothing ottimizzata per ridurre vibrazioni durante combattimento
    if (isNpc) {
      this.smoothingFactor = 0.25;  // 25% per frame per NPC - molto più fluido per movimento cruise
      this.angularSmoothing = 0.25; // 25% per frame per rotazioni NPC
    } else {
      // Player: smoothing molto ridotto per massima stabilità durante combattimento
      this.smoothingFactor = 0.02;  // Ridotto da 0.05 a 0.02 - massima stabilità
      this.angularSmoothing = 0.02; // Ridotto da 0.05 a 0.02 - vibrazioni minime
    }
  }

  /**
   * AGGIORNA TARGET DA RETE - Per aggiornamenti posizione da server
   * Chiamato quando arriva un pacchetto server per remote entities
   */
  updateTargetFromNetwork(x: number, y: number, rotation: number = this.targetRotation): void {
    this.updateTarget(x, y, rotation);
  }

  /**
   * AGGIORNA TARGET - Versione semplificata con validazione
   * Chiamato quando arriva un pacchetto server per remote player
   */
  updateTarget(x: number, y: number, rotation: number): void {
    const now = Date.now();

    // Per NPC: controllo aggiornamenti troppo frequenti per evitare tremolio
    if (this.isNpc && (now - this.lastUpdateTime) < this.minUpdateInterval) {
      return; // Salta aggiornamento troppo frequente
    }

    // Valida e sanitizza le posizioni prima di aggiornarle
    const sanitizedPos = InterpolationTarget.sanitizePosition(x, y, this.targetX, this.targetY);

    // Per NPC: controlla se il movimento è significativo ma non troppo grande
    if (this.isNpc) {
      const dx = Math.abs(sanitizedPos.x - this.targetX);
      const dy = Math.abs(sanitizedPos.y - this.targetY);
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Sistema di stabilità: se le coordinate sono molto simili alle precedenti, considera stabile
      const stabilityDx = Math.abs(sanitizedPos.x - this.lastStableX);
      const stabilityDy = Math.abs(sanitizedPos.y - this.lastStableY);
      const stabilityDist = Math.sqrt(stabilityDx * stabilityDx + stabilityDy * stabilityDy);

      if (stabilityDist < 1) {
        // Coordinate simili alle precedenti - aumenta contatore stabilità
        this.stabilityCounter++;
        if (this.stabilityCounter >= this.STABILITY_THRESHOLD) {
          // NPC stabile - usa coordinate esatte per evitare tremolio
          sanitizedPos.x = this.lastStableX;
          sanitizedPos.y = this.lastStableY;
        }
      } else {
        // Coordinate diverse - reset contatore e aggiorna posizione stabile
        this.stabilityCounter = 0;
        this.lastStableX = sanitizedPos.x;
        this.lastStableY = sanitizedPos.y;
      }

      if (dist < 2) {
        // Movimento troppo piccolo per NPC, potrebbe causare tremolio
        return;
      }

      if (dist > 200) {
        // Movimento troppo grande, probabilmente teleport/reset - snap immediatamente
        console.warn(`[INTERPOLATION] NPC teleport detected (${dist.toFixed(1)}px), snapping to target`);
        this.renderX = this.targetX = sanitizedPos.x;
        this.renderY = this.targetY = sanitizedPos.y;
        this.stabilityCounter = 0; // Reset stabilità dopo teleport
        return;
      }
    }

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

    // Aggiorna timestamp ultimo aggiornamento
    this.lastUpdateTime = now;
  }

  /**
   * UPDATE RENDER - Versione ottimizzata per ridurre scatti e tremolio
   * Interpolazione lineare con clamping per stabilità
   */
  updateRender(deltaTime: number): void {
    // Clamp deltaTime per evitare salti da frame drops (max 32ms - più stabile)
    const clampedDeltaTime = Math.min(deltaTime, 32);

    // Calcola smoothing adattivo basato su deltaTime per maggiore stabilità
    const baseSmoothing = this.isNpc ? 0.25 : 0.1;
    const adaptiveSmoothing = Math.min(baseSmoothing * (clampedDeltaTime / 16.67), this.isNpc ? 0.35 : 0.25);

    // Per NPC: se siamo già molto vicini al target, snap invece di interpolare
    if (this.isNpc) {
      const distSq = (this.targetX - this.renderX) ** 2 + (this.targetY - this.renderY) ** 2;
      if (distSq < 0.25) { // Se siamo entro 0.5 pixel, snap completamente
        this.renderX = this.targetX;
        this.renderY = this.targetY;
      } else {
        // Interpolazione con clamping per stabilità
        const deltaX = (this.targetX - this.renderX) * adaptiveSmoothing;
        const deltaY = (this.targetY - this.renderY) * adaptiveSmoothing;

        // Limita il movimento massimo per frame per evitare salti (NPC più conservativi)
        const maxMove = 12;
        const moveDist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (moveDist > maxMove) {
          const scale = maxMove / moveDist;
          this.renderX += deltaX * scale;
          this.renderY += deltaY * scale;
        } else {
          this.renderX += deltaX;
          this.renderY += deltaY;
        }
      }
    } else {
      // Interpolazione normale per player con clamping
      const deltaX = (this.targetX - this.renderX) * adaptiveSmoothing;
      const deltaY = (this.targetY - this.renderY) * adaptiveSmoothing;

      // Limita movimento per player
      const maxMove = 25;
      const moveDist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (moveDist > maxMove) {
        const scale = maxMove / moveDist;
        this.renderX += deltaX * scale;
        this.renderY += deltaY * scale;
      } else {
        this.renderX += deltaX;
        this.renderY += deltaY;
      }
    }

    // Interpolazione angolare con clamping per stabilità
    const angleDiff = this.calculateShortestAngle(this.renderRotation, this.targetRotation);
    if (Math.abs(angleDiff) > 0.01) { // Soglia ridotta per ridurre ulteriormente micromovimenti
      const angularDelta = angleDiff * adaptiveSmoothing;
      // Limita rotazione massima per frame
      const maxAngularMove = this.isNpc ? 0.25 : 0.4; // radianti
      const clampedAngularDelta = Math.max(-maxAngularMove, Math.min(maxAngularMove, angularDelta));
      this.renderRotation += clampedAngularDelta;
      this.renderRotation = this.normalizeAngle(this.renderRotation);
    } else if (this.isNpc) {
      // Per NPC, snap alla rotazione target se siamo molto vicini
      this.renderRotation = this.targetRotation;
    }

    // Validazione finale: assicurati che i valori renderizzati siano ancora validi
    if (!InterpolationTarget.isValidPosition(this.renderX, this.renderY)) {
      console.error(`[INTERPOLATION] Render position became invalid (${this.renderX}, ${this.renderY}), resetting to target`);
      this.renderX = this.targetX;
      this.renderY = this.targetY;
    }

    if (!InputValidator.validateNumber(this.renderRotation, 'renderRotation').isValid) {
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
