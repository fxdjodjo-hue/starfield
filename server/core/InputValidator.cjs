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
      PET_NICKNAME: {
        MAX_LENGTH: 24
      },
      CRAFTING: {
        MAX_RECIPE_ID_LENGTH: 100
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

    const { x, y, rotation, velocityX, velocityY, petPosition } = data;

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

    // Validazione posizione pet (opzionale, ma usata per sincronizzazione remota)
    if (petPosition !== undefined && petPosition !== null) {
      if (typeof petPosition !== 'object') {
        errors.push('Pet position must be an object');
      } else {
        const { x: petX, y: petY, rotation: petRotation } = petPosition;

        if (typeof petX !== 'number' || isNaN(petX) || !isFinite(petX)) {
          errors.push('Pet position X must be a valid finite number');
        } else if (petX < this.LIMITS.POSITION.X_MIN || petX > this.LIMITS.POSITION.X_MAX) {
          errors.push(`Pet position X out of bounds: ${petX}`);
        }

        if (typeof petY !== 'number' || isNaN(petY) || !isFinite(petY)) {
          errors.push('Pet position Y must be a valid finite number');
        } else if (petY < this.LIMITS.POSITION.Y_MIN || petY > this.LIMITS.POSITION.Y_MAX) {
          errors.push(`Pet position Y out of bounds: ${petY}`);
        }

        if (petRotation !== undefined) {
          if (typeof petRotation !== 'number' || isNaN(petRotation) || !isFinite(petRotation)) {
            errors.push('Pet rotation must be a valid finite number');
          }
        }
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

    let sanitizedPetPosition = null;
    if (petPosition && typeof petPosition === 'object') {
      let sanitizedPetRotation = sanitizedRotation ?? 0;
      if (petPosition.rotation !== undefined) {
        sanitizedPetRotation = ((petPosition.rotation + Math.PI) % (2 * Math.PI)) - Math.PI;
        sanitizedPetRotation = Math.max(this.LIMITS.POSITION.ROTATION_MIN, Math.min(this.LIMITS.POSITION.ROTATION_MAX, sanitizedPetRotation));
      }

      sanitizedPetPosition = {
        x: Math.max(this.LIMITS.POSITION.X_MIN, Math.min(this.LIMITS.POSITION.X_MAX, petPosition.x)),
        y: Math.max(this.LIMITS.POSITION.Y_MIN, Math.min(this.LIMITS.POSITION.Y_MAX, petPosition.y)),
        rotation: sanitizedPetRotation
      };
    }

    const sanitized = {
      x: Math.max(this.LIMITS.POSITION.X_MIN, Math.min(this.LIMITS.POSITION.X_MAX, x)),
      y: Math.max(this.LIMITS.POSITION.Y_MIN, Math.min(this.LIMITS.POSITION.Y_MAX, y)),
      rotation: sanitizedRotation,
      velocityX: velocityX !== undefined ? Math.max(-this.LIMITS.VELOCITY.MAX_SPEED, Math.min(this.LIMITS.VELOCITY.MAX_SPEED, velocityX)) : 0,
      velocityY: velocityY !== undefined ? Math.max(-this.LIMITS.VELOCITY.MAX_SPEED, Math.min(this.LIMITS.VELOCITY.MAX_SPEED, velocityY)) : 0,
      petPosition: sanitizedPetPosition
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

    const { npcId, clientId } = data;

    // Validazione NPC ID
    if (!npcId || typeof npcId !== 'string') {
      errors.push('NPC ID must be a non-empty string');
    } else if (npcId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
      errors.push('NPC ID too long');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(npcId)) {
      errors.push('NPC ID contains invalid characters');
    }

    // Validazione Client ID
    if (!clientId || typeof clientId !== 'string') {
      errors.push('Client ID must be a non-empty string');
    } else if (clientId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
      errors.push('Client ID too long');
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      sanitizedData: { npcId, clientId }
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
   * Valida raccolta risorsa world-space (server authoritative)
   */
  validateResourceCollect(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      errors.push('Resource collect data must be an object');
      return { isValid: false, errors };
    }

    const { clientId, resourceId } = data;

    if (!clientId || typeof clientId !== 'string') {
      errors.push('Invalid or missing clientId');
    } else if (clientId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
      errors.push('Client ID too long');
    }

    if (!resourceId || typeof resourceId !== 'string') {
      errors.push('Invalid or missing resourceId');
    } else if (resourceId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
      errors.push('Resource ID too long');
    } else if (!/^[a-zA-Z0-9:_-]+$/.test(resourceId)) {
      errors.push('Resource ID contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: {
        clientId,
        resourceId
      }
    };
  }

  /**
   * Valida richiesta crafting server-authoritative
   */
  validateCraftItem(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      errors.push('Craft item data must be an object');
      return { isValid: false, errors };
    }

    const { clientId, recipeId } = data;

    if (!clientId || typeof clientId !== 'string') {
      errors.push('Invalid or missing clientId');
    } else if (clientId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
      errors.push('Client ID too long');
    }

    const normalizedRecipeId = String(recipeId ?? '').trim();
    if (!normalizedRecipeId) {
      errors.push('Invalid or missing recipeId');
    } else if (normalizedRecipeId.length > this.LIMITS.CRAFTING.MAX_RECIPE_ID_LENGTH) {
      errors.push(`Recipe ID too long (max ${this.LIMITS.CRAFTING.MAX_RECIPE_ID_LENGTH})`);
    } else if (!/^[a-zA-Z0-9:_-]+$/.test(normalizedRecipeId)) {
      errors.push('Recipe ID contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: {
        clientId,
        recipeId: normalizedRecipeId
      }
    };
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
   * Valida movimento nel tempo (Anti-Speed Hack)
   * @param {Object} currentPos - Posizione attuale {x, y}
   * @param {Object} previousPos - Posizione precedente {x, y, timestamp}
   * @param {number} currentTimestamp - Timestamp attuale
   * @returns {Object} { isValid, errors }
   */
  validateMovement(currentPos, previousPos, currentTimestamp) {
    if (!previousPos || !previousPos.timestamp) {
      return { isValid: true, errors: [] }; // Primo pacchetto, non possiamo validare la velocità
    }

    const timeDiff = currentTimestamp - previousPos.timestamp;

    // Ignora pacchetti duplicati o troppo vicini (meno di 10ms)
    // Questo previene falsi positivi dovuti a burst di pacchetti
    if (timeDiff < 10) {
      return { isValid: true, errors: [] };
    }

    // Calcola distanza percorsa
    const dx = currentPos.x - previousPos.x;
    const dy = currentPos.y - previousPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Calcola velocità richiesta per coprire tale distanza in tale tempo
    // speed = distance / time (units/ms)
    const requiredSpeed = distance / timeDiff;

    // Converti in units/second per confronto con MAX_SPEED
    const requiredSpeedPerSec = requiredSpeed * 1000;

    // Tolleranza: 20% di buffer per lag/jitter di rete + base tolerance
    // La MAX_SPEED è circa 1000 (definito in LIMITS.VELOCITY.MAX_SPEED)
    const MAX_ALLOWED_SPEED = this.LIMITS.VELOCITY.MAX_SPEED * 1.2;

    if (requiredSpeedPerSec > MAX_ALLOWED_SPEED) {
      // SECURITY WARNING: Movimento sospetto rilevato
      return {
        isValid: false,
        errors: [`Speed hack detected: speed ${Math.round(requiredSpeedPerSec)} > ${MAX_ALLOWED_SPEED} (dist: ${Math.round(distance)}, dt: ${timeDiff})`]
      };
    }

    return { isValid: true, errors: [] };
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

          if (!data.clientId || typeof data.clientId !== 'string') {
            skillErrors.push('Invalid or missing clientId');
          } else if (data.clientId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
            skillErrors.push('Client ID too long');
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
              clientId: data.clientId,
              upgradeType: data.upgradeType
            }
          };

        case 'request_player_data':
          // Valida richiesta dati player
          const playerDataErrors = [];

          if (!data.clientId || typeof data.clientId !== 'string') {
            playerDataErrors.push('Invalid or missing clientId');
          } else if (data.clientId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
            playerDataErrors.push('Client ID too long');
          }

          return {
            isValid: playerDataErrors.length === 0,
            errors: playerDataErrors,
            sanitizedData: {
              clientId: data.clientId
            }
          };

        case 'save_request':
          // Valida richiesta salvataggio
          const saveErrors = [];

          if (!data.clientId || typeof data.clientId !== 'string') {
            saveErrors.push('Invalid or missing clientId');
          } else if (data.clientId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
            saveErrors.push('Client ID too long');
          }

          return {
            isValid: saveErrors.length === 0,
            errors: saveErrors,
            sanitizedData: {
              clientId: data.clientId
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

        case 'sell_item':
          // Valida richiesta vendita oggetto
          const sellErrors = [];

          if (data.instanceId !== undefined && data.instanceId !== null) {
            if (typeof data.instanceId !== 'string') {
              sellErrors.push('Invalid instanceId (must be a string)');
            } else if (data.instanceId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
              sellErrors.push('Instance ID too long');
            }
          }

          if (data.itemId !== undefined && data.itemId !== null) {
            if (typeof data.itemId !== 'string') {
              sellErrors.push('Invalid itemId (must be a string)');
            } else if (data.itemId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
              sellErrors.push('Item ID too long');
            }
          }

          // Deve esserci almeno un target di vendita (instanceId o itemId)
          if ((!data.instanceId || typeof data.instanceId !== 'string') &&
            (!data.itemId || typeof data.itemId !== 'string')) {
            sellErrors.push('Missing sell target (instanceId or itemId required)');
          }

          let sanitizedQuantity = 1;
          if (data.quantity !== undefined && data.quantity !== null) {
            const qty = Number(data.quantity);
            if (!Number.isFinite(qty) || qty <= 0) {
              sellErrors.push('Invalid quantity (must be a positive number)');
            } else {
              // Cap di sicurezza lato validator; clamp finale lato business logic.
              sanitizedQuantity = Math.max(1, Math.min(500, Math.floor(qty)));
            }
          }

          return {
            isValid: sellErrors.length === 0,
            errors: sellErrors,
            sanitizedData: {
              instanceId: data.instanceId,
              itemId: data.itemId,
              quantity: sanitizedQuantity
            }
          };

        case 'ship_skin_action':
          // Valida richiesta acquisto/equip skin nave
          const shipSkinErrors = [];
          const allowedSkinActions = ['equip', 'purchase', 'purchase_and_equip'];

          if (!data.clientId || typeof data.clientId !== 'string') {
            shipSkinErrors.push('Invalid or missing clientId');
          } else if (data.clientId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
            shipSkinErrors.push('Client ID too long');
          }

          if (!data.skinId || typeof data.skinId !== 'string') {
            shipSkinErrors.push('Invalid or missing skinId');
          } else if (data.skinId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
            shipSkinErrors.push('Skin ID too long');
          }

          if (!data.action || typeof data.action !== 'string' || !allowedSkinActions.includes(data.action)) {
            shipSkinErrors.push('Invalid action (must be equip, purchase, or purchase_and_equip)');
          }

          return {
            isValid: shipSkinErrors.length === 0,
            errors: shipSkinErrors,
            sanitizedData: {
              clientId: data.clientId,
              skinId: data.skinId,
              action: data.action
            }
          };

        case 'set_pet_nickname':
          const petNicknameErrors = [];
          const rawPetNickname = String(data.petNickname ?? '').trim();

          if (!data.clientId || typeof data.clientId !== 'string') {
            petNicknameErrors.push('Invalid or missing clientId');
          } else if (data.clientId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
            petNicknameErrors.push('Client ID too long');
          }

          if (!rawPetNickname) {
            petNicknameErrors.push('Invalid or missing petNickname');
          } else if (rawPetNickname.length > this.LIMITS.PET_NICKNAME.MAX_LENGTH) {
            petNicknameErrors.push(`petNickname too long (max ${this.LIMITS.PET_NICKNAME.MAX_LENGTH})`);
          }

          return {
            isValid: petNicknameErrors.length === 0,
            errors: petNicknameErrors,
            sanitizedData: {
              clientId: data.clientId,
              petNickname: rawPetNickname
            }
          };

        case 'craft_item':
          return this.validateCraftItem(data);

        case 'resource_collect':
          return this.validateResourceCollect(data);

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

        case 'quest_progress_update':
          // Valida aggiornamento progresso quest
          return this.validateQuestProgress(data);
        case 'quest_accept':
          return this.validateQuestAccept(data);
        case 'quest_abandon':
          return this.validateQuestAbandon(data);

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
   * Valida update progresso quest
   */
  validateQuestProgress(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      errors.push('Data must be an object');
      return { isValid: false, errors };
    }

    if (!data.questId || typeof data.questId !== 'string') {
      errors.push('Invalid or missing questId');
    } else if (data.questId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
      errors.push('Quest ID too long');
    }

    if (!Array.isArray(data.objectives)) {
      errors.push('objectives must be an array');
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      sanitizedData: {
        questId: data.questId,
        objectives: data.objectives
      }
    };
  }

  /**
   * Valida accettazione quest
   */
  validateQuestAccept(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      errors.push('Data must be an object');
      return { isValid: false, errors };
    }

    if (!data.questId || typeof data.questId !== 'string') {
      errors.push('Invalid or missing questId');
    } else if (data.questId.length > this.LIMITS.IDENTIFIERS.MAX_ID_LENGTH) {
      errors.push('Quest ID too long');
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      sanitizedData: {
        questId: data.questId
      }
    };
  }

  /**
   * Valida abbandono quest
   */
  validateQuestAbandon(data) {
    // Stessa logica di accept per ora (solo questId richiesto)
    return this.validateQuestAccept(data);
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
