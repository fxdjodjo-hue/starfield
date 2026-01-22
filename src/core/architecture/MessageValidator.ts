/**
 * MessageValidator - Validazione centralizzata dei messaggi
 * Sostituisce validazione duplicata in tutti gli handler del MessageRouter
 */

import { LoggerWrapper, LogCategory, LogLevel } from '../data/LoggerWrapper';
import { InputValidator } from '../utils/InputValidator';
import { TimeManager } from '../utils/TimeManager';

export interface ValidationContext {
  clientId: string;
  userId?: string;
  playerData?: any;
  isAuthenticated?: boolean;
  messageType: string;
  timestamp?: number;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  errorCode?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface RateLimitContext {
  clientId: string;
  messageType: string;
  maxRequests: number;
  windowMs: number;
  currentCount?: number;
  lastRequest?: number;
}

export class MessageValidator {
  private static rateLimits: Map<string, { count: number; windowStart: number; lastRequest: number }> = new Map();

  /**
   * Valida un messaggio completo con tutti i controlli di sicurezza
   */
  static validateMessage(
    message: any,
    context: ValidationContext
  ): ValidationResult {
    try {
      // 1. Validazione struttura base
      const structureResult = this.validateMessageStructure(message, context);
      if (!structureResult.isValid) return structureResult;

      // 2. Validazione autenticazione
      const authResult = this.validateAuthentication(message, context);
      if (!authResult.isValid) return authResult;

      // 3. Validazione stato giocatore
      const playerResult = this.validatePlayerState(message, context);
      if (!playerResult.isValid) return playerResult;

      // 4. Rate limiting
      const rateLimitResult = this.validateRateLimit(message, context);
      if (!rateLimitResult.isValid) return rateLimitResult;

      // 5. Validazione contenuto specifica per tipo
      const contentResult = this.validateMessageContent(message, context);
      if (!contentResult.isValid) return contentResult;

      return { isValid: true };
    } catch (error) {
      LoggerWrapper.error(LogCategory.SECURITY, 'Message validation failed with exception', error as Error, {
        messageType: context.messageType,
        clientId: context.clientId,
        userId: context.userId
      });

      return {
        isValid: false,
        error: 'Validation system error',
        errorCode: 'VALIDATION_ERROR',
        severity: 'high'
      };
    }
  }

  /**
   * Valida struttura base del messaggio
   */
  private static validateMessageStructure(
    message: any,
    context: ValidationContext
  ): ValidationResult {
    // Controllo tipo messaggio
    if (!message || typeof message !== 'object') {
      return {
        isValid: false,
        error: 'Message must be a valid object',
        errorCode: 'INVALID_MESSAGE_FORMAT',
        severity: 'high'
      };
    }

    if (!message.type || typeof message.type !== 'string') {
      return {
        isValid: false,
        error: 'Message must have a valid type field',
        errorCode: 'MISSING_MESSAGE_TYPE',
        severity: 'high'
      };
    }

    // Verifica corrispondenza tipo dichiarato vs contesto
    if (message.type !== context.messageType) {
      return {
        isValid: false,
        error: `Message type mismatch: expected ${context.messageType}, got ${message.type}`,
        errorCode: 'MESSAGE_TYPE_MISMATCH',
        severity: 'high'
      };
    }

    return { isValid: true };
  }

  /**
   * Valida autenticazione e identità
   */
  private static validateAuthentication(
    message: any,
    context: ValidationContext
  ): ValidationResult {
    // Client ID deve essere presente e valido
    if (!context.clientId || typeof context.clientId !== 'string') {
      return {
        isValid: false,
        error: 'Invalid client ID in context',
        errorCode: 'INVALID_CLIENT_ID',
        severity: 'critical'
      };
    }

    // Per messaggi che richiedono autenticazione
    const requiresAuth = this.messageRequiresAuthentication(context.messageType);
    if (requiresAuth && !context.isAuthenticated) {
      return {
        isValid: false,
        error: 'Authentication required for this message type',
        errorCode: 'AUTHENTICATION_REQUIRED',
        severity: 'critical'
      };
    }

    // Validazione clientId nel messaggio (se presente)
    if (message.clientId && message.clientId !== context.clientId) {
      return {
        isValid: false,
        error: 'Client ID mismatch between message and context',
        errorCode: 'CLIENT_ID_MISMATCH',
        severity: 'high'
      };
    }

    // Validazione userId (se presente nel messaggio)
    if (message.userId && context.userId && message.userId !== context.userId) {
      return {
        isValid: false,
        error: 'User ID mismatch between message and context',
        errorCode: 'USER_ID_MISMATCH',
        severity: 'high'
      };
    }

    return { isValid: true };
  }

  /**
   * Valida stato del giocatore
   */
  private static validatePlayerState(
    message: any,
    context: ValidationContext
  ): ValidationResult {
    if (!context.playerData) {
      // Alcuni messaggi potrebbero non richiedere player data
      const requiresPlayerData = this.messageRequiresPlayerData(context.messageType);
      if (requiresPlayerData) {
        return {
          isValid: false,
          error: 'Player data required but not found',
          errorCode: 'PLAYER_DATA_MISSING',
          severity: 'high'
        };
      }
      return { isValid: true };
    }

    // Controlli per giocatore morto
    const deathRestricted = this.isDeathRestrictedMessage(context.messageType);
    if (deathRestricted && context.playerData.health <= 0) {
      return {
        isValid: false,
        error: 'Action not allowed for dead player',
        errorCode: 'PLAYER_DEAD',
        severity: 'medium'
      };
    }

    // Altri controlli di stato giocatore possono essere aggiunti qui

    return { isValid: true };
  }

  /**
   * Valida rate limiting
   */
  private static validateRateLimit(
    message: any,
    context: ValidationContext
  ): ValidationResult {
    const rateLimitConfig = this.getRateLimitConfig(context.messageType);
    if (!rateLimitConfig) {
      // Messaggio senza rate limiting
      return { isValid: true };
    }

    const rateLimitKey = `${context.clientId}_${context.messageType}`;
    const now = TimeManager.getCurrentTime();

    const rateLimitData = this.rateLimits.get(rateLimitKey);

    if (!rateLimitData) {
      // Prima richiesta
      this.rateLimits.set(rateLimitKey, {
        count: 1,
        windowStart: now,
        lastRequest: now
      });
      return { isValid: true };
    }

    // Controlla se la finestra è scaduta
    if (now - rateLimitData.windowStart >= rateLimitConfig.windowMs) {
      // Reset finestra
      this.rateLimits.set(rateLimitKey, {
        count: 1,
        windowStart: now,
        lastRequest: now
      });
      return { isValid: true };
    }

    // Controlla limite richieste
    if (rateLimitData.count >= rateLimitConfig.maxRequests) {
      LoggerWrapper.warn(LogCategory.SECURITY, `Rate limit exceeded for ${context.messageType}`, {
        clientId: context.clientId,
        messageType: context.messageType,
        count: rateLimitData.count,
        maxRequests: rateLimitConfig.maxRequests,
        windowMs: rateLimitConfig.windowMs,
        remainingTime: rateLimitConfig.windowMs - (now - rateLimitData.windowStart)
      });

      return {
        isValid: false,
        error: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitConfig.windowMs - (now - rateLimitData.windowStart)) / 1000)} seconds`,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        severity: 'low'
      };
    }

    // Incrementa contatore
    rateLimitData.count++;
    rateLimitData.lastRequest = now;
    this.rateLimits.set(rateLimitKey, rateLimitData);

    return { isValid: true };
  }

  /**
   * Valida contenuto specifico del messaggio
   */
  private static validateMessageContent(
    message: any,
    context: ValidationContext
  ): ValidationResult {
    // Validazione specifica per tipo di messaggio
    switch (context.messageType) {
      case 'position_update':
        return this.validatePositionUpdate(message, context);

      case 'projectile_fired':
        return this.validateProjectileFired(message, context);

      case 'start_combat':
        return this.validateStartCombat(message, context);

      case 'skill_upgrade':
        return this.validateSkillUpgrade(message, context);

      case 'chat_message':
        return this.validateChatMessage(message, context);

      default:
        // Per messaggi senza validazione specifica, passa
        return { isValid: true };
    }
  }

  /**
   * Validazione posizione
   */
  private static validatePositionUpdate(
    message: any,
    context: ValidationContext
  ): ValidationResult {
    const positionValidation = InputValidator.validatePosition(
      message.x, message.y, message.rotation
    );

    if (!positionValidation.isValid) {
      return {
        isValid: false,
        error: `Invalid position: ${positionValidation.error}`,
        errorCode: 'INVALID_POSITION',
        severity: 'medium'
      };
    }

    // Controllo area valida della mappa
    if (message.x < -10000 || message.x > 10000 || message.y < -10000 || message.y > 10000) {
      return {
        isValid: false,
        error: 'Position outside valid map area',
        errorCode: 'INVALID_MAP_POSITION',
        severity: 'medium'
      };
    }

    return { isValid: true };
  }

  /**
   * Validazione projectile fired
   */
  private static validateProjectileFired(
    message: any,
    context: ValidationContext
  ): ValidationResult {
    // Validazione munizioni
    if (!context.playerData || context.playerData.ammo <= 0) {
      return {
        isValid: false,
        error: 'No ammo available',
        errorCode: 'NO_AMMO',
        severity: 'medium'
      };
    }

    // Validazione posizione
    const positionValidation = InputValidator.validatePosition(message.position?.x, message.position?.y);
    if (!positionValidation.isValid) {
      return {
        isValid: false,
        error: `Invalid projectile position: ${positionValidation.error}`,
        errorCode: 'INVALID_PROJECTILE_POSITION',
        severity: 'medium'
      };
    }

    // Validazione velocità
    const velocityValidation = InputValidator.validateVelocity(message.velocity?.x, message.velocity?.y);
    if (!velocityValidation.isValid) {
      return {
        isValid: false,
        error: `Invalid projectile velocity: ${velocityValidation.error}`,
        errorCode: 'INVALID_PROJECTILE_VELOCITY',
        severity: 'medium'
      };
    }

    return { isValid: true };
  }

  /**
   * Validazione start combat
   */
  private static validateStartCombat(
    message: any,
    context: ValidationContext
  ): ValidationResult {
    if (!message.npcId || typeof message.npcId !== 'string') {
      return {
        isValid: false,
        error: 'Valid NPC ID required for combat',
        errorCode: 'INVALID_NPC_ID',
        severity: 'medium'
      };
    }

    return { isValid: true };
  }

  /**
   * Validazione skill upgrade
   */
  private static validateSkillUpgrade(
    message: any,
    context: ValidationContext
  ): ValidationResult {
    const validUpgradeTypes = ['hp', 'shield', 'speed', 'damage'];
    if (!message.upgradeType || !validUpgradeTypes.includes(message.upgradeType)) {
      return {
        isValid: false,
        error: 'Invalid upgrade type',
        errorCode: 'INVALID_UPGRADE_TYPE',
        severity: 'medium'
      };
    }

    return { isValid: true };
  }

  /**
   * Validazione chat message
   */
  private static validateChatMessage(
    message: any,
    context: ValidationContext
  ): ValidationResult {
    if (!message.message || typeof message.message !== 'string') {
      return {
        isValid: false,
        error: 'Chat message content required',
        errorCode: 'EMPTY_CHAT_MESSAGE',
        severity: 'low'
      };
    }

    if (message.message.trim().length === 0) {
      return {
        isValid: false,
        error: 'Chat message cannot be empty',
        errorCode: 'EMPTY_CHAT_MESSAGE',
        severity: 'low'
      };
    }

    if (message.message.length > 500) {
      return {
        isValid: false,
        error: 'Chat message too long (max 500 characters)',
        errorCode: 'CHAT_MESSAGE_TOO_LONG',
        severity: 'low'
      };
    }

    return { isValid: true };
  }

  /**
   * Verifica se il messaggio richiede autenticazione
   */
  private static messageRequiresAuthentication(messageType: string): boolean {
    const publicMessages = ['join', 'heartbeat'];
    return !publicMessages.includes(messageType);
  }

  /**
   * Verifica se il messaggio richiede player data
   */
  private static messageRequiresPlayerData(messageType: string): boolean {
    const noPlayerDataMessages = ['join', 'heartbeat'];
    return !noPlayerDataMessages.includes(messageType);
  }

  /**
   * Verifica se il messaggio è restricted per giocatori morti
   */
  private static isDeathRestrictedMessage(messageType: string): boolean {
    const deathRestricted = [
      'position_update', 'projectile_fired', 'start_combat',
      'skill_upgrade', 'chat_message'
    ];
    return deathRestricted.includes(messageType);
  }

  /**
   * Ottiene configurazione rate limit per tipo di messaggio
   */
  private static getRateLimitConfig(messageType: string): RateLimitContext | null {
    const rateLimits: Record<string, { maxRequests: number; windowMs: number }> = {
      'position_update': { maxRequests: 30, windowMs: 1000 },    // 30 al secondo
      'projectile_fired': { maxRequests: 10, windowMs: 1000 },   // 10 al secondo
      'start_combat': { maxRequests: 5, windowMs: 1000 },        // 5 al secondo
      'skill_upgrade': { maxRequests: 2, windowMs: 1000 },       // 2 al secondo
      'chat_message': { maxRequests: 5, windowMs: 10000 },       // 5 ogni 10 secondi
      'heartbeat': { maxRequests: 60, windowMs: 60000 }          // 60 al minuto
    };

    const config = rateLimits[messageType];
    return config ? { ...config, messageType, clientId: '', maxRequests: config.maxRequests, windowMs: config.windowMs } : null;
  }

  /**
   * Cleanup rate limits scaduti (per liberare memoria)
   */
  static cleanupRateLimits(): void {
    const now = TimeManager.getCurrentTime();

    for (const [key, data] of this.rateLimits.entries()) {
      // Rimuovi rate limit scaduti da più di 1 minuto
      if (now - data.windowStart > 60000) {
        this.rateLimits.delete(key);
      }
    }

    LoggerWrapper.debug(LogCategory.SYSTEM, 'Rate limit cleanup completed', {
      remainingLimits: this.rateLimits.size
    });
  }

  /**
   * Ottiene statistiche di validazione
   */
  static getStats(): {
    activeRateLimits: number;
    rateLimitKeys: string[];
  } {
    return {
      activeRateLimits: this.rateLimits.size,
      rateLimitKeys: Array.from(this.rateLimits.keys())
    };
  }
}