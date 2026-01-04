/**
 * Componente per gestire l'interpolazione graduale delle posizioni
 * Utilizzato per rendere fluidi i movimenti dei remote player nonostante la latenza di rete
 */
export class InterpolationTarget {
  // Posizione target ricevuta dal server
  targetX: number;
  targetY: number;
  targetRotation: number;

  // Posizione di partenza per l'interpolazione
  startX: number;
  startY: number;
  startRotation: number;

  // Timing dell'interpolazione
  startTime: number;
  duration: number;

  constructor(
    targetX: number,
    targetY: number,
    targetRotation: number,
    startX: number,
    startY: number,
    startRotation: number,
    duration: number = 100 // 100ms default
  ) {
    this.targetX = targetX;
    this.targetY = targetY;
    this.targetRotation = targetRotation;
    this.startX = startX;
    this.startY = startY;
    this.startRotation = startRotation;
    this.startTime = Date.now();
    this.duration = duration;
  }

  /**
   * Calcola il progresso dell'interpolazione (0.0 a 1.0)
   */
  getProgress(): number {
    const elapsed = Date.now() - this.startTime;
    return Math.min(elapsed / this.duration, 1.0);
  }

  /**
   * Verifica se l'interpolazione è completata
   */
  isComplete(): boolean {
    return this.getProgress() >= 1.0;
  }
}
