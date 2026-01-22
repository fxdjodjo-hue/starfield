/**
 * CooldownManager - Sistema centralizzato per gestione cooldown e rate limiting
 * Unifica tutti i sistemi di cooldown (missili, laser, combat start, messaggi)
 */

import { TimeManager } from '../utils/TimeManager';
import { CollectionManager } from '../data/CollectionManager';
import { LoggerWrapper, LogCategory } from '../data/LoggerWrapper';

export interface CooldownConfig {
  duration: number;
  id: string;
  category?: string;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  id: string;
  category?: string;
}

export class CooldownManager {
  private static cooldowns: Map<string, number> = new Map();
  private static rateLimits: Map<string, { count: number; windowStart: number; lastRequest: number }> = new Map();

  /**
   * Verifica se un cooldown è attivo
   */
  static isOnCooldown(cooldownId: string): boolean {
    const lastUse = CollectionManager.get(this.cooldowns, cooldownId);
    if (!lastUse) return false;

    const cooldownDuration = this.getCooldownDuration(cooldownId);
    return !TimeManager.hasTimeElapsed(lastUse, cooldownDuration);
  }

  /**
   * Ottiene il tempo rimanente per un cooldown
   */
  static getRemainingCooldown(cooldownId: string): number {
    const lastUse = CollectionManager.get(this.cooldowns, cooldownId);
    if (!lastUse) return 0;

    const cooldownDuration = this.getCooldownDuration(cooldownId);
    return TimeManager.getRemainingCooldown(lastUse, cooldownDuration);
  }

  /**
   * Avvia un cooldown
   */
  static startCooldown(cooldownId: string, duration?: number): void {
    const now = TimeManager.getCurrentTime();

    if (duration) {
      // Salva durata personalizzata
      CollectionManager.set(this.cooldowns, `${cooldownId}_duration`, duration);
    }

    CollectionManager.set(this.cooldowns, cooldownId, now);

    LoggerWrapper.performance(`Cooldown started: ${cooldownId}`, {
      cooldownId: cooldownId,
      duration: duration || this.getCooldownDuration(cooldownId)
    });
  }

  /**
   * Verifica se un'azione può essere eseguita (non in cooldown)
   */
  static canExecute(cooldownId: string): boolean {
    return !this.isOnCooldown(cooldownId);
  }

  /**
   * Esegue un'azione con cooldown se possibile
   */
  static tryExecute(cooldownId: string, action: () => void, duration?: number): boolean {
    if (!this.canExecute(cooldownId)) {
      const remaining = this.getRemainingCooldown(cooldownId);
      LoggerWrapper.warn(LogCategory.GAMEPLAY, `Action blocked by cooldown: ${cooldownId}`, {
        cooldownId: cooldownId,
        remainingTime: remaining
      });
      return false;
    }

    action();
    this.startCooldown(cooldownId, duration);
    return true;
  }

  /**
   * Reimposta un cooldown (utile per quando si inizia un nuovo combattimento)
   */
  static resetCooldown(cooldownId: string): void {
    CollectionManager.delete(this.cooldowns, cooldownId);
    CollectionManager.delete(this.cooldowns, `${cooldownId}_duration`);

    LoggerWrapper.debug(LogCategory.GAMEPLAY, `Cooldown reset: ${cooldownId}`, {
      cooldownId: cooldownId
    });
  }

  /**
   * Ottiene la durata di un cooldown
   */
  private static getCooldownDuration(cooldownId: string): number {
    // Durate predefinite per tipi comuni
    const defaultDurations: Record<string, number> = {
      'laser_fire': 800,         // 800ms per laser
      'combat_start': 1000,      // 1 secondo tra inizi combattimento
      'repair_start': 1000,      // 1 secondo tra riparazioni
      'skill_upgrade': 1000,     // 1 secondo tra upgrade
      'chat_message': 500,       // 500ms tra messaggi chat
      'position_update': 50,     // 50ms tra aggiornamenti posizione
      'projectile_fired': 100,   // 100ms tra proiettili
    };

    // Cerca durata personalizzata
    const customDuration = CollectionManager.get(this.cooldowns, `${cooldownId}_duration`);
    if (customDuration) return customDuration;

    // Ritorna durata predefinita o default 1000ms
    return defaultDurations[cooldownId] || 1000;
  }

  /**
   * Verifica rate limit per richieste
   */
  static canSend(rateLimitId: string, maxRequests: number, windowMs: number): boolean {
    const now = TimeManager.getCurrentTime();
    const rateLimitData = CollectionManager.get(this.rateLimits, rateLimitId);

    if (!rateLimitData) {
      // Prima richiesta
      CollectionManager.set(this.rateLimits, rateLimitId, {
        count: 1,
        windowStart: now,
        lastRequest: now
      });
      return true;
    }

    // Controlla se la finestra è scaduta
    if (now - rateLimitData.windowStart >= windowMs) {
      // Reset finestra
      CollectionManager.set(this.rateLimits, rateLimitId, {
        count: 1,
        windowStart: now,
        lastRequest: now
      });
      return true;
    }

    // Controlla limite richieste
    if (rateLimitData.count >= maxRequests) {
      LoggerWrapper.warn(LogCategory.SECURITY, `Rate limit exceeded: ${rateLimitId}`, {
        rateLimitId: rateLimitId,
        count: rateLimitData.count,
        maxRequests: maxRequests,
        windowMs: windowMs,
        remainingTime: windowMs - (now - rateLimitData.windowStart)
      });
      return false;
    }

    // Incrementa contatore
    rateLimitData.count++;
    rateLimitData.lastRequest = now;
    CollectionManager.set(this.rateLimits, rateLimitId, rateLimitData);

    return true;
  }

  /**
   * Verifica rate limit con configurazione
   */
  static checkRateLimit(config: RateLimitConfig): boolean {
    return this.canSend(config.id, config.maxRequests, config.windowMs);
  }

  /**
   * Ottiene statistiche rate limit
   */
  static getRateLimitStats(rateLimitId: string): {
    count: number;
    windowStart: number;
    lastRequest: number;
    remainingRequests?: number;
    remainingTime?: number;
  } | null {
    const data = CollectionManager.get(this.rateLimits, rateLimitId);
    if (!data) return null;

    const now = TimeManager.getCurrentTime();
    const windowMs = 60000; // Default 1 minuto, TODO: rendere configurabile

    return {
      count: data.count,
      windowStart: data.windowStart,
      lastRequest: data.lastRequest,
      remainingRequests: Math.max(0, 2000 - data.count), // Default max 2000
      remainingTime: Math.max(0, windowMs - (now - data.windowStart))
    };
  }

  /**
   * Reset rate limit (per testing o riconnessioni)
   */
  static resetRateLimit(rateLimitId: string): void {
    CollectionManager.delete(this.rateLimits, rateLimitId);
    LoggerWrapper.debug(LogCategory.SYSTEM, `Rate limit reset: ${rateLimitId}`, {
      rateLimitId: rateLimitId
    });
  }

  /**
   * Ottiene statistiche generali del sistema
   */
  static getStats(): {
    activeCooldowns: number;
    activeRateLimits: number;
    cooldownKeys: string[];
    rateLimitKeys: string[];
  } {
    return {
      activeCooldowns: this.cooldowns.size,
      activeRateLimits: this.rateLimits.size,
      cooldownKeys: CollectionManager.getKeys(this.cooldowns),
      rateLimitKeys: CollectionManager.getKeys(this.rateLimits)
    };
  }

  /**
   * Pulisce tutti i cooldown e rate limit scaduti
   */
  static cleanup(): void {
    const now = TimeManager.getCurrentTime();
    const cooldownKeys = CollectionManager.getKeys(this.cooldowns);
    const rateLimitKeys = CollectionManager.getKeys(this.rateLimits);

    // Cleanup cooldown scaduti
    for (const key of cooldownKeys) {
      if (!key.includes('_duration')) {
        const lastUse = CollectionManager.get(this.cooldowns, key);
        const duration = this.getCooldownDuration(key);
        if (lastUse && TimeManager.hasTimeElapsed(lastUse, duration)) {
          CollectionManager.delete(this.cooldowns, key);
          CollectionManager.delete(this.cooldowns, `${key}_duration`);
        }
      }
    }

    // Cleanup rate limit scaduti
    for (const key of rateLimitKeys) {
      const data = CollectionManager.get(this.rateLimits, key);
      if (data && now - data.windowStart >= 60000) { // Default 1 minuto
        CollectionManager.delete(this.rateLimits, key);
      }
    }

    LoggerWrapper.debug(LogCategory.SYSTEM, 'CooldownManager cleanup completed', {
      cleanedCooldowns: cooldownKeys.length - this.cooldowns.size,
      cleanedRateLimits: rateLimitKeys.length - this.rateLimits.size
    });
  }
}