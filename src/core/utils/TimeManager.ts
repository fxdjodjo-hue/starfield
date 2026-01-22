/**
 * TimeManager - Gestione centralizzata del tempo e timestamp
 * Sostituisce Date.now() ripetuto in tutto il progetto
 */

export class TimeManager {
  private static lastTime: number = Date.now();
  private static timeCache: Map<string, number> = new Map();

  /**
   * Ottiene il timestamp corrente
   * Usa caching per evitare chiamate multiple nello stesso frame
   */
  static getCurrentTime(): number {
    const now = Date.now();
    // Cache per evitare chiamate multiple nello stesso millisecondo
    if (now === this.lastTime) {
      return this.lastTime;
    }
    this.lastTime = now;
    return now;
  }

  /**
   * Calcola il tempo trascorso da un timestamp
   */
  static getElapsedTime(startTime: number): number {
    return this.getCurrentTime() - startTime;
  }

  /**
   * Verifica se è passato abbastanza tempo da un evento
   */
  static hasTimeElapsed(startTime: number, duration: number): boolean {
    return this.getElapsedTime(startTime) >= duration;
  }

  /**
   * Calcola il tempo rimanente per un cooldown
   */
  static getRemainingCooldown(startTime: number, cooldownDuration: number): number {
    const elapsed = this.getElapsedTime(startTime);
    return Math.max(0, cooldownDuration - elapsed);
  }

  /**
   * Cache un timestamp con una chiave
   */
  static cacheTimestamp(key: string): number {
    const time = this.getCurrentTime();
    this.timeCache.set(key, time);
    return time;
  }

  /**
   * Recupera un timestamp dalla cache
   */
  static getCachedTimestamp(key: string): number | undefined {
    return this.timeCache.get(key);
  }

  /**
   * Rimuove un timestamp dalla cache
   */
  static clearCachedTimestamp(key: string): void {
    this.timeCache.delete(key);
  }

  /**
   * Converte millisecondi in secondi
   */
  static millisecondsToSeconds(ms: number): number {
    return ms / 1000;
  }

  /**
   * Converte secondi in millisecondi
   */
  static secondsToMilliseconds(seconds: number): number {
    return seconds * 1000;
  }

  /**
   * Ottiene una rappresentazione formattata del tempo
   */
  static formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}