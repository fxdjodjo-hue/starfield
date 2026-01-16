// MapServer - Contesto per ogni mappa del gioco
// Dipendenze consentite: logger.cjs, managers (npc, combat, projectile)

const { logger } = require('../logger.cjs');
const ServerNpcManager = require('../managers/npc-manager.cjs');
const ServerCombatManager = require('../managers/combat-manager.cjs');
const ServerProjectileManager = require('../managers/projectile-manager.cjs');
const NpcMovementSystem = require('./map/NpcMovementSystem.cjs');
const MapBroadcaster = require('./map/MapBroadcaster.cjs');
const PositionUpdateProcessor = require('./map/PositionUpdateProcessor.cjs');

class MapServer {
  constructor(mapId, config = {}) {
    this.mapId = mapId;

    // Dimensioni mappa (configurabili per mappe diverse)
    this.WORLD_WIDTH = config.WORLD_WIDTH || 21000;
    this.WORLD_HEIGHT = config.WORLD_HEIGHT || 13100;

    // Managers specifici della mappa
    this.npcManager = new ServerNpcManager(this);
    this.projectileManager = new ServerProjectileManager(this);

    // Players connessi a questa mappa
    this.players = new Map();

    // Queue per aggiornamenti posizione per ridurre race conditions
    this.positionUpdateQueue = new Map(); // clientId -> Array di aggiornamenti

    // Configurazione NPC per questa mappa
    this.npcConfig = config.npcConfig || { scouterCount: 25, frigateCount: 25 };
  }

  // Inizializzazione della mappa
  initialize() {
    logger.info('MAP', `Initializing map ${this.mapId}...`);
    this.npcManager.initializeWorldNpcs(
      this.npcConfig.scouterCount,
      this.npcConfig.frigateCount
    );
  }

  // Gestione giocatori
  addPlayer(clientId, playerData) {
    this.players.set(clientId, playerData);
    logger.info('MAP', `Player ${clientId} joined map ${this.mapId}`);
  }

  removePlayer(clientId) {
    this.players.delete(clientId);
    logger.info('MAP', `Player ${clientId} left map ${this.mapId}`);
  }

  // Metodi delegati ai managers
  getAllNpcs() { return this.npcManager.getAllNpcs(); }
  getNpc(npcId) { return this.npcManager.getNpc(npcId); }
  createNpc(type, x, y) { return this.npcManager.createNpc(type, x, y); }

  // Tick unificato per la mappa (20 Hz)
  tick() {
    try {
      // 1. Movimento NPC
      const allNpcs = this.npcManager.getAllNpcs();
      NpcMovementSystem.updateMovements(allNpcs, this.players, this.npcManager);

      // 2. Logica di combat NPC (attacchi automatici)
      if (this.combatManager) {
        this.combatManager.updateCombat();
      }

      // 3. Collisioni proiettili
      this.projectileManager.checkCollisions();

      // 3.5. Aggiornamenti posizione proiettili homing
      this.projectileManager.broadcastHomingProjectileUpdates();

      // 4. Broadcast aggiornamenti NPC significativi
      MapBroadcaster.broadcastNpcUpdates(this.players, allNpcs);

      // 5. Processa aggiornamenti posizione giocatori
      PositionUpdateProcessor.processUpdates(this.positionUpdateQueue, this.players);

      // 6. Processa riparazioni player
      if (this.repairManager) {
        this.repairManager.updateRepairs(Date.now());
      }

    } catch (error) {
      console.error(`❌ [MapServer:${this.mapId}] Error in tick:`, error);
    }
  }

  // Broadcasting specifico della mappa (delegato a MapBroadcaster)
  broadcastToMap(message, excludeClientId = null) {
    return MapBroadcaster.broadcastToMap(this.players, message, excludeClientId);
  }

  // Broadcasting con interest radius (delegato a MapBroadcaster)
  broadcastNear(position, radius, message, excludeClientId = null) {
    MapBroadcaster.broadcastNear(this.players, position, radius, message, excludeClientId);
  }

  // Broadcast aggiornamenti NPC (delegato a MapBroadcaster)
  broadcastNpcUpdates() {
    const npcs = this.npcManager.getAllNpcs();
    MapBroadcaster.broadcastNpcUpdates(this.players, npcs);
  }

  // Processa aggiornamenti posizione giocatori (delegato a PositionUpdateProcessor)
  processPositionUpdates() {
    PositionUpdateProcessor.processUpdates(this.positionUpdateQueue, this.players);
  }
}

module.exports = MapServer;
