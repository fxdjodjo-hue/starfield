// MapServer - Contesto per ogni mappa del gioco
// Dipendenze consentite: logger.cjs, managers (npc, combat, projectile)

const { logger } = require('../logger.cjs');
const ServerLoggerWrapper = require('./infrastructure/ServerLoggerWrapper.cjs');
const ServerNpcManager = require('../managers/npc-manager.cjs');
const ServerCombatManager = require('../managers/combat-manager.cjs');
const ServerProjectileManager = require('../managers/projectile-manager.cjs');
const ServerQuestManager = require('../managers/quest-manager.cjs');
const NpcMovementSystem = require('./map/NpcMovementSystem.cjs');
const MapBroadcaster = require('./map/MapBroadcaster.cjs');
const PositionUpdateProcessor = require('./map/PositionUpdateProcessor.cjs');
const RepairManager = require('../managers/repair-manager.cjs');
const HazardManager = require('../managers/hazard-manager.cjs');
const MapResourceManager = require('../managers/resource/MapResourceManager.cjs');
const PetProgressionManager = require('../managers/pet/PetProgressionManager.cjs');
const PetModuleManager = require('../managers/pet/PetModuleManager.cjs');
const PetMovementManager = require('../managers/pet/PetMovementManager.cjs');
const GlobalGameMonitor = require('./debug/GlobalGameMonitor.cjs');
const BossEncounterManager = require('../events/boss/BossEncounterManager.cjs');

class MapServer {
  constructor(mapId, config = {}) {
    this.mapId = mapId;
    this.mapName = config.name || mapId;

    // Dimensioni mappa (configurabili per mappe diverse)
    this.WORLD_WIDTH = config.width || config.WORLD_WIDTH || 21000;
    this.WORLD_HEIGHT = config.height || config.WORLD_HEIGHT || 13100;

    // Managers specifici della mappa
    this.npcManager = new ServerNpcManager(this);
    this.projectileManager = new ServerProjectileManager(this);
    this.combatManager = new ServerCombatManager(this);
    this.repairManager = new RepairManager(this);
    this.hazardManager = new HazardManager(this);
    this.resourceManager = new MapResourceManager(this);
    this.petProgressionManager = new PetProgressionManager(this);
    this.petModuleManager = new PetModuleManager(this);
    this.petMovementManager = new PetMovementManager(this);
    this.questManager = new ServerQuestManager(this);
    this.bossEncounterManager = new BossEncounterManager(this);

    // Players connessi a questa mappa
    this.players = new Map();

    // Queue per aggiornamenti posizione per ridurre race conditions
    this.positionUpdateQueue = new Map(); // clientId -> Array di aggiornamenti

    // Configurazione NPC per questa mappa
    this.npcConfig = config.npcConfig || { scouterCount: 0, frigateCount: 0, guardCount: 0, pyramidCount: 1 };

    // Sistema di monitoraggio globale
    this.globalMonitor = new GlobalGameMonitor(this);

    // Setup hook per eventi critici
    this.setupGlobalMonitorHooks();

    // Logging periodico: 30s in DEV, 60s in PROD
    const logInterval = process.env.NODE_ENV === 'production' ? 60000 : 30000;
    setInterval(() => {
      if (this.globalMonitor.isEnabled) {
        this.globalMonitor.logGlobalSummary();
      }
    }, logInterval);
  }

  // Inizializzazione della mappa
  initialize() {
    ServerLoggerWrapper.system(`Initializing map ${this.mapId}...`);
    this.npcManager.initializeWorldNpcs(
      this.npcConfig.scouterCount ?? 0,
      this.npcConfig.frigateCount ?? 0,
      this.npcConfig.guardCount ?? 0,
      this.npcConfig.pyramidCount ?? 1
    );
    this.resourceManager.initializeResources();
  }

  // Gestione giocatori
  addPlayer(clientId, playerData) {
    playerData.currentMapId = this.mapId;
    this.players.set(clientId, playerData);
  }

  removePlayer(clientId) {
    this.players.delete(clientId);
    if (this.petModuleManager && typeof this.petModuleManager.removePlayer === 'function') {
      this.petModuleManager.removePlayer(clientId);
    }
    if (this.petMovementManager && typeof this.petMovementManager.removePlayer === 'function') {
      this.petMovementManager.removePlayer(clientId);
    }
    if (this.hazardManager) {
      this.hazardManager.removePlayer(clientId);
    }
  }

  // Metodi delegati ai managers
  getAllNpcs() { return this.npcManager.getAllNpcs(); }
  getNpc(npcId) { return this.npcManager.getNpc(npcId); }
  createNpc(type, x, y) { return this.npcManager.createNpc(type, x, y); }

  // Tick unificato per la mappa (20 Hz)
  tick() {
    try {
      // Incrementa counter per throttling
      this.tickCounter = (this.tickCounter || 0) + 1;
      const isThrottledTick = this.tickCounter % 2 === 0;
      const tickNow = Date.now();

      // 1. Movimento NPC (Sempre a 20 Hz per precisione fisica server)
      if (this.bossEncounterManager) {
        try {
          this.bossEncounterManager.update(tickNow);
        } catch (bossError) {
          ServerLoggerWrapper.error(
            'BOSS_EVENT',
            `Boss update failed in map ${this.mapId}: ${bossError.message}`
          );
          if (bossError && bossError.stack) {
            ServerLoggerWrapper.error('BOSS_EVENT', bossError.stack);
          }
        }
      }

      const allNpcs = this.npcManager.getAllNpcs();
      NpcMovementSystem.updateMovements(allNpcs, this.players, this.npcManager);

      // 2. Logica di combat NPC (Sempre a 20 Hz per precisione attacchi)
      if (this.combatManager) {
        this.combatManager.updateCombat();
      }

      // 3. Collisioni proiettili (Sempre a 20 Hz)
      this.projectileManager.checkCollisions();

      // 3.5. Aggiornamenti posizione proiettili homing
      this.projectileManager.broadcastHomingProjectileUpdates();

      // Recupere la lista AGGIORNATA dopo collisioni e combat
      const currentNpcs = this.npcManager.getAllNpcs();

      // 4. Broadcast aggiornamenti NPC significativi
      MapBroadcaster.broadcastNpcUpdates(this.players, currentNpcs);

      // 5. Processa moduli pet server-authoritative (raccolta/difesa)
      if (this.petModuleManager) {
        this.petModuleManager.update(tickNow);
      }

      // 5.1. Movimento/rotazione pet server-authoritative
      if (this.petMovementManager) {
        this.petMovementManager.update(tickNow);
      }

      // 5.2. Processa raccolta risorse server-authoritative
      if (this.resourceManager) {
        this.resourceManager.updateCollections(tickNow);
      }

      // 5.3. Processa aggiornamenti posizione giocatori (20Hz per massima fluidita)
      PositionUpdateProcessor.processUpdates(this.positionUpdateQueue, this.players, this.tickCounter);

      // 6. Processa riparazioni
      if (this.repairManager) {
        this.repairManager.updateRepairs(tickNow);
        this.repairManager.updateNpcRepairs(tickNow);
      }

      // 7. Processa hazard ambientali (radiazioni)
      if (this.hazardManager) {
        this.hazardManager.updateHazards(tickNow);
      }

    } catch (error) {
      ServerLoggerWrapper.error('MAP', `Error in tick for map ${this.mapId}: ${error.message}`);
      if (error && error.stack) {
        ServerLoggerWrapper.error('MAP', error.stack);
      }
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

  // Setup hook per eventi critici nel GlobalGameMonitor
  setupGlobalMonitorHooks() {
    // Hook morte player
    const originalHandlePlayerDeath = this.projectileManager.damageHandler.handlePlayerDeath;
    this.projectileManager.damageHandler.handlePlayerDeath = (clientId, killerId) => {
      const result = originalHandlePlayerDeath.call(this.projectileManager.damageHandler, clientId, killerId);
      this.globalMonitor.addCriticalEvent('PLAYER_DEATH', { clientId, killerId });
      return result;
    };

    // Hook ricompense NPC
    const originalAwardRewards = this.npcManager.rewardSystem.awardNpcKillRewards;
    this.npcManager.rewardSystem.awardNpcKillRewards = (playerId, npcType) => {
      const result = originalAwardRewards.call(this.npcManager.rewardSystem, playerId, npcType);
      this.globalMonitor.addCriticalEvent('NPC_KILL_REWARD', { playerId, npcType });
      return result;
    };
  }

  // Metodo per ottenere stato globale (per API esterna)
  getGlobalGameState() {
    return this.globalMonitor.getGlobalState();
  }

  // Comandi console utili per debug
  dumpGlobalState() {
    console.log('='.repeat(50));
    console.log('GLOBAL GAME STATE DUMP');
    console.log('='.repeat(50));
    console.log(JSON.stringify(this.getGlobalGameState(), null, 2));
  }

  monitorPlayer(clientId) {
    const state = this.globalMonitor.globalState.players.get(clientId);
    if (state) {
      console.log(`Monitoring ${clientId}:`, state);
    } else {
      console.log(`Player ${clientId} not found`);
    }
  }

  combatStats() {
    const combats = this.combatManager?.playerCombats || new Map();
    console.log(`Active combats: ${combats.size}`);
    for (const [playerId, combatData] of combats.entries()) {
      console.log(`  ${playerId}: vs ${combatData.targetId}`);
    }
  }
}

module.exports = MapServer;
