/**
 * NpcMovementSystem - Logica movimento e comportamenti NPC
 * Responsabilità: Movimento NPC con comportamenti (aggressive, flee, cruise), boundary collision
 * Dipendenze: NPC_CONFIG, SERVER_CONSTANTS, npcManager (per world bounds)
 */

const { SERVER_CONSTANTS, NPC_CONFIG } = require('../../config/constants.cjs');
const ServerLoggerWrapper = require('../infrastructure/ServerLoggerWrapper.cjs');

class NpcMovementSystem {
  /**
   * Aggiorna movimento per tutti gli NPC
   * @param {Array} allNpcs - Array di tutti gli NPC
   * @param {Map} players - Map di clientId -> playerData
   * @param {Object} npcManager - NpcManager per accedere ai world bounds
   */
  static updateMovements(allNpcs, players, npcManager) {
    const deltaTime = 1000 / 60; // Fixed timestep per fisica server

    for (const npc of allNpcs) {
      // Validazione posizione iniziale
      if (!Number.isFinite(npc.position.x) || !Number.isFinite(npc.position.y)) {
        ServerLoggerWrapper.warn('NPC', `NPC ${npc.id} has invalid initial position: (${npc.position.x}, ${npc.position.y}), skipping`);
        continue;
      }

      // Salva posizione iniziale per calcolare movimento significativo
      const startX = npc.position.x;
      const startY = npc.position.y;

      // Movimento semplice con velocity
      const speed = NPC_CONFIG[npc.type].stats.speed;

      // Validazione velocità: assicurati che siano finite
      if (!Number.isFinite(npc.velocity.x) || !Number.isFinite(npc.velocity.y)) {
        ServerLoggerWrapper.warn('NPC', `NPC ${npc.id} velocity became NaN, resetting with config-based speed`);
        // Reset con velocità basata sulla configurazione NPC invece di valori casuali fissi
        const resetSpeed = speed * 0.3; // 30% della velocità massima come fallback
        const angle = Math.random() * Math.PI * 2;
        npc.velocity.x = Math.cos(angle) * resetSpeed;
        npc.velocity.y = Math.sin(angle) * resetSpeed;
      }

      // Validazione parametri movimento
      if (!Number.isFinite(speed) || speed <= 0) {
        ServerLoggerWrapper.warn('NPC', `NPC ${npc.id} invalid speed: ${speed}`);
        continue; // Salta questo NPC
      }

      if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
        ServerLoggerWrapper.warn('NPC', `NPC ${npc.id} invalid deltaTime: ${deltaTime}`);
        continue; // Salta questo NPC
      }

      // Calcola comportamento e movimento
      const now = Date.now();
      const attackRange = NPC_CONFIG[npc.type].stats.range;
      const behavior = this.calculateBehavior(npc, now, players, attackRange);
      npc.behavior = behavior;

      // Calcola movimento basato sul comportamento
      const movement = this.calculateMovement(npc, players, speed, deltaTime, attackRange, behavior);
      const { deltaX, deltaY } = movement;

      // Calcola nuova posizione
      const newX = npc.position.x + deltaX;
      const newY = npc.position.y + deltaY;

      // Validazione e applicazione movimento
      if (!this.validateAndApplyMovement(npc, newX, newY, deltaX, deltaY, speed, deltaTime, npcManager)) {
        continue; // Salta questo NPC se validazione fallita
      }

      // Calcola movimento significativo (solo se spostamento > 5px)
      const dx = npc.position.x - startX;
      const dy = npc.position.y - startY;
      const distSq = dx * dx + dy * dy;

      if (distSq > 25) { // 5px threshold
        npc.lastSignificantMove = Date.now();
      }

      // Aggiorna rotazione dello sprite basandosi sulla velocity
      if (behavior === 'cruise' || behavior === 'idle') {
        if (npc.velocity.x !== 0 || npc.velocity.y !== 0) {
          npc.position.rotation = Math.atan2(npc.velocity.y, npc.velocity.x);
        }
      }

      npc.lastUpdate = Date.now();
    }
  }

  /**
   * Calcola comportamento NPC basato su salute, danno recente, e presenza player
   * @param {Object} npc - NPC da analizzare
   * @param {number} now - Timestamp corrente
   * @param {Map} players - Map di players
   * @param {number} attackRange - Range di attacco
   * @returns {string} Comportamento: 'flee', 'aggressive', o 'cruise'
   */
  static calculateBehavior(npc, now, players, attackRange) {
    // Calcola info su player nel range di attacco
    const attackRangeSq = attackRange * attackRange;
    let hasPlayerInRange = false;

    for (const [clientId, playerData] of players.entries()) {
      if (!playerData.position) continue;
      const dx = playerData.position.x - npc.position.x;
      const dy = playerData.position.y - npc.position.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq <= attackRangeSq) {
        hasPlayerInRange = true;
        break;
      }
    }

    // Traccia ultimo momento in cui aveva un player nel range
    if (hasPlayerInRange) {
      npc.lastPlayerInRange = now;
    }

    // Aggiorna comportamento NPC:
    // - flee: salute < 50%
    // - aggressive: danneggiato E player nel range esteso E non troppo tempo fa
    // - cruise: default
    const healthPercent = npc.maxHealth > 0 ? npc.health / npc.maxHealth : 1;
    const PURSUIT_RANGE = attackRange * 4; // Range di inseguimento esteso - aumentato per test
    const MAX_AGGRO_TIME = 30000; // 30 secondi max di aggressività
    const pursuitRangeSq = PURSUIT_RANGE * PURSUIT_RANGE;

    // Controlla se il player è ancora nel range di inseguimento
    let playerInPursuitRange = false;
    let withinTimeLimit = false;

    if (npc.lastDamage) { // Solo se è stato danneggiato almeno una volta
      // Controllo temporale: non rimanere aggressivo per sempre
      if ((now - npc.lastDamage) < MAX_AGGRO_TIME) {
        withinTimeLimit = true;

        // Controllo spaziale: player deve essere nel range
        for (const [clientId, playerData] of players.entries()) {
          if (!playerData.position) continue;
          const dx = playerData.position.x - npc.position.x;
          const dy = playerData.position.y - npc.position.y;
          const distanceSq = dx * dx + dy * dy;
          if (distanceSq <= pursuitRangeSq) {
            playerInPursuitRange = true;
            break;
          }
        }
      }
    }

    if (healthPercent < 0.5) {
      // Salute bassa: fuga
      return 'flee';
    } else if (npc.lastDamage && playerInPursuitRange) {
      // Danneggiato E player ancora nel range esteso: rimane aggressivo
      console.log(`[NPC ${npc.id}] Aggressive: lastDamage=${npc.lastDamage}, withinTimeLimit=${withinTimeLimit}, playerInPursuitRange=${playerInPursuitRange}`);
      return 'aggressive';
    } else {
      // Player troppo lontano o mai danneggiato: cruise
      if (npc.lastDamage) {
        console.log(`[NPC ${npc.id}] Cruise: lastDamage exists but playerInPursuitRange=${playerInPursuitRange}, withinTimeLimit=${withinTimeLimit}`);
      }
      return 'cruise';
    }
  }

  /**
   * Calcola movimento basato sul comportamento
   * @param {Object} npc - NPC
   * @param {Map} players - Map di players
   * @param {number} speed - Velocità NPC
   * @param {number} deltaTime - Delta time
   * @param {number} attackRange - Range di attacco
   * @param {string} behavior - Comportamento corrente
   * @returns {{deltaX: number, deltaY: number}}
   */
  static calculateMovement(npc, players, speed, deltaTime, attackRange, behavior) {
    let deltaX = 0;
    let deltaY = 0;

    switch (behavior) {
      case 'aggressive':
        return this.applyAggressiveMovement(npc, players, speed, deltaTime, attackRange);
      case 'flee':
        return this.applyFleeMovement(npc, players, speed, deltaTime, attackRange);
      case 'cruise':
        return this.applyCruiseMovement(npc, speed, deltaTime);
      default:
        // Default: usa velocity corrente se presente
        deltaX = npc.velocity.x * (deltaTime / 1000);
        deltaY = npc.velocity.y * (deltaTime / 1000);
        return { deltaX, deltaY };
    }
  }

  /**
   * Applica movimento aggressive (insegue player)
   */
  static applyAggressiveMovement(npc, players, speed, deltaTime, attackRange) {
    // Cerca sempre il player più vicino (anche se fuori dal range di attacco)
    let targetPlayerData = null;
    let targetPlayerPos = null;
    let closestDistSq = Infinity;

    for (const [clientId, playerData] of players.entries()) {
      if (!playerData || !playerData.position) continue;
      const dx = playerData.position.x - npc.position.x;
      const dy = playerData.position.y - npc.position.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < closestDistSq) {
        closestDistSq = distanceSq;
        targetPlayerData = playerData;
        targetPlayerPos = { x: playerData.position.x, y: playerData.position.y };
      }
    }

    // Se non trovato, prova con l'ultimo attacker noto
    if (!targetPlayerPos && npc.lastAttackerId) {
      const attackerData = players.get(npc.lastAttackerId);
      if (attackerData && attackerData.position) {
        targetPlayerData = attackerData;
        targetPlayerPos = { x: attackerData.position.x, y: attackerData.position.y };
      }
    }

    if (targetPlayerPos && targetPlayerData) {
      const dx = targetPlayerPos.x - npc.position.x;
      const dy = targetPlayerPos.y - npc.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // LOGICA MODERNA: NPC mantiene movimento fluido per combattimento dinamico
      const dtSec = deltaTime / 1000;
      const OPTIMAL_DISTANCE = attackRange * 0.9; // 90% del range di attacco

      let dirX, dirY, moveSpeed;

      if (dist > OPTIMAL_DISTANCE) {
        // Fuori range: avvicinati
        dirX = dx / dist;
        dirY = dy / dist;
        moveSpeed = speed * dtSec;
      } else {
        // Nel range: movimento fluido e semplice
        // Cambia direzione casualmente ogni tanto per movimento naturale
        if (Math.random() < 0.02) { // 2% probabilità ogni frame di cambiare direzione
          const angle = Math.random() * Math.PI * 2;
          npc.velocity.x = Math.cos(angle) * speed;
          npc.velocity.y = Math.sin(angle) * speed;
        }
        // Applica movimento con velocità originale
        const deltaX = npc.velocity.x * (deltaTime / 1000);
        const deltaY = npc.velocity.y * (deltaTime / 1000);

        // IMPORTANTE: Anche nel movimento casuale, NPC guarda sempre al player
        npc.position.rotation = Math.atan2(dy, dx);

        return { deltaX, deltaY };
      }

      // NPC in combattimento: sempre faccia al player (come player con NPC)
      npc.position.rotation = Math.atan2(dy, dx);

      // Aggiorna velocity
      npc.velocity.x = dirX * speed;
      npc.velocity.y = dirY * speed;

      return { deltaX: dirX * moveSpeed, deltaY: dirY * moveSpeed };
    } else {
      // Nessun player valido: comportamento cruise
      return this.applyCruiseMovement(npc, speed, deltaTime);
    }
  }

  /**
   * Applica movimento flee (fuga da player)
   */
  static applyFleeMovement(npc, players, speed, deltaTime, attackRange) {
    // Fuga: cerca sempre il player più vicino per decidere direzione e rotazione
    let closestPlayerPos = null;
    let closestDistSq = Infinity;

    for (const [clientId, playerData] of players.entries()) {
      if (!playerData.position) continue;
      const dx = playerData.position.x - npc.position.x;
      const dy = playerData.position.y - npc.position.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < closestDistSq) {
        closestDistSq = distanceSq;
        closestPlayerPos = { x: playerData.position.x, y: playerData.position.y };
      }
    }

    if (closestPlayerPos) {
      const dxToPlayer = closestPlayerPos.x - npc.position.x;
      const dyToPlayer = closestPlayerPos.y - npc.position.y;
      const distToPlayer = Math.sqrt(dxToPlayer * dxToPlayer + dyToPlayer * dyToPlayer) || 1;

      // Se velocity quasi nulla, imposta fuga opposta alla direzione player
      if (Math.abs(npc.velocity.x) < 0.1 && Math.abs(npc.velocity.y) < 0.1) {
        const fleeDx = -dxToPlayer;
        const fleeDy = -dyToPlayer;
        const fleeLen = Math.sqrt(fleeDx * fleeDx + fleeDy * fleeDy) || 1;
        // Usa velocità normale dal config (non modificata)
        npc.velocity.x = (fleeDx / fleeLen) * speed;
        npc.velocity.y = (fleeDy / fleeLen) * speed;
      }

      // Se il player è nel range di attacco, lo sprite guarda il player
      // Altrimenti guarda nella direzione di fuga (stesso sistema del player)
      if (distToPlayer <= attackRange) {
        npc.position.rotation = Math.atan2(dyToPlayer, dxToPlayer);
      } else {
        // Fuori range: guarda nella direzione di fuga (velocity)
        if (npc.velocity.x !== 0 || npc.velocity.y !== 0) {
          npc.position.rotation = Math.atan2(npc.velocity.y, npc.velocity.x);
        }
      }
    }

    const deltaX = npc.velocity.x * (deltaTime / 1000);
    const deltaY = npc.velocity.y * (deltaTime / 1000);
    return { deltaX, deltaY };
  }

  /**
   * Applica movimento cruise (movimento casuale)
   */
  static applyCruiseMovement(npc, speed, deltaTime) {
    // Cruise: se non hai una velocity significativa, assegna una direzione casuale
    if (Math.abs(npc.velocity.x) < 0.1 && Math.abs(npc.velocity.y) < 0.1) {
      const angle = Math.random() * Math.PI * 2;
      const cruiseSpeed = speed * 0.5;
      npc.velocity.x = Math.cos(angle) * cruiseSpeed;
      npc.velocity.y = Math.sin(angle) * cruiseSpeed;
    }

    const deltaX = npc.velocity.x * (deltaTime / 1000);
    const deltaY = npc.velocity.y * (deltaTime / 1000);
    return { deltaX, deltaY };
  }

  /**
   * Valida e applica movimento con boundary collision
   * @param {Object} npc - NPC
   * @param {number} newX - Nuova posizione X
   * @param {number} newY - Nuova posizione Y
   * @param {number} deltaX - Delta X
   * @param {number} deltaY - Delta Y
   * @param {number} speed - Velocità
   * @param {number} deltaTime - Delta time
   * @param {Object} npcManager - NpcManager per world bounds
   * @returns {boolean} True se movimento applicato con successo
   */
  static validateAndApplyMovement(npc, newX, newY, deltaX, deltaY, speed, deltaTime, npcManager) {
    // Validazione: assicurati che le posizioni siano finite
    if (!Number.isFinite(newX) || !Number.isFinite(newY)) {
      ServerLoggerWrapper.warn('NPC', `NPC ${npc.id} position became NaN! old_pos: (${npc.position.x}, ${npc.position.y}) delta: (${deltaX}, ${deltaY}) vel: (${npc.velocity.x}, ${npc.velocity.y}) speed: ${speed} deltaTime: ${deltaTime}`);
      ServerLoggerWrapper.warn('NPC', `Resetting NPC ${npc.id} to (0, 0) with config-based velocity`);
      npc.position.x = 0;
      npc.position.y = 0;
      // Reset con velocità basata sulla configurazione (30% della velocità normale)
      const baseSpeed = NPC_CONFIG[npc.type]?.stats?.speed || 300; // Fallback a 300 se config non disponibile
      const resetSpeed = baseSpeed * 0.3;
      const angle = Math.random() * Math.PI * 2;
      npc.velocity.x = Math.cos(angle) * resetSpeed;
      npc.velocity.y = Math.sin(angle) * resetSpeed;
      return false; // Salta l'aggiornamento per questo NPC
    }

    // Applica movimento e controlla confini
    const worldBounds = npcManager.getWorldBounds();
    
    if (newX >= worldBounds.WORLD_LEFT && newX <= worldBounds.WORLD_RIGHT) {
      npc.position.x = newX;
    } else {
      // Rimbalza sui confini X
      npc.velocity.x = -npc.velocity.x;
      npc.position.x = Math.max(worldBounds.WORLD_LEFT, Math.min(worldBounds.WORLD_RIGHT, newX));
    }

    if (newY >= worldBounds.WORLD_TOP && newY <= worldBounds.WORLD_BOTTOM) {
      npc.position.y = newY;
    } else {
      // Rimbalza sui confini Y
      npc.velocity.y = -npc.velocity.y;
      npc.position.y = Math.max(worldBounds.WORLD_TOP, Math.min(worldBounds.WORLD_BOTTOM, newY));
    }

    return true;
  }
}

module.exports = NpcMovementSystem;
