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
    const combatParticipantsByNpc = this.buildNpcCombatParticipantMap(npcManager);
    const emptyParticipants = this.EMPTY_PARTICIPANTS;

    for (const npc of allNpcs) {
      if (!Number.isFinite(npc.position.x) || !Number.isFinite(npc.position.y)) {
        continue;
      }

      const startX = npc.position.x;
      const startY = npc.position.y;
      const now = Date.now();
      const npcConfig = NPC_CONFIG[npc.type];
      const attackRange = npcConfig.stats.range;
      const speed = npcConfig.stats.speed;
      const combatParticipantIds = combatParticipantsByNpc.get(npc.id) || emptyParticipants;
      const hasCombatParticipants = combatParticipantIds.size > 0;

      // 🔍 OTTIMIZZAZIONE: Trova il player più vicino una sola volta per NPC
      let closestPlayer = null;
      let closestDistSq = Infinity;

      for (const [clientId, playerData] of players.entries()) {
        // During active combat, NPC movement/targeting should only consider players
        // who are currently fighting this NPC.
        if (hasCombatParticipants && !combatParticipantIds.has(clientId)) continue;

        if (!playerData.position || playerData.isDead) continue;

        // 🛡️ SAFE ZONE CHECK: NPC ignora i player nelle zone sicure per il tracking di base
        if (this.isInSafeZone(playerData.position)) continue;

        const dx = playerData.position.x - npc.position.x;
        const dy = playerData.position.y - npc.position.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < closestDistSq) {
          closestDistSq = distSq;
          closestPlayer = { id: clientId, data: playerData, distSq: distSq };
        }
      }

      // 🚀 ENGAGEMENT LOCK: Valida se il target attuale è ancora valido
      if (npc.lastAttackerId) {
        const targetPlayer = players.get(npc.lastAttackerId);
        const PURSUIT_RANGE = attackRange * 4;
        const pursuitRangeSq = PURSUIT_RANGE * PURSUIT_RANGE;
        let targetValid = false;

        if (targetPlayer && !targetPlayer.isDead && targetPlayer.position) {
          if (hasCombatParticipants) {
            targetValid = combatParticipantIds.has(npc.lastAttackerId);
          } else {
            // 🚀 RETALIATION logic: Permetti di mantenere il lock sull'aggressore anche in Safe Zone
            const dx = targetPlayer.position.x - npc.position.x;
            const dy = targetPlayer.position.y - npc.position.y;
            const distSq = dx * dx + dy * dy;

            if (distSq <= pursuitRangeSq) {
              targetValid = true;
            }
          }
        }

        if (!targetValid) npc.lastAttackerId = null;
      }

      // If this NPC has active combat participants but no valid lock target,
      // lock to the nearest valid participant candidate.
      if (!npc.lastAttackerId && hasCombatParticipants && closestPlayer) {
        npc.lastAttackerId = closestPlayer.id;
      }

      // Validazione velocità
      if (!Number.isFinite(npc.velocity.x) || !Number.isFinite(npc.velocity.y)) {
        const angle = Math.random() * Math.PI * 2;
        npc.velocity.x = Math.cos(angle) * speed * 0.3;
        npc.velocity.y = Math.sin(angle) * speed * 0.3;
      }

      // Determina comportamento e movimento
      const behavior = this.calculateBehavior(npc, now, closestPlayer, attackRange, npcConfig);
      npc.behavior = behavior;

      const movement = this.calculateMovement(npc, closestPlayer, players, speed, deltaTime, attackRange, behavior);

      // Calcola nuova posizione
      const newX = npc.position.x + movement.deltaX;
      const newY = npc.position.y + movement.deltaY;

      // Validazione e applicazione movimento
      if (this.validateAndApplyMovement(npc, newX, newY, movement.deltaX, movement.deltaY, speed, deltaTime, npcManager)) {
        const dxSignificant = npc.position.x - startX;
        const dySignificant = npc.position.y - startY;
        if ((dxSignificant * dxSignificant + dySignificant * dySignificant) > 25) {
          npc.lastSignificantMove = now;
        }
      }

      // Rotazione per stati non combattivi
      if (behavior === 'cruise' || behavior === 'idle') {
        if (npc.velocity.x !== 0 || npc.velocity.y !== 0) {
          npc.position.rotation = Math.atan2(npc.velocity.y, npc.velocity.x);
        }
      }

      npc.lastUpdate = now;
    }
  }

  /**
   * Calcola comportamento NPC
   */
  static calculateBehavior(npc, now, closestPlayer, attackRange, npcConfig) {
    const healthPercent = npc.maxHealth > 0 ? npc.health / npc.maxHealth : 1;

    // 1. Fuga se salute bassa
    if (healthPercent < 0.5) return 'flee';

    // 2. Aggressività per danno ricevuto (Combat Lock)
    if (npc.lastAttackerId) return 'aggressive';

    // 3. 🚀 PROACTIVE AGGRO: Aggressività per prossimità (Attack on Sight)
    const detectionRange = npcConfig.ai?.detectionRange || 0;
    if (detectionRange > 0 && closestPlayer && closestPlayer.distSq <= (detectionRange * detectionRange)) {
      // 🛡️ SAFE ZONE CHECK: Non attivare aggro se il player è in una zona sicura
      if (!this.isInSafeZone(closestPlayer.data.position)) {
        // Inizia a puntare il player che lo ha "triggerato"
        npc.lastAttackerId = closestPlayer.id;
        npc.lastDamage = now; // Simula un colpo per attivare la logica temporale esistente
        return 'aggressive';
      }
    }

    return 'cruise';
  }

  /**
   * Calcola movimento basato sul comportamento
   */
  static calculateMovement(npc, closestPlayer, players, speed, deltaTime, attackRange, behavior) {
    switch (behavior) {
      case 'aggressive':
        return this.applyAggressiveMovement(npc, players, speed, deltaTime, attackRange);
      case 'flee':
        return this.applyFleeMovement(npc, closestPlayer, speed, deltaTime, attackRange);
      case 'cruise':
        return this.applyCruiseMovement(npc, speed, deltaTime);
      default:
        return {
          deltaX: npc.velocity.x * (deltaTime / 1000),
          deltaY: npc.velocity.y * (deltaTime / 1000)
        };
    }
  }

  /**
   * Applica movimento aggressive (insegue e orbita)
   */
  static applyAggressiveMovement(npc, players, speed, deltaTime, attackRange) {
    const targetId = npc.lastAttackerId;
    const targetPlayer = players.get(targetId);

    if (!targetPlayer || !targetPlayer.position) {
      return this.applyCruiseMovement(npc, speed, deltaTime);
    }

    const dx = targetPlayer.position.x - npc.position.x;
    const dy = targetPlayer.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const dtSec = deltaTime / 1000;

    // NPC guarda sempre il target
    npc.position.rotation = Math.atan2(dy, dx);

    const OPTIMAL_DISTANCE = attackRange * 0.8;
    let moveDirX = 0;
    let moveDirY = 0;

    if (dist > OPTIMAL_DISTANCE + 50) {
      // Troppo lontano: avvicinati
      moveDirX = dx / dist;
      moveDirY = dy / dist;
    } else if (dist < OPTIMAL_DISTANCE - 50) {
      // Troppo vicino: allontanati (backpedal)
      moveDirX = -dx / dist;
      moveDirY = -dy / dist;
    }

    // 🚀 TACTICAL ORBITING (Strafing)
    // Se siamo nel range ottimale, aggiungiamo una spinta laterale (tangente)
    // Inizializza o inverti direzione orbita ogni tanto
    if (!npc._orbitDir || Math.random() < 0.01) {
      npc._orbitDir = Math.random() < 0.5 ? 1 : -1;
    }

    const tangentX = -dy / dist * npc._orbitDir;
    const tangentY = dx / dist * npc._orbitDir;

    // Mix del movimento: 70% verso/via dal player, 30% orbitale
    // Se siamo vicini all'ottimale, l'orbitale diventa prevalente (80%)
    const orbitWeight = (dist < OPTIMAL_DISTANCE + 100 && dist > OPTIMAL_DISTANCE - 100) ? 0.8 : 0.3;
    const finalDirX = moveDirX * (1 - orbitWeight) + tangentX * orbitWeight;
    const finalDirY = moveDirY * (1 - orbitWeight) + tangentY * orbitWeight;

    // Normalizza e applica velocità
    const finalLen = Math.sqrt(finalDirX * finalDirX + finalDirY * finalDirY) || 1;
    npc.velocity.x = (finalDirX / finalLen) * speed;
    npc.velocity.y = (finalDirY / finalLen) * speed;

    return {
      deltaX: npc.velocity.x * dtSec,
      deltaY: npc.velocity.y * dtSec
    };
  }

  /**
   * Applica movimento flee (fuga)
   */
  static applyFleeMovement(npc, closestPlayer, speed, deltaTime, attackRange) {
    if (!closestPlayer) return this.applyCruiseMovement(npc, speed, deltaTime);

    const dx = closestPlayer.data.position.x - npc.position.x;
    const dy = closestPlayer.data.position.y - npc.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    // Fuga: direzione opposta al player più vicino
    const fleeDx = -dx / dist;
    const fleeDy = -dy / dist;

    npc.velocity.x = fleeDx * speed;
    npc.velocity.y = fleeDy * speed;

    // Se il player è nel range, guarda lui per sparare mentre scappa
    if (dist <= attackRange) {
      npc.position.rotation = Math.atan2(dy, dx);
    } else {
      npc.position.rotation = Math.atan2(npc.velocity.y, npc.velocity.x);
    }

    return {
      deltaX: npc.velocity.x * (deltaTime / 1000),
      deltaY: npc.velocity.y * (deltaTime / 1000)
    };
  }

  /**
   * Applica movimento cruise (navigazione)
   */
  static applyCruiseMovement(npc, speed, deltaTime) {
    if (Math.abs(npc.velocity.x) < 0.1 && Math.abs(npc.velocity.y) < 0.1) {
      const angle = Math.random() * Math.PI * 2;
      const cruiseSpeed = speed * 0.5;
      npc.velocity.x = Math.cos(angle) * cruiseSpeed;
      npc.velocity.y = Math.sin(angle) * cruiseSpeed;
    }

    return {
      deltaX: npc.velocity.x * (deltaTime / 1000),
      deltaY: npc.velocity.y * (deltaTime / 1000)
    };
  }

  /**
   * Builds a map of NPC id -> player IDs currently fighting that NPC.
   * @param {Object} npcManager
   * @returns {Map<string, Set<string>>}
   */
  static buildNpcCombatParticipantMap(npcManager) {
    const participantsByNpc = new Map();
    const playerCombats = npcManager?.mapServer?.combatManager?.playerCombats;

    if (!playerCombats || typeof playerCombats.entries !== 'function') {
      return participantsByNpc;
    }

    for (const [playerId, combat] of playerCombats.entries()) {
      if (!combat || !combat.npcId) continue;

      let participantIds = participantsByNpc.get(combat.npcId);
      if (!participantIds) {
        participantIds = new Set();
        participantsByNpc.set(combat.npcId, participantIds);
      }

      participantIds.add(playerId);
    }

    return participantsByNpc;
  }

  /**
   * Valida e applica movimento con boundary collision
   */
  static validateAndApplyMovement(npc, newX, newY, deltaX, deltaY, speed, deltaTime, npcManager) {
    if (!Number.isFinite(newX) || !Number.isFinite(newY)) {
      npc.position.x = 0;
      npc.position.y = 0;
      return false;
    }

    const worldBounds = npcManager.getWorldBounds();

    if (newX >= worldBounds.WORLD_LEFT && newX <= worldBounds.WORLD_RIGHT) {
      npc.position.x = newX;
    } else {
      npc.velocity.x = -npc.velocity.x;
      npc.position.x = Math.max(worldBounds.WORLD_LEFT, Math.min(worldBounds.WORLD_RIGHT, newX));
    }

    if (newY >= worldBounds.WORLD_TOP && newY <= worldBounds.WORLD_BOTTOM) {
      npc.position.y = newY;
    } else {
      npc.velocity.y = -npc.velocity.y;
      npc.position.y = Math.max(worldBounds.WORLD_TOP, Math.min(worldBounds.WORLD_BOTTOM, newY));
    }

    return true;
  }

  /**
   * Verifica se una posizione si trova all'interno di una Safe Zone
   * @param {object} position - {x, y}
   * @returns {boolean}
   */
  static isInSafeZone(position) {
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return false;

    for (const zone of SERVER_CONSTANTS.SAFE_ZONES) {
      const dx = position.x - zone.x;
      const dy = position.y - zone.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= zone.radius * zone.radius) {
        return true;
      }
    }
    return false;
  }
}

NpcMovementSystem.EMPTY_PARTICIPANTS = new Set();

module.exports = NpcMovementSystem;
