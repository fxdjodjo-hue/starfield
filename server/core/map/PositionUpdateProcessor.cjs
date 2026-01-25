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
   */
  static processUpdates(positionUpdateQueue, players) {
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

      const positionBroadcast = {
        type: 'remote_player_update',
        // FORMATO COMPATTO: [clientId, x, y, vx, vy, rotation, tick, nickname, rank, hp, maxHp, sh, maxSh]
        // Riduce drasticamente la dimensione del JSON evitando le chiavi per ogni giocatore
        p: [
          clientId,
          Math.round(latestUpdate.x),
          Math.round(latestUpdate.y),
          Math.round(latestUpdate.velocityX || 0),
          Math.round(latestUpdate.velocityY || 0),
          parseFloat(latestUpdate.rotation.toFixed(2)),
          latestUpdate.tick,
          latestUpdate.nickname,
          latestUpdate.rank,
          Math.round(playerData.health),
          Math.round(playerData.maxHealth),
          Math.round(playerData.shield),
          Math.round(playerData.maxShield)
        ]
      };

      MapBroadcaster.broadcastToMap(players, positionBroadcast, clientId);
      positionUpdateQueue.delete(clientId);
    }
  }
}

module.exports = PositionUpdateProcessor;
