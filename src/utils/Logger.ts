/**
 * Utility per logging periodico senza duplicazioni
 */
export class PeriodicLogger {
  private lastLogTimes = new Map<string, number>();

  /**
   * Logga un messaggio solo se è passato abbastanza tempo dall'ultimo log con la stessa chiave
   */
  logIfTime(key: string, message: string, intervalMs: number = 30000): void {
    const now = Date.now();
    const lastLogTime = this.lastLogTimes.get(key) || 0;

    if (now - lastLogTime > intervalMs) {
      // Logging disabled - use console.warn() or console.error() for essential logs
      this.lastLogTimes.set(key, now);
    }
  }

  /**
   * Logga un messaggio con timestamp ogni intervallo
   */
  logWithTimestamp(key: string, message: string, intervalMs: number = 30000): void {
    this.logIfTime(key, `[${new Date().toISOString()}] ${message}`, intervalMs);
  }

  /**
   * Resetta il timer per una chiave specifica
   */
  reset(key: string): void {
    this.lastLogTimes.delete(key);
  }

  /**
   * Pulisce vecchi timers (opzionale, per memory management)
   */
  cleanup(maxAge: number = 300000): void { // 5 minuti
    const now = Date.now();
    for (const [key, timestamp] of this.lastLogTimes) {
      if (now - timestamp > maxAge) {
        this.lastLogTimes.delete(key);
      }
    }
  }
}

// Istanza globale
export const logger = new PeriodicLogger();
