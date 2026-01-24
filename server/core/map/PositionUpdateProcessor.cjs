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
        playerId: latestUpdate.playerId,
        rank: latestUpdate.rank,
        // 🚀 FIX: Usa i valori LIVE dall'oggetto player, NON quelli salvati nella queue.
        // Gli update di posizione arrivano a 20 FPS e salvano gli HP in quel momento.
        // Se una riparazione avviene tra un frame GPS e l'altro, i valori nella queue diventano "stale" (vecchi).
        // Usando playerData.health garantiamo di inviare sempre l'ultimo valore autorevole del server.
        health: playerData.health,
        maxHealth: playerData.maxHealth,
        shield: playerData.shield,
        maxShield: playerData.maxShield
      };

      MapBroadcaster.broadcastToMap(players, positionBroadcast, clientId);
      positionUpdateQueue.delete(clientId);
    }
  }
}

module.exports = PositionUpdateProcessor;
