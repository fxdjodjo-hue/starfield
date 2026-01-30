const { logger } = require('../logger.cjs');

/**
 * Input Validator Server-Side - valida tutti gli input dal client
 * Previene injection, overflow, e dati malformati
 */
class ServerInputValidator {
  constructor() {
    // Limiti di sicurezza per ogni tipo di input
    this.LIMITS = {
      POSITION: {
        X_MIN: -50000,
        X_MAX: 50000,
        Y_MIN: -50000,
        Y_MAX: 50000,
        ROTATION_MIN: -Math.PI,
        ROTATION_MAX: Math.PI
      },
      VELOCITY: {
        MAX_SPEED: 1000, // unità per secondo
      },
      COMBAT: {
        MAX_RANGE: 2000, // range massimo combattimento
      },
      CHAT: {
        MAX_LENGTH: 200,
        MIN_LENGTH: 1
      },
      IDENTIFIERS: {
        MAX_ID_LENGTH: 100,
        UUID_PATTERN: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
      }
    };
  }

  /**
   * Valida posizione - punto critico per cheating
   */
  validatePosition(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      errors.push('Position data must be an object');
      return { isValid: false, errors };
    }

    const { x, y, rotation, velocityX, velocityY } = data;

    // Validazione X
    if (typeof x !== 'number' || isNaN(x) || !isFinite(x)) {
      errors.push('Position X must be a valid finite number');
    } else if (x < this.LIMITS.POSITION.X_MIN || x > this.LIMITS.POSITION.X_MAX) {
      errors.push(`Position X out of bounds: ${x}`);
    }

    // Validazione Y
    if (typeof y !== 'number' || isNaN(y) || !isFinite(y)) {
      errors.push('Position Y must be a valid finite number');
    } else if (y < this.LIMITS.POSITION.Y_MIN || y > this.LIMITS.POSITION.Y_MAX) {
      errors.push(`Position Y out of bounds: ${y}`);
    }

    // Validazione rotazione (opzionale)
    if (rotation !== undefined) {
      if (typeof rotation !== 'number' || isNaN(rotation) || !isFinite(rotation)) {
        errors.push('Rotation must be a valid finite number');
      } else if (rotation < this.LIMITS.POSITION.ROTATION_MIN || rotation > this.LIMITS.POSITION.ROTATION_MAX) {
        errors.push(`Rotation out of bounds: ${rotation}`);
      }
    }

    // Validazione velocità (opzionali per extrapolation)
    if (velocityX !== undefined) {
      if (typeof velocityX !== 'number' || isNaN(velocityX) || !isFinite(velocityX)) {
        errors.push('VelocityX must be a valid finite number');
      } else if (Math.abs(velocityX) > this.LIMITS.VELOCITY.MAX_SPEED) {
        errors.push(`VelocityX too high: ${velocityX}`);
      }
    }

    if (velocityY !== undefined) {
      if (typeof velocityY !== 'number' || isNaN(velocityY) || !isFinite(velocityY)) {
        errors.push('VelocityY must be a valid finite number');
      } else if (Math.abs(velocityY) > this.LIMITS.VELOCITY.MAX_SPEED) {
        errors.push(`VelocityY too high: ${velocityY}`);
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Sanitizzazione: clamp valori e normalizza rotation
    let sanitizedRotation = rotation;
    if (rotation !== undefined) {
      // Normalizza rotation nel range [-Math.PI, Math.PI]
      sanitizedRotation = ((rotation + Math.PI) % (2 * Math.PI)) - Math.PI;
      // Assicura che sia entro i limiti (doppia sicurezza)
      sanitizedRotation = Math.max(this.LIMITS.POSITION.ROTATION_MIN, Math.min(this.LIMITS.POSITION.ROTATION_MAX, sanitizedRotation));
    }

    const sanitized = {
      x: Math.max(this.LIMITS.POSITION.X_MIN, Math.min(this.LIMITS.POSITION.X_MAX, x)),
      y: Math.max(this.LIMITS.POSITION.Y_MIN, Math.min(this.LIMITS.POSITION.Y_MAX, y)),
      rotation: sanitizedRotation,
      velocityX: velocityX !== undefined ? Math.max(-this.LIMITS.VELOCITY.MAX_SPEED, Math.min(this.LIMITS.VELOCITY.MAX_SPEED, velocityX)) : 0,
      velocityY: velocityY !== undefined ? Math.max(-this.LIMITS.VELOCITY.MAX_SPEED, Math.min(this.LIMITS.VELOCITY.MAX_SPEED, velocityY)) : 0
    };

    return {
      isValid: true,
      errors: [],
      sanitizedData: sanitized
    };
  }

  /**
   * Valida combattimento - previene combat exploits
   */
  validateCombat(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      errors.push('Combat data must be an object');
      return { isValid: false, errors };
    }

    const { npcId, playerId } = data;

    // Validazione NPC ID
    if (!npcId || typeof npcId !== 'string') {
      errors.push('NPC ID must be a non-empty string');
    } else if (npcId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
      errors.push('NPC ID too long');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(npcId)) {
      errors.push('NPC ID contains invalid characters');
    }

    // Validazione Player ID
    if (!playerId || typeof playerId !== 'string') {
      errors.push('Player ID must be a non-empty string');
    } else if (playerId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
      errors.push('Player ID too long');
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      sanitizedData: { npcId, playerId }
    };
  }

  /**
   * Valida chat - previene spam e injection
   */
  validateChat(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      errors.push('Chat data must be an object');
      return { isValid: false, errors };
    }

    const { content } = data;

    if (!content || typeof content !== 'string') {
      errors.push('Chat content must be a non-empty string');
    } else {
      const trimmed = content.trim();

      if (trimmed.length < this.LIMITS.CHAT.MIN_LENGTH) {
        errors.push('Chat message too short');
      } else if (trimmed.length > this.LIMITS.CHAT.MAX_LENGTH) {
        errors.push('Chat message too long');
      }

      // Sanitizzazione: rimuovi HTML tags e caratteri pericolosi
      const sanitized = trimmed
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters

      if (sanitized !== trimmed) {
        logger.warn('SERVER', 'Chat message contained potentially dangerous content');
      }

      return {
        isValid: errors.length === 0,
        errors,
        sanitizedData: { content: sanitized }
      };
    }

    return { isValid: false, errors };
  }


  /**
   * Valida heartbeat - connessione keep-alive
   */
  validateHeartbeat(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      errors.push('Heartbeat data must be an object');
      return { isValid: false, errors };
    }

    const { timestamp } = data;

    // Validazione timestamp
    if (typeof timestamp !== 'number' || isNaN(timestamp) || !isFinite(timestamp)) {
      errors.push('Heartbeat timestamp must be a valid number');
    } else if (timestamp <= 0) {
      errors.push('Heartbeat timestamp must be positive');
    } else {
      // Controllo ragionevole: non più vecchio di 30 secondi, non più nuovo di 5 secondi nel futuro
      const now = Date.now();
      const age = now - timestamp;
      const futureOffset = timestamp - now;

      if (age > 60000) { // 60 secondi
        errors.push('Heartbeat timestamp too old');
      } else if (futureOffset > 60000) { // 60 secondi nel futuro
        errors.push('Heartbeat timestamp too far in future');
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      sanitizedData: { timestamp: timestamp }
    };
  }

  /**
   * Valida velocità - previene speed hacks
   */
  validateVelocity(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      errors.push('Velocity data must be an object');
      return { isValid: false, errors };
    }

    const { x, y } = data;

    if (typeof x !== 'number' || isNaN(x) || !isFinite(x)) {
      errors.push('Velocity X must be a valid finite number');
    }

    if (typeof y !== 'number' || isNaN(y) || !isFinite(y)) {
      errors.push('Velocity Y must be a valid finite number');
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Validazione velocità massima
    const speed = Math.sqrt(x * x + y * y);
    if (speed > this.LIMITS.VELOCITY.MAX_SPEED) {
      errors.push(`Velocity exceeds maximum speed: ${speed} > ${this.LIMITS.VELOCITY.MAX_SPEED}`);
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      sanitizedData: { x: x || 0, y: y || 0 }
    };
  }

  /**
   * Validazione generale per qualsiasi messaggio
   * Questo è il punto di ingresso unico per tutta la validazione
   */
  validate(messageType, data) {
    try {
      switch (messageType) {
        case 'join':
          // Valida messaggio di join del client
          const joinErrors = [];

          if (!data.clientId || typeof data.clientId !== 'string') {
            joinErrors.push('Invalid or missing clientId');
          }

          if (!data.nickname || typeof data.nickname !== 'string') {
            joinErrors.push('Invalid or missing nickname');
          }

          return {
            isValid: joinErrors.length === 0,
            errors: joinErrors,
            sanitizedData: {
              clientId: data.clientId,
              nickname: data.nickname,
              // Altri campi possono essere aggiunti se necessario
            }
          };
        case 'position_update':
          return this.validatePosition(data);
        case 'heartbeat':
          return this.validateHeartbeat(data);
        case 'start_combat':
        case 'stop_combat':
          return this.validateCombat(data);
        case 'chat_message':
          return this.validateChat(data);
        // SECURITY: test_damage RIMOSSO - metodo client eliminato per sicurezza
        case 'projectile_fired':
          // Valida sia posizione che velocità
          const posResult = this.validatePosition(data.position);
          const velResult = this.validateVelocity(data.velocity);

          return {
            isValid: posResult.isValid && velResult.isValid,
            errors: [...posResult.errors, ...velResult.errors],
            sanitizedData: {
              position: posResult.sanitizedData,
              velocity: velResult.sanitizedData,
              projectileType: data.projectileType || 'laser'
            }
          };
        case 'request_leaderboard':
          // Valida richiesta leaderboard
          const leaderboardErrors = [];

          if (data.sortBy && !['ranking_points', 'honor', 'experience', 'kills'].includes(data.sortBy)) {
            leaderboardErrors.push('Invalid sortBy value');
          }

          if (data.limit && (typeof data.limit !== 'number' || data.limit < 1 || data.limit > 1000)) {
            leaderboardErrors.push('Invalid limit value (must be 1-1000)');
          }

          if (leaderboardErrors.length > 0) {
            return { isValid: false, errors: leaderboardErrors };
          }

          return {
            isValid: true,
            errors: [],
            sanitizedData: {
              sortBy: data.sortBy || 'ranking_points',
              limit: data.limit || 100
            }
          };

        case 'skill_upgrade_request':
          // Valida richiesta di upgrade skill
          const skillErrors = [];

          if (!data.playerId || typeof data.playerId !== 'string') {
            skillErrors.push('Invalid or missing playerId');
          }

          if (!data.upgradeType || typeof data.upgradeType !== 'string') {
            skillErrors.push('Invalid or missing upgradeType');
          } else if (!['hp', 'shield', 'speed', 'damage', 'missileDamage'].includes(data.upgradeType)) {
            skillErrors.push('Invalid upgradeType - must be hp, shield, speed, damage, or missileDamage');
          }

          return {
            isValid: skillErrors.length === 0,
            errors: skillErrors,
            sanitizedData: {
              playerId: data.playerId,
              upgradeType: data.upgradeType
            }
          };

        case 'request_player_data':
          // Valida richiesta dati player
          const playerDataErrors = [];

          if (!data.playerId || typeof data.playerId !== 'string') {
            playerDataErrors.push('Invalid or missing playerId');
          } else if (data.playerId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
            playerDataErrors.push('Player ID too long');
          } else if (!this.LIMITS.IDENTIFIERS.UUID_PATTERN.test(data.playerId)) {
            playerDataErrors.push('Player ID must be a valid UUID');
          }

          return {
            isValid: playerDataErrors.length === 0,
            errors: playerDataErrors,
            sanitizedData: {
              playerId: data.playerId
            }
          };

        case 'save_request':
          // Valida richiesta salvataggio
          const saveErrors = [];

          if (!data.playerId || typeof data.playerId !== 'string') {
            saveErrors.push('Invalid or missing playerId');
          } else if (data.playerId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
            saveErrors.push('Player ID too long');
          }

          if (typeof data.timestamp !== 'number' || isNaN(data.timestamp) || data.timestamp <= 0) {
            saveErrors.push('Invalid timestamp');
          }

          return {
            isValid: saveErrors.length === 0,
            errors: saveErrors,
            sanitizedData: {
              playerId: data.playerId,
              timestamp: data.timestamp
            }
          };

        case 'global_monitor_request':
          // Valida richiesta monitoraggio globale (solo admin)
          const monitorErrors = [];

          if (!data.clientId || typeof data.clientId !== 'string') {
            monitorErrors.push('Invalid or missing clientId');
          } else if (data.clientId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
            monitorErrors.push('Client ID too long');
          }

          return {
            isValid: monitorErrors.length === 0,
            errors: monitorErrors,
            sanitizedData: {
              clientId: data.clientId
            }
          };

        case 'player_respawn_request':
          // Valida richiesta respawn player
          const respawnErrors = [];

          if (!data.clientId || typeof data.clientId !== 'string') {
            respawnErrors.push('Invalid or missing clientId');
          } else if (data.clientId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
            respawnErrors.push('Client ID too long');
          }

          return {
            isValid: respawnErrors.length === 0,
            errors: respawnErrors,
            sanitizedData: {
              clientId: data.clientId
            }
          };

        case 'equip_item':
          // Valida richiesta equipaggiamento oggetto
          const equipErrors = [];

          // instanceId può essere string (equip) o null (unequip)
          if (data.instanceId !== null && typeof data.instanceId !== 'string') {
            equipErrors.push('Invalid instanceId (must be string or null)');
          } else if (typeof data.instanceId === 'string' && data.instanceId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
            equipErrors.push('Instance ID too long');
          }

          // slot deve essere una stringa (es. 'HULL', 'SHIELD') o un numero (legacy)
          if (typeof data.slot !== 'string' && typeof data.slot !== 'number') {
            equipErrors.push('Invalid slot (must be a string)');
          }

          return {
            isValid: equipErrors.length === 0,
            errors: equipErrors,
            sanitizedData: {
              instanceId: data.instanceId,
              slot: data.slot
            }
          };

        case 'portal_use':
          // Valida richiesta utilizzo portale
          const portalErrors = [];

          if (data.portalId !== undefined && data.portalId !== null) {
            if (typeof data.portalId !== 'string' && typeof data.portalId !== 'number') {
              portalErrors.push('Invalid portalId (must be a string or number)');
            } else if (typeof data.portalId === 'string' && data.portalId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
              portalErrors.push('Portal ID too long');
            }
          }

          return {
            isValid: portalErrors.length === 0,
            errors: portalErrors,
            sanitizedData: {
              portalId: data.portalId
            }
          };

        default:
          // SECURITY: Rifiuta tutti i messaggi sconosciuti - solo tipi espliciti permessi
          return {
            isValid: false,
            errors: [`Unknown message type: ${messageType}. Only explicitly allowed message types are accepted.`],
            sanitizedData: null
          };
      }
    } catch (error) {
      logger.error('VALIDATOR', `Validation error for ${messageType}:`, error.message);
      return {
        isValid: false,
        errors: ['Validation system error']
      };
    }
  }

  /**
   * Valida che il messaggio abbia una struttura minima valida
   */
  validateMessageStructure(message) {
    const errors = [];

    if (!message || typeof message !== 'object') {
      errors.push('Message must be an object');
      return { isValid: false, errors };
    }

    if (!message.type || typeof message.type !== 'string') {
      errors.push('Message must have a type field');
    }

    if (!message.clientId && !message.playerId) {
      errors.push('Message must have clientId or playerId');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = ServerInputValidator;