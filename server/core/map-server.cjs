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
const GlobalGameMonitor = require('./debug/GlobalGameMonitor.cjs');
const playerConfig = require('../../shared/player-config.json');

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
    this.combatManager = new ServerCombatManager(this);
    this.repairManager = new RepairManager(this);
    this.hazardManager = new HazardManager(this);
    this.questManager = new ServerQuestManager(this);

    // Players connessi a questa mappa
    this.players = new Map();

    // Queue per aggiornamenti posizione per ridurre race conditions
    this.positionUpdateQueue = new Map(); // clientId -> Array di aggiornamenti

    // Timestamp ultimo aggiornamento movimento player
    this.lastPlayerMovementUpdate = 0;

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
  }

  // Gestione giocatori
  addPlayer(clientId, playerData) {
    playerData.currentMapId = this.mapId;
    this.players.set(clientId, playerData);
  }

  removePlayer(clientId) {
    this.players.delete(clientId);
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

      // 0. Movimento player (server-authoritative input integration)
      this.updatePlayerMovements();

      // 1. Movimento NPC (Sempre a 20 Hz per precisione fisica server)
      const allNpcs = this.npcManager.getAllNpcs();
      NpcMovementSystem.updateMovements(
        allNpcs,
        this.players,
        this.npcManager,
        this.combatManager?.playerCombats
      );

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

      // 5. Processa aggiornamenti posizione giocatori (20Hz per massima fluidità)
      PositionUpdateProcessor.processUpdates(this.positionUpdateQueue, this.players, this.tickCounter);

      // 6. Processa riparazioni
      if (this.repairManager) {
        this.repairManager.updateRepairs(Date.now());
        this.repairManager.updateNpcRepairs(Date.now());
      }

      // 7. Processa hazard ambientali (radiazioni)
      if (this.hazardManager) {
        this.hazardManager.updateHazards(Date.now());
      }

    } catch (error) {
      ServerLoggerWrapper.error('MAP', `Error in tick for map ${this.mapId}: ${error.message}`);
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

  // Movimento player server-authoritative (usa input velocity dal client)
  updatePlayerMovements() {
    const now = Date.now();
    const lastUpdate = this.lastPlayerMovementUpdate || now;
    const deltaMs = Math.min(Math.max(now - lastUpdate, 0), 200); // Clamp per evitare salti eccessivi
    this.lastPlayerMovementUpdate = now;

    const dtSec = deltaMs / 1000;
    if (dtSec <= 0) return;

    const baseSpeed = playerConfig.stats.speed || 300;
    const worldLeft = -this.WORLD_WIDTH / 2;
    const worldRight = this.WORLD_WIDTH / 2;
    const worldTop = -this.WORLD_HEIGHT / 2;
    const worldBottom = this.WORLD_HEIGHT / 2;

    for (const [clientId, playerData] of this.players.entries()) {
      if (!playerData || playerData.isDead) continue;

      if (!playerData.position) {
        const fallbackX = Number.isFinite(playerData.x) ? playerData.x : 0;
        const fallbackY = Number.isFinite(playerData.y) ? playerData.y : 0;
        const fallbackRotation = Number.isFinite(playerData.rotation) ? playerData.rotation : 0;
        playerData.position = {
          x: fallbackX,
          y: fallbackY,
          rotation: fallbackRotation,
          velocityX: 0,
          velocityY: 0
        };
      }

      const input = playerData.movementInput;
      const inputAgeMs = input?.updatedAt ? (now - input.updatedAt) : Infinity;
      const inputStale = inputAgeMs > 250;

      let vx = 0;
      let vy = 0;
      let rotation = playerData.position.rotation ?? playerData.rotation ?? 0;

      if (input && !inputStale && !playerData.isMigrating) {
        vx = Number.isFinite(input.vx) ? input.vx : 0;
        vy = Number.isFinite(input.vy) ? input.vy : 0;
        if (Number.isFinite(input.rotation)) {
          rotation = input.rotation;
        }
      }

      const playerSpeedUpgrades = playerData.upgrades?.speedUpgrades || 0;
      const speedMultiplier = 1.0 + (playerSpeedUpgrades * 0.005);
      const actualMaxSpeed = baseSpeed * speedMultiplier;
      const speed = Math.sqrt(vx * vx + vy * vy);

      if (speed > actualMaxSpeed && speed > 0) {
        const scale = actualMaxSpeed / speed;
        vx *= scale;
        vy *= scale;
      }

      const newX = playerData.position.x + (vx * dtSec);
      const newY = playerData.position.y + (vy * dtSec);
      const clampedX = Math.max(worldLeft, Math.min(worldRight, newX));
      const clampedY = Math.max(worldTop, Math.min(worldBottom, newY));

      playerData.position = {
        x: clampedX,
        y: clampedY,
        rotation: rotation,
        velocityX: vx,
        velocityY: vy
      };

      // Sync top-level coordinates for safety/legacy compatibility
      playerData.x = clampedX;
      playerData.y = clampedY;
      playerData.rotation = rotation;
      playerData.velocityX = vx;
      playerData.velocityY = vy;
      playerData.lastMovementTime = now;

      // Server-authoritative coordinate/explore quests
      if (this.questManager) {
        this.questManager.onPlayerPositionUpdated(playerData, now).catch(err => {
          ServerLoggerWrapper.error('QUEST', `Error processing coordinate quests for ${playerData.nickname}: ${err.message}`);
        });
      }

      if (!this.positionUpdateQueue.has(clientId)) {
        this.positionUpdateQueue.set(clientId, []);
      }

      const clientQueue = this.positionUpdateQueue.get(clientId);
      clientQueue.push({
        x: clampedX,
        y: clampedY,
        rotation: rotation,
        velocityX: vx,
        velocityY: vy,
        tick: this.tickCounter,
        nickname: playerData.nickname,
        playerId: playerData.playerId,
        rank: playerData.rank,
        health: playerData.health,
        maxHealth: playerData.maxHealth,
        shield: playerData.shield,
        maxShield: playerData.maxShield,
        clientTimestamp: now,
        timestamp: now
      });

      if (clientQueue.length > 5) {
        clientQueue.shift();
      }
    }
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
