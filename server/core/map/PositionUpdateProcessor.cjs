/**
 * PositionUpdateProcessor - Processamento queue aggiornamenti posizione player
 * Responsabilità: Processa queue posizioni e broadcasta aggiornamenti
 * Dipendenze: MapBroadcaster
 */

const MapBroadcaster = require('./MapBroadcaster.cjs');

class PositionUpdateProcessor {
  /**
   * Processa tutti gli aggiornamenti posizione in coda e li broadcasta
   * @param {Map} positionUpdateQueue - Map di clientId -> Array di aggiornamenti
   * @param {Map} players - Map di clientId -> playerData (per broadcasting)
   * @param {number} serverTick - Authoritative server tick from FixedLoop
   */
  static processUpdates(positionUpdateQueue, players, serverTick) {
    for (const [clientId, updates] of positionUpdateQueue) {
      if (updates.length === 0) continue;

      const latestUpdate = updates[updates.length - 1];
      const playerData = players.get(clientId);

      // Only broadcast if player still exists and is ALIVE
      // 🚀 FIX VISIBILITÀ: Se il player è morto, non broadcastare la posizione.
      // Questo impedisce che altri client "ricreino" l'entità morta tramite gli update di posizione periodici.
      if (!playerData || playerData.isDead) {
        positionUpdateQueue.delete(clientId);
        continue;
      }
      const isMigrating = !!playerData.isMigrating;

      const positionBroadcast = {
        type: 'remote_player_update',
        // FORMATO COMPATTO: [clientId, x, y, vx, vy, rotation, tick, nickname, rank, hp, maxHp, sh, maxSh]
        // Riduce drasticamente la dimensione del JSON evitando le chiavi per ogni giocatore
        p: [
          clientId,
          Math.round(latestUpdate.x * 100) / 100, // 2 decimal precision for smoother interpolation
          Math.round(latestUpdate.y * 100) / 100,
          Math.round((latestUpdate.velocityX || 0) * 100) / 100, // Preserve velocity precision
          Math.round((latestUpdate.velocityY || 0) * 100) / 100,
          parseFloat(latestUpdate.rotation.toFixed(3)),
          // PROTOCOL UPGRADE: Use authoritative server tick counter driven by FixedLoop
          // This ensures the tick perfectly matches the simulation step (MONOTONIC TIME)
          serverTick,
          // latestUpdate.tick, // Legacy: client-sent tick (not trusted/synced)
          latestUpdate.nickname,
          latestUpdate.rank,
          Math.round(playerData.health),
          Math.round(playerData.maxHealth),
          Math.round(playerData.shield),
          Math.round(playerData.maxShield)
        ],
        t: latestUpdate.clientTimestamp || Date.now()
      };

      // SECURITY: Anti-Speed Hack Validation
      // Recupera l'ultima posizione valida conosciuta per questo client
      const lastKnownPos = this.lastValidPositions?.get(clientId);

      // Valida il movimento se abbiamo uno storico
      if (lastKnownPos && !isMigrating) {
        // Usa timestamp del client se disponibile per maggiore precisione, altrimenti server time
        const currentTimestamp = latestUpdate.clientTimestamp || Date.now();
        const validationResult = global.inputValidator ? global.inputValidator.validateMovement(
          { x: latestUpdate.x, y: latestUpdate.y },
          lastKnownPos,
          currentTimestamp
        ) : { isValid: true }; // Fallback se validator non disponibile (es. test)

        if (!validationResult.isValid) {
          // Rifiuta l'aggiornamento
          // Opzionale: Loggare l'evento di sicurezza
          // console.warn(`SECURITY: Rejected movement for ${clientId}: ${validationResult.errors[0]}`);
          continue;
        }
      }

      // Aggiorna l'ultima posizione valida
      if (!this.lastValidPositions) this.lastValidPositions = new Map();
      this.lastValidPositions.set(clientId, {
        x: latestUpdate.x,
        y: latestUpdate.y,
        timestamp: latestUpdate.clientTimestamp || Date.now()
      });

      MapBroadcaster.broadcastToMap(players, positionBroadcast, clientId);
      positionUpdateQueue.delete(clientId);
    }
  }
}

module.exports = PositionUpdateProcessor;
