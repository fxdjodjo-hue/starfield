// NpcBroadcaster - Broadcasting eventi NPC
// Responsabilità: Broadcast spawn, morte e update NPC
// Dipendenze: mapServer.broadcastNear, npcs Map

class NpcBroadcaster {
  constructor(mapServer, npcs) {
    this.mapServer = mapServer;
    this.npcs = npcs;
  }

  /**
   * Broadcast la creazione di un nuovo NPC a tutti i client
   * @param {string} npcId - ID dell'NPC
   */
  broadcastNpcSpawn(npcId) {
    const npc = this.npcs.get(npcId);
    if (!npc) return;

    const message = {
      type: 'npc_spawn',
      npc: {
        id: npc.id,
        type: npc.type,
        position: npc.position,
        health: { current: npc.health, max: npc.maxHealth },
        shield: { current: npc.shield, max: npc.maxShield },
        behavior: npc.behavior
      }
    };

    // Broadcast GLOBALE per spawn NPC (minimappa globale richiede aggiornamenti globali)
    this.mapServer.broadcastNear(npc.position, 50000, message);
  }
}

module.exports = NpcBroadcaster;
