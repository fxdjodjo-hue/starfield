// RepairManager - Gestione riparazione server-authoritative per player
// Dipendenze consentite: logger.cjs, config/constants.cjs

const { logger } = require('../logger.cjs');
const ServerLoggerWrapper = require('../core/infrastructure/ServerLoggerWrapper.cjs');
const { SERVER_CONSTANTS } = require('../config/constants.cjs');

class RepairManager {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.playerRepairStates = new Map(); // playerId -> { repairStartTime, isRepairing, lastRepairTime, lastCombatEndTime }
    this.playerCombatEndTimes = new Map(); // playerId -> timestamp quando è uscito dal combattimento
    this.npcRepairStates = new Map(); // npcId -> { repairStartTime, isRepairing, lastRepairTime, lastDamage }
  }

  /**
   * Aggiorna logica di riparazione per tutti i player
   */
  updateRepairs(now) {
    for (const [playerId, playerData] of this.mapServer.players.entries()) {
      if (playerData.isDead) continue;

      this.processPlayerRepair(playerId, playerData, now);
    }
  }

  /**
   * Processa riparazione per un singolo player
   */
  processPlayerRepair(playerId, playerData, now) {
    // 🚫 BLOCCA auto-repair finché il player non è fully loaded
    // Questo previene interferenze con la persistenza HP in MMO
    if (!playerData.isFullyLoaded) {
      return;
    }

    const isInCombat = this.mapServer.combatManager?.playerCombats.has(playerId) || false;
    const timeSinceLastDamage = playerData.lastDamage ? (now - playerData.lastDamage) : Infinity;
    const timeSinceJoin = playerData.joinTime ? (now - playerData.joinTime) : Infinity;
    const REPAIR_START_DELAY = SERVER_CONSTANTS.REPAIR.START_DELAY;
    const REPAIR_PERCENT = SERVER_CONSTANTS.REPAIR.PERCENT;
    const REPAIR_INTERVAL = SERVER_CONSTANTS.REPAIR.INTERVAL;

    let repairState = this.playerRepairStates.get(playerId);

    // Se è in combattimento (sta attaccando), ferma riparazione
    if (isInCombat) {
      if (repairState?.isRepairing) {
        this.stopRepair(playerId);
      }
      // Rimuovi il timestamp di fine combattimento (è ancora in combattimento)
      this.playerCombatEndTimes.delete(playerId);
      return;
    }

    // 🚀 FIX ROBUSTO: Se ha ricevuto danno recentemente, blocca la riparazione
    // Questo gestisce il caso in cui un NPC ti attacca ma tu non rispondi al fuoco
    if (timeSinceLastDamage < REPAIR_START_DELAY) {
      if (repairState?.isRepairing) {
        this.stopRepair(playerId);
      }
      return;
    }

    // Calcola tempo dalla fine dell'ultimo combattimento (quando il player ha smesso di sparare)
    const lastCombatEndTime = this.playerCombatEndTimes.get(playerId);
    const timeSinceLastCombatEnd = lastCombatEndTime ? (now - lastCombatEndTime) : Infinity;

    // Se è uscito dal combattimento recentemente, aspetta prima di riparare
    if (timeSinceLastCombatEnd < REPAIR_START_DELAY) {
      if (repairState?.isRepairing) {
        this.stopRepair(playerId);
      }
      return;
    }

    // Se la riparazione è stata completata, controlla se ha di nuovo bisogno di riparazione
    if (repairState?.completed) {
      const stillNeedsRepair = playerData.health < playerData.maxHealth ||
        playerData.shield < playerData.maxShield;
      if (!stillNeedsRepair) {
        return; // Tutto ancora a posto, non ricominciare
      }
      // Ha di nuovo bisogno di riparazione - resetta il flag completed
      repairState.completed = false;
      this.playerRepairStates.set(playerId, repairState);
    }

    // Se non sta riparando e può riparare, inizia
    if (!repairState?.isRepairing) {
      const needsRepair = playerData.health < playerData.maxHealth ||
        playerData.shield < playerData.maxShield;

      // Non iniziare riparazione automatica nei primi 5 secondi dopo il join
      const JOIN_DELAY = 5000; // 5 secondi
      const canStartRepair = needsRepair && timeSinceJoin >= JOIN_DELAY;

      if (canStartRepair) {
        this.startRepair(playerId, now);
      }
      return;
    }

    // Sta riparando - applica riparazione incrementale ogni 2 secondi
    if (repairState.isRepairing) {
      const lastRepairTime = repairState.lastRepairTime || repairState.repairStartTime;

      // Applica riparazione ogni 2 secondi
      if (now - lastRepairTime >= REPAIR_INTERVAL) {
        this.applyRepair(playerId, playerData, REPAIR_PERCENT, now);
        // Dopo applyRepair, ricarica lo stato perché potrebbe essere stato modificato da completeRepair
        const updatedRepairState = this.playerRepairStates.get(playerId);
        if (updatedRepairState && !updatedRepairState.completed) {
          updatedRepairState.lastRepairTime = now;
          this.playerRepairStates.set(playerId, updatedRepairState);
        }
      }
    }
  }

  /**
   * Inizia riparazione per un player
   */
  startRepair(playerId, now) {
    this.playerRepairStates.set(playerId, {
      repairStartTime: now,
      lastRepairTime: now,
      isRepairing: true,
      completed: false
    });

    logger.info('REPAIR', `Player ${playerId} started repairing`);

    // Notifica TUTTI i client sulla mappa per mostrare l'effetto grafico
    const playerData = this.mapServer.players.get(playerId);
    if (playerData) {
      const startMessage = {
        type: 'repair_started',
        playerId: playerData.playerId,
        clientId: playerData.clientId // Necessario per identificare l'entità nel client
      };

      if (this.mapServer.broadcastToMap) {
        this.mapServer.broadcastToMap(startMessage);
      } else if (playerData.ws) {
        // Fallback se broadcast non disponibile
        playerData.ws.send(JSON.stringify(startMessage));
      }
    }
  }

  /**
   * Ferma riparazione per un player
   */
  stopRepair(playerId) {
    const repairState = this.playerRepairStates.get(playerId);
    if (!repairState?.isRepairing) return;

    this.playerRepairStates.set(playerId, {
      ...repairState,
      isRepairing: false
    });

    logger.info('REPAIR', `Player ${playerId} stopped repairing`);

    // Notifica TUTTI i client sulla mappa per rimuovere l'effetto grafico
    const playerData = this.mapServer.players.get(playerId);
    if (playerData) {
      const stopMessage = {
        type: 'repair_stopped',
        playerId: playerData.playerId,
        clientId: playerData.clientId
      };

      if (this.mapServer.broadcastToMap) {
        this.mapServer.broadcastToMap(stopMessage);
      } else if (playerData.ws) {
        playerData.ws.send(JSON.stringify(stopMessage));
      }
    }
  }

  /**
   * Applica riparazione incrementale basata su percentuale - ripara HP e shield contemporaneamente
   */
  applyRepair(playerId, playerData, repairPercent, now) {
    let healthRepaired = 0;
    let shieldRepaired = 0;

    // Calcola riparazione basata su percentuale dei valori massimi
    const targetHealthRepair = Math.floor(playerData.maxHealth * repairPercent);
    const targetShieldRepair = Math.floor(playerData.maxShield * repairPercent);

    // Applica riparazione HP se necessari
    if (playerData.health < playerData.maxHealth) {
      healthRepaired = Math.min(targetHealthRepair, playerData.maxHealth - playerData.health);
      playerData.health += healthRepaired;
    }

    // Applica riparazione Shield se necessari (solo se HP > 50%)
    const healthRatio = playerData.health / playerData.maxHealth;
    if (playerData.shield < playerData.maxShield && healthRatio > 0.5) {
      shieldRepaired = Math.min(targetShieldRepair, playerData.maxShield - playerData.shield);
      playerData.shield += shieldRepaired;
    }

    // Broadcast aggiornamento stato player con valori riparati (se c'è stata riparazione)
    if (healthRepaired > 0 || shieldRepaired > 0) {
      this.broadcastPlayerRepairUpdate(playerId, playerData, healthRepaired, shieldRepaired);

      logger.info('REPAIR',
        `Player ${playerId} repaired: +${healthRepaired} HP, +${shieldRepaired} Shield ` +
        `(${playerData.health}/${playerData.maxHealth} HP, ${playerData.shield}/${playerData.maxShield} Shield)`
      );
    }

    // Dopo aver applicato la riparazione e fatto il broadcast, controlla se tutto è riparato
    // Questo gestisce correttamente anche l'ultima riparazione parziale (es. 5k su 10k disponibili)
    if (playerData.health >= playerData.maxHealth &&
      playerData.shield >= playerData.maxShield) {
      this.completeRepair(playerId, playerData, now);
      return;
    }
  }

  /**
   * Completa riparazione (tutto riparato)
   */
  completeRepair(playerId, playerData, now) {
    const repairState = this.playerRepairStates.get(playerId);
    if (!repairState?.isRepairing) return;

    // Imposta i valori esattamente al massimo per evitare danno residuo
    playerData.health = playerData.maxHealth;
    playerData.shield = playerData.maxShield;

    // Segna come completata invece di rimuovere lo stato
    this.playerRepairStates.set(playerId, {
      ...repairState,
      isRepairing: false,
      completed: true,
      completedAt: now
    });

    ServerLoggerWrapper.info('REPAIR', `Player ${playerId} repair completed (HP:${playerData.maxHealth}, Shield:${playerData.maxShield})`);

    // Notifica TUTTI i client con repair_complete
    const completeMessage = {
      type: 'repair_complete',
      playerId: playerData.playerId,
      clientId: playerData.clientId
    };

    if (this.mapServer.broadcastToMap) {
      this.mapServer.broadcastToMap(completeMessage);
    } else if (playerData?.ws) {
      playerData.ws.send(JSON.stringify(completeMessage));
    }
  }

  /**
   * Broadcast aggiornamento riparazione al client con valori riparati
   */
  broadcastPlayerRepairUpdate(playerId, playerData, healthRepaired, shieldRepaired) {
    if (!playerData) return;

    // 1. Invia aggiornamento privato al player che sta riparando (per UI feedback e repair text)
    if (playerData.ws) {
      playerData.ws.send(JSON.stringify({
        type: 'player_state_update',
        playerId: playerData.playerId,
        health: playerData.health,
        maxHealth: playerData.maxHealth,
        shield: playerData.shield,
        maxShield: playerData.maxShield,
        healthRepaired: healthRepaired,
        shieldRepaired: shieldRepaired,
        recentHonor: playerData.recentHonor || 0
      }));
    }

    // 2. 🚀 FIX: Broadcast aggiornamento HP/shield a tutti gli altri player per sincronizzare le barre
    // Usiamo 'entity_damaged' con damage 0 perché i client lo gestiscono già per i remote player
    const broadcastMessage = {
      type: 'entity_damaged',
      entityId: playerData.clientId, // clientId per identificare il player nel client
      entityType: 'player',
      damage: 0,
      attackerId: 'server',
      newHealth: playerData.health,
      newShield: playerData.shield,
      maxHealth: playerData.maxHealth,
      maxShield: playerData.maxShield,
      position: playerData.position,
      projectileType: 'repair'
    };

    // Broadcast a TUTTI i giocatori sulla mappa
    if (this.mapServer && typeof this.mapServer.broadcastToMap === 'function') {
      this.mapServer.broadcastToMap(broadcastMessage);
    }
  }

  /**
   * Aggiorna logica di riparazione per tutti gli NPC
   */
  updateNpcRepairs(now) {
    const allNpcs = this.mapServer.npcManager.getAllNpcs();
    for (const npc of allNpcs) {
      this.processNpcRepair(npc.id, npc, now);
    }
  }

  /**
   * Processa riparazione per un singolo NPC
   */
  processNpcRepair(npcId, npc, now) {
    const timeSinceLastDamage = npc.lastDamage ? (now - npc.lastDamage) : Infinity;
    const REPAIR_CONFIG = SERVER_CONSTANTS.NPC_REPAIR;

    let repairState = this.npcRepairStates.get(npcId);

    // Se ha ricevuto danno recentemente, blocca la riparazione
    if (timeSinceLastDamage < REPAIR_CONFIG.START_DELAY) {
      if (repairState?.isRepairing) {
        this.stopNpcRepair(npcId);
      }
      return;
    }

    // Se non sta riparando e può riparare, inizia
    if (!repairState?.isRepairing) {
      const needsRepair = npc.health < npc.maxHealth || npc.shield < npc.maxShield;
      if (needsRepair) {
        this.startNpcRepair(npcId, now);
      }
      return;
    }

    // Sta riparando - applica riparazione incrementale ogni 2 secondi
    if (repairState.isRepairing) {
      const lastRepairTime = repairState.lastRepairTime || repairState.repairStartTime;

      if (now - lastRepairTime >= REPAIR_CONFIG.INTERVAL) {
        this.applyNpcRepair(npcId, npc, REPAIR_CONFIG.PERCENT, now);

        // Ricarica stato e aggiorna lastRepairTime
        const updatedState = this.npcRepairStates.get(npcId);
        if (updatedState && !updatedState.completed) {
          updatedState.lastRepairTime = now;
          this.npcRepairStates.set(npcId, updatedState);
        }
      }
    }
  }

  /**
   * Inizia riparazione per un NPC
   */
  startNpcRepair(npcId, now) {
    this.npcRepairStates.set(npcId, {
      repairStartTime: now,
      lastRepairTime: now,
      isRepairing: true,
      completed: false
    });

    ServerLoggerWrapper.debug('NPC_REPAIR', `NPC ${npcId} started auto-repair`);
  }

  /**
   * Ferma riparazione per un NPC
   */
  stopNpcRepair(npcId) {
    const repairState = this.npcRepairStates.get(npcId);
    if (!repairState?.isRepairing) return;

    this.npcRepairStates.set(npcId, {
      ...repairState,
      isRepairing: false
    });

    ServerLoggerWrapper.debug('NPC_REPAIR', `NPC ${npcId} stopped auto-repair (damaged/interrupted)`);
  }

  /**
   * Applica riparazione incrementale a un NPC
   */
  applyNpcRepair(npcId, npc, repairPercent, now) {
    let healthRepaired = 0;
    let shieldRepaired = 0;

    const targetHealthRepair = Math.floor(npc.maxHealth * repairPercent);
    const targetShieldRepair = Math.floor(npc.maxShield * repairPercent);

    if (npc.health < npc.maxHealth) {
      healthRepaired = Math.min(targetHealthRepair, npc.maxHealth - npc.health);
      npc.health += healthRepaired;
    }

    if (npc.shield < npc.maxShield) {
      shieldRepaired = Math.min(targetShieldRepair, npc.maxShield - npc.shield);
      npc.shield += shieldRepaired;
    }

    if (healthRepaired > 0 || shieldRepaired > 0) {
      // Broadcast aggiornamento HP/shield a tutti i giocatori per sincronizzare le barre
      const broadcastMessage = {
        type: 'entity_damaged',
        entityId: npc.id,
        entityType: 'npc',
        damage: 0,
        attackerId: 'server',
        newHealth: npc.health,
        newShield: npc.shield,
        maxHealth: npc.maxHealth,
        maxShield: npc.maxShield,
        position: npc.position,
        projectileType: 'repair'
      };

      if (this.mapServer && typeof this.mapServer.broadcastToMap === 'function') {
        this.mapServer.broadcastToMap(broadcastMessage);
      }

      ServerLoggerWrapper.debug('NPC_REPAIR', `NPC ${npcId} repaired: +${healthRepaired} HP, +${shieldRepaired} Shield`);
    }

    if (npc.health >= npc.maxHealth && npc.shield >= npc.maxShield) {
      this.completeNpcRepair(npcId, npc, now);
    }
  }

  /**
   * Completa riparazione NPC
   */
  completeNpcRepair(npcId, npc, now) {
    const repairState = this.npcRepairStates.get(npcId);
    if (!repairState?.isRepairing) return;

    npc.health = npc.maxHealth;
    npc.shield = npc.maxShield;

    this.npcRepairStates.set(npcId, {
      ...repairState,
      isRepairing: false,
      completed: true,
      completedAt: now
    });

    ServerLoggerWrapper.debug('NPC_REPAIR', `NPC ${npcId} repair completed`);
  }

  /**
   * Rimuove stato riparazione quando player disconnette o NPC viene rimosso
   */
  removePlayer(playerId) {
    this.playerRepairStates.delete(playerId);
    this.playerCombatEndTimes.delete(playerId);
  }

  /**
   * Rimuove stato riparazione NPC
   */
  removeNpc(npcId) {
    this.npcRepairStates.delete(npcId);
  }

  /**
   * Notifica che un player è uscito dal combattimento
   * Chiamato quando stopPlayerCombat viene chiamato
   */
  onCombatEnded(playerId) {
    this.playerCombatEndTimes.set(playerId, Date.now());
  }
}

module.exports = RepairManager;
