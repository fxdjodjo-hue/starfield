/**
 * MapBroadcaster - Gestione broadcasting messaggi ai client
 * Responsabilità: Broadcasting efficiente con interest radius e filtering
 * Dipendenze: SERVER_CONSTANTS, WebSocket
 */

const { logger } = require('../../logger.cjs');
const ServerLoggerWrapper = require('../infrastructure/ServerLoggerWrapper.cjs');
const { SERVER_CONSTANTS } = require('../../config/constants.cjs');
const WebSocket = require('ws');

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
          ServerLoggerWrapper.error('NETWORK', `Error sending to ${clientId}: ${error.message}`);
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

    // OTTIMIZZAZIONE: Raggio aumentato a 5000 per coprire l'intera visuale del player
    const radius = 5000;
    const radiusSq = radius * radius;

    // Per ogni giocatore connesso, invia NPC nel suo raggio di interesse
    for (const [clientId, playerData] of players.entries()) {
      if (!playerData.position || playerData.ws.readyState !== WebSocket.OPEN) continue;

      // Filtra NPC entro il raggio
      const relevantNpcs = [];
      for (const npc of npcs) {
        const dx = npc.position.x - playerData.position.x;
        const dy = npc.position.y - playerData.position.y;
        if ((dx * dx + dy * dy) <= radiusSq) {
          // FORMATO COMPATTO: [id, type, x, y, rotation, hp, maxHp, sh, maxSh, behavior_char]
          // Questo riduce di ~60% la dimensione del JSON evitando le chiavi ripetute
          relevantNpcs.push([
            npc.id,
            npc.type, // Aggiunto per permettere auto-spawn sul client
            Math.round(npc.position.x),
            Math.round(npc.position.y),
            parseFloat(npc.position.rotation.toFixed(2)),
            Math.round(npc.health),
            Math.round(npc.maxHealth),
            Math.round(npc.shield),
            Math.round(npc.maxShield),
            npc.behavior ? npc.behavior[0] : 'c' // Solo l'iniziale del behavior (c=cruise, a=attack, ecc)
          ]);
        }
      }

      // 🔧 DEBUG NPC COUNTER: Invia sempre il messaggio anche se relevantNpcs è vuoto
      // per permettere al client di conoscere il totale nel mondo (wn)

      const message = {
        type: 'npc_bulk_update',
        n: relevantNpcs, // 'n' invece di 'npcs' per risparmiare byte
        wn: npcs.length, // 'wn' = world npcs count (totale in tutta la mappa)
        t: Date.now()    // 't' invece di 'timestamp'
      };

      playerData.ws.send(JSON.stringify(message));
    }
  }
}

module.exports = MapBroadcaster;
