/**
 * Gestisce pattern ritmico per animazione visiva lato client
 * Separato dalla logica di danno (server-authoritative)
 *
 * OTTIMIZZAZIONE: Pattern più fluido mantenendo allineamento server
 * - Base mantenuto a 800ms per perfetto allineamento server
 * - Pattern più irregolare per ritmo più dinamico
 * - Media esatta 800ms per zero desincronizzazione
 */
export class RhythmicAnimationManager {
  private static readonly BASE_COOLDOWN = 800; // Mantenuto a 800ms per allineamento perfetto con server
  private static readonly PATTERN_MULTIPLIERS = [0.75, 0.75, 1.25, 1.0]; // Pattern fluido: 600ms, 600ms, 1000ms, 800ms (media 800ms)
  
  private lastAnimationTime: number = 0;
  private patternIndex: number = 0;
  private pendingAnimations: Array<{ callback: () => void; createdAt: number }> = [];

  /**
   * Reset pattern (chiamato quando inizia un nuovo combattimento)
   */
  reset(): void {
    this.lastAnimationTime = 0;
    this.patternIndex = 0;
    this.pendingAnimations = [];
  }

  /**
   * Schedula animazione seguendo pattern ritmico
   * @param callback - Funzione da chiamare quando è il momento di mostrare l'animazione
   */
  scheduleAnimation(callback: () => void): void {
    const now = Date.now();
    
    // Calcola delay basato sul pattern ritmico
    const multiplier = RhythmicAnimationManager.PATTERN_MULTIPLIERS[this.patternIndex];
    const animationDelay = RhythmicAnimationManager.BASE_COOLDOWN * multiplier;
    
    // Calcola quando mostrare l'animazione
    const timeSinceLastAnimation = now - this.lastAnimationTime;
    const delay = Math.max(0, animationDelay - timeSinceLastAnimation);
    
    if (delay === 0) {
      // Mostra subito
      callback();
      this.lastAnimationTime = now;
      this.patternIndex = (this.patternIndex + 1) % RhythmicAnimationManager.PATTERN_MULTIPLIERS.length;
    } else {
      // Schedula con delay
      setTimeout(() => {
        callback();
        this.lastAnimationTime = Date.now();
        this.patternIndex = (this.patternIndex + 1) % RhythmicAnimationManager.PATTERN_MULTIPLIERS.length;
      }, delay);
    }
  }
}
