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

      const positionBroadcast = {
        type: 'remote_player_update',
        clientId,
        position: {
          x: latestUpdate.x,
          y: latestUpdate.y,
          velocityX: latestUpdate.velocityX || 0,
          velocityY: latestUpdate.velocityY || 0
        },
        rotation: latestUpdate.rotation,
        tick: latestUpdate.tick,
        nickname: latestUpdate.nickname,
        playerId: latestUpdate.playerId
      };

      MapBroadcaster.broadcastToMap(players, positionBroadcast, clientId);
      positionUpdateQueue.delete(clientId);
    }
  }
}

module.exports = PositionUpdateProcessor;
