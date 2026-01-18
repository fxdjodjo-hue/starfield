/**
 * RateLimiter - Implementa rate limiting per messaggi di rete
 * Previene flood attacks e riduce carico server
 */
export class RateLimiter {
  private buckets: Map<string, Bucket> = new Map();

  constructor() {
    // Cleanup old buckets every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Controlla se un messaggio può essere inviato
   * @param key - Chiave identificativa (es. 'position_update', 'heartbeat')
   * @param maxRequests - Numero massimo di richieste per finestra temporale
   * @param windowMs - Finestra temporale in millisecondi
   * @returns true se il messaggio può essere inviato
   */
  canSend(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: maxRequests, lastRefill: now };
      this.buckets.set(key, bucket);
      return true;
    }

    // Refill tokens based on time passed
    const timePassed = now - bucket.lastRefill;
    const refillRate = maxRequests / windowMs; // tokens per ms
    const tokensToAdd = Math.floor(timePassed * refillRate);

    bucket.tokens = Math.min(maxRequests, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if we have tokens available
    if (bucket.tokens > 0) {
      bucket.tokens--;
      return true;
    }

    return false;
  }

  /**
   * Forza invio di un messaggio critico (ignora rate limiting)
   * Da usare solo per messaggi essenziali
   */
  forceSend(key: string): void {
    const bucket = this.buckets.get(key);
    if (bucket) {
      bucket.tokens = Math.max(0, bucket.tokens - 1);
    }
  }

  /**
   * Ottiene statistiche del rate limiter
   */
  getStats(): Record<string, { tokens: number; lastRefill: number }> {
    const stats: Record<string, { tokens: number; lastRefill: number }> = {};
    for (const [key, bucket] of this.buckets.entries()) {
      stats[key] = { ...bucket };
    }
    return stats;
  }

  /**
   * Cleanup bucket vecchi (non usati da più di 5 minuti)
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minuti

    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxAge) {
        this.buckets.delete(key);
      }
    }
  }

  /**
   * Reset di un bucket specifico
   */
  reset(key: string): void {
    this.buckets.delete(key);
  }
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

// Rate limiting constants
export const RATE_LIMITS = {
  POSITION_UPDATE: {
    maxRequests: 40, // 40 aggiornamenti al secondo (aumentato per combattimenti fluidi)
    windowMs: 1000
  },
  HEARTBEAT: {
    maxRequests: 2, // 2 heartbeat al secondo (massimo)
    windowMs: 1000
  },
  CHAT_MESSAGE: {
    maxRequests: 5, // 5 messaggi al secondo
    windowMs: 1000
  },
  COMBAT_ACTION: {
    maxRequests: 10, // 10 azioni di combattimento al secondo
    windowMs: 1000
  }
} as const;