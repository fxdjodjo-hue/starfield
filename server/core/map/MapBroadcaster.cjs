/**
 * MapBroadcaster - Gestione broadcasting messaggi ai client
 * Responsabilità: Broadcasting efficiente con interest radius e filtering
 * Dipendenze: SERVER_CONSTANTS, WebSocket
 */

const { logger } = require('../../logger.cjs');
const { SERVER_CONSTANTS } = require('../../config/constants.cjs');

class MapBroadcaster {
  /**
   * Broadcast messaggio a tutti i client connessi alla mappa
   * @param {Map} players - Map di clientId -> playerData
   * @param {Object} message - Messaggio da inviare
   * @param {string|null} excludeClientId - Client da escludere (opzionale)
   * @returns {{sent: number, excluded: number, closed: number}}
   */
  static broadcastToMap(players, message, excludeClientId = null) {
    const payload = JSON.stringify(message);
    let sentCount = 0;
    let excludedCount = 0;
    let closedCount = 0;

    for (const [clientId, playerData] of players.entries()) {
      if (excludeClientId && clientId === excludeClientId) {
        excludedCount++;
        continue;
      }

      if (playerData.ws.readyState === WebSocket.OPEN) {
        try {
          playerData.ws.send(payload);
          sentCount++;
        } catch (error) {
          console.error(`[MapBroadcaster] Error sending to ${clientId}:`, error);
        }
      } else {
        closedCount++;
      }
    }

    // Log speciale per chat messages
    if (message.type === 'chat_message') {
      logger.info('MAP', `Chat broadcast: sent=${sentCount}, excluded=${excludedCount}, closed=${closedCount}, total=${players.size}`);
    }

    return { sent: sentCount, excluded: excludedCount, closed: closedCount };
  }

  /**
   * Broadcast messaggio solo ai client entro un raggio specifico
   * @param {Map} players - Map di clientId -> playerData
   * @param {Object} position - Posizione centrale {x, y}
   * @param {number} radius - Raggio di interesse
   * @param {Object} message - Messaggio da inviare
   * @param {string|null} excludeClientId - Client da escludere (opzionale)
   */
  static broadcastNear(players, position, radius, message, excludeClientId = null) {
    const payload = JSON.stringify(message);
    const radiusSq = radius * radius; // Evita sqrt per performance

    for (const [clientId, playerData] of players.entries()) {
      if (excludeClientId && clientId === excludeClientId) continue;
      if (!playerData.position || playerData.ws.readyState !== WebSocket.OPEN) continue;

      // Calcola distanza quadrata
      const dx = playerData.position.x - position.x;
      const dy = playerData.position.y - position.y;
      const distSq = dx * dx + dy * dy;

      // Invia solo se entro il raggio
      if (distSq <= radiusSq) {
        playerData.ws.send(payload);
      }
    }
  }

  /**
   * Broadcast aggiornamenti NPC a tutti i client nel raggio di interesse
   * @param {Map} players - Map di clientId -> playerData
   * @param {Array} npcs - Array di NPC da inviare
   */
  static broadcastNpcUpdates(players, npcs) {
    if (npcs.length === 0) return;

    const radius = SERVER_CONSTANTS.NETWORK.WORLD_RADIUS; // Raggio del mondo
    const radiusSq = radius * radius;

    // Per ogni giocatore connesso, invia NPC nel suo raggio di interesse ampio
    for (const [clientId, playerData] of players.entries()) {
      if (!playerData.position || playerData.ws.readyState !== WebSocket.OPEN) continue;

      // Filtra NPC entro il raggio ampio
      const relevantNpcs = npcs.filter(npc => {
        const dx = npc.position.x - playerData.position.x;
        const dy = npc.position.y - playerData.position.y;
        return (dx * dx + dy * dy) <= radiusSq;
      });

      if (relevantNpcs.length === 0) continue;

      const message = {
        type: 'npc_bulk_update',
        npcs: relevantNpcs.map(npc => ({
          id: npc.id,
          position: npc.position,
          health: { current: npc.health, max: npc.maxHealth },
          shield: { current: npc.shield, max: npc.maxShield },
          behavior: npc.behavior
        })),
        timestamp: Date.now()
      };

      playerData.ws.send(JSON.stringify(message));
    }
  }
}

module.exports = MapBroadcaster;
