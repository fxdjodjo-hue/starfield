// server/core/debug/GlobalGameMonitor.cjs
// Sistema di monitoraggio globale aggregato per il mondo di gioco
// Fornisce visione completa di player, NPC aggressivi, risorse ed eventi critici

const { logger } = require('../../logger.cjs');
const { NPC_CONFIG } = require('../../config/constants.cjs');

class GlobalGameMonitor {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.lastUpdate = 0;
    this.updateInterval = 2000; // Aggiorna ogni 2 secondi
    this.isEnabled = process.env.GLOBAL_MONITOR === 'true';
    this.startTime = Date.now(); // Tempo di avvio del monitor

    this.globalState = {
      timestamp: Date.now(),
      server: {
        uptime: 0,
        totalPlayers: 0,
        totalNpcs: 0,
        activeCombats: 0
      },
      players: new Map(), // clientId -> player data aggregata
      aggressiveNpcs: new Map(), // npcId -> npc data
      criticalEvents: [], // Eventi critici degli ultimi 60 secondi
      resourceSummary: {
        totalCredits: 0,
        totalCosmos: 0,
        activeRepairs: 0,
        playersInCombat: 0
      },
      performance: {
        avgTickTime: 0,
        memoryUsage: 0,
        networkLatency: 0
      }
    };

    if (this.isEnabled) {
      this.startMonitoring();
      logger.info('GLOBAL_MONITOR', '🎯 Global Game Monitor started');
    }
  }

  startMonitoring() {
    setInterval(() => this.updateGlobalState(), this.updateInterval);
  }

  updateGlobalState() {
    const now = Date.now();
    this.lastUpdate = now;

    // Aggiorna dati server
    this.updateServerStats();

    // Aggiorna tutti i player
    this.updateAllPlayers();

    // Aggiorna NPC aggressivi
    this.updateAggressiveNpcs();

    // Aggiorna riepilogo risorse
    this.updateResourceSummary();

    // Pulisci eventi critici vecchi
    this.cleanupOldEvents();

    // Aggiorna timestamp
    this.globalState.timestamp = now;
  }

  updateServerStats() {
    this.globalState.server = {
      uptime: Date.now() - this.startTime,
      totalPlayers: this.mapServer.players.size,
      totalNpcs: this.mapServer.npcManager?.npcs.size || 0,
      activeCombats: this.mapServer.combatManager?.playerCombats.size || 0
    };
  }

  updateAllPlayers() {
    this.globalState.players.clear();

    for (const [clientId, playerData] of this.mapServer.players.entries()) {
      const playerSummary = {
        id: clientId,
        userId: playerData.userId,
        nickname: playerData.nickname,
        position: {
          x: Math.round(playerData.position?.x || 0),
          y: Math.round(playerData.position?.y || 0)
        },
        vitals: {
          health: playerData.health,
          maxHealth: playerData.maxHealth,
          shield: playerData.shield,
          maxShield: playerData.maxShield,
          isDead: playerData.isDead,
          lastDamage: playerData.lastDamage,
          repairing: this.isPlayerRepairing(clientId)
        },
        stats: {
          kills: playerData.stats?.kills || 0,
          deaths: playerData.stats?.deaths || 0,
          missionsCompleted: playerData.stats?.missionsCompleted || 0,
          playTime: playerData.stats?.playTime || 0
        },
        economy: {
          credits: playerData.inventory?.credits || 0,
          cosmos: playerData.inventory?.cosmos || 0,
          experience: playerData.inventory?.experience || 0,
          honor: playerData.inventory?.honor || 0
        },
        combat: {
          inCombat: this.mapServer.combatManager?.playerCombats.has(clientId) || false,
          lastAttacker: playerData.lastAttackerId,
          nearbyThreats: this.getNearbyThreats(clientId)
        },
        status: this.getPlayerStatus(playerData)
      };

      this.globalState.players.set(clientId, playerSummary);
    }
  }

  updateAggressiveNpcs() {
    this.globalState.aggressiveNpcs.clear();

    for (const [npcId, npc] of (this.mapServer.npcManager?.npcs.entries() || [])) {
      if (npc.behavior === 'aggressive') {
        const npcSummary = {
          id: npcId,
          type: npc.type,
          position: {
            x: Math.round(npc.position.x),
            y: Math.round(npc.position.y)
          },
          vitals: {
            health: npc.health,
            maxHealth: npc.maxHealth,
            shield: npc.shield,
            maxShield: npc.maxShield
          },
          combat: {
            lastDamage: npc.lastDamage,
            lastAttacker: npc.lastAttackerId,
            targetPlayer: this.getNpcTargetPlayer(npcId)
          },
          status: {
            behavior: npc.behavior,
            speed: NPC_CONFIG[npc.type]?.stats?.speed || 400,
            damage: NPC_CONFIG[npc.type]?.stats?.damage || 2000
          }
        };

        this.globalState.aggressiveNpcs.set(npcId, npcSummary);
      }
    }
  }

  updateResourceSummary() {
    let totalCredits = 0;
    let totalCosmos = 0;
    let activeRepairs = 0;
    let playersInCombat = 0;

    for (const [clientId, playerData] of this.mapServer.players.entries()) {
      totalCredits += playerData.inventory?.credits || 0;
      totalCosmos += playerData.inventory?.cosmos || 0;

      if (this.isPlayerRepairing(clientId)) {
        activeRepairs++;
      }

      if (this.mapServer.combatManager?.playerCombats.has(clientId)) {
        playersInCombat++;
      }
    }

    this.globalState.resourceSummary = {
      totalCredits,
      totalCosmos,
      activeRepairs,
      playersInCombat
    };
  }

  // Metodi di utilità
  isPlayerRepairing(clientId) {
    const repairManager = this.mapServer.repairManager;
    if (!repairManager?.playerRepairStates) return false;

    const repairState = repairManager.playerRepairStates.get(clientId);
    return repairState?.isRepairing || false;
  }

  getNearbyThreats(clientId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData?.position) return [];

    const threats = [];
    const THREAT_RANGE = 600;

    for (const [npcId, npc] of (this.mapServer.npcManager?.npcs.entries() || [])) {
      if (npc.behavior === 'aggressive' || npc.lastAttackerId === clientId) {
        const distance = Math.sqrt(
          Math.pow(npc.position.x - playerData.position.x, 2) +
          Math.pow(npc.position.y - playerData.position.y, 2)
        );

        if (distance <= THREAT_RANGE) {
          threats.push({
            id: npcId,
            type: npc.type,
            distance: Math.round(distance),
            behavior: npc.behavior
          });
        }
      }
    }

    return threats;
  }

  getNpcTargetPlayer(npcId) {
    // Trova quale player questo NPC sta inseguendo
    for (const [clientId, playerData] of this.mapServer.players.entries()) {
      if (!playerData?.position) continue;

      const npc = this.mapServer.npcManager?.npcs.get(npcId);
      if (!npc) continue;

      // Calcola se il player è nel range di attacco dell'NPC
      const attackRange = NPC_CONFIG[npc.type]?.stats?.range || 800;
      const distance = Math.sqrt(
        Math.pow(npc.position.x - playerData.position.x, 2) +
        Math.pow(npc.position.y - playerData.position.y, 2)
      );

      if (distance <= attackRange && npc.behavior === 'aggressive') {
        return {
          id: clientId,
          nickname: playerData.nickname,
          distance: Math.round(distance)
        };
      }
    }

    return null;
  }

  getPlayerStatus(playerData) {
    const warnings = [];

    if (playerData.isDead) {
      warnings.push('DEAD');
    }

    if (playerData.health <= playerData.maxHealth * 0.2) {
      warnings.push('LOW_HEALTH');
    }

    if (playerData.shield <= playerData.maxShield * 0.2) {
      warnings.push('LOW_SHIELD');
    }

    if (playerData.inventory?.credits < 0 || playerData.inventory?.cosmos < 0) {
      warnings.push('NEGATIVE_CURRENCY');
    }

    return {
      connected: playerData.connected,
      warnings: warnings
    };
  }

  cleanupOldEvents() {
    const cutoffTime = Date.now() - 60000; // 60 secondi
    this.globalState.criticalEvents = this.globalState.criticalEvents.filter(
      event => event.timestamp > cutoffTime
    );
  }

  // Metodo per aggiungere eventi critici
  addCriticalEvent(eventType, eventData) {
    this.globalState.criticalEvents.push({
      timestamp: Date.now(),
      type: eventType,
      data: eventData
    });

    // Mantieni solo gli ultimi 100 eventi
    if (this.globalState.criticalEvents.length > 100) {
      this.globalState.criticalEvents.shift();
    }
  }

  // Metodo per ottenere lo stato globale (per API o logging)
  getGlobalState() {
    return {
      ...this.globalState,
      players: Array.from(this.globalState.players.values()),
      aggressiveNpcs: Array.from(this.globalState.aggressiveNpcs.values())
    };
  }

  // Metodo per logging periodico
  logGlobalSummary() {
    const state = this.getGlobalState();

    console.log(`🌍 GLOBAL STATE [${new Date().toISOString()}]`);
    console.log(`   Server: ${state.server.totalPlayers} players, ${state.server.totalNpcs} NPCs, ${state.server.activeCombats} combats`);
    console.log(`   Resources: ${state.resourceSummary.totalCredits} credits, ${state.resourceSummary.totalCosmos} cosmos`);
    console.log(`   Activity: ${state.resourceSummary.activeRepairs} repairing, ${state.resourceSummary.playersInCombat} in combat`);

    // Log player critici
    const criticalPlayers = Array.from(state.players).filter(p => p.status.warnings.length > 0);
    if (criticalPlayers.length > 0) {
      console.log(`   ⚠️ Critical Players: ${criticalPlayers.map(p => `${p.nickname}(${p.status.warnings.join(',')})`).join(', ')}`);
    }

    // Log eventi recenti
    if (state.criticalEvents.length > 0) {
      console.log(`   📋 Recent Events: ${state.criticalEvents.slice(-3).map(e => e.type).join(', ')}`);
    }
  }
}

module.exports = GlobalGameMonitor;