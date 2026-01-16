// RepairManager - Gestione riparazione server-authoritative per player
// Dipendenze consentite: logger.cjs, config/constants.cjs

const { logger } = require('../logger.cjs');
const { SERVER_CONSTANTS } = require('../config/constants.cjs');

class RepairManager {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.playerRepairStates = new Map(); // playerId -> { repairStartTime, isRepairing, lastRepairTime, lastCombatEndTime }
    this.playerCombatEndTimes = new Map(); // playerId -> timestamp quando è uscito dal combattimento
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
    const isInCombat = this.mapServer.combatManager?.playerCombats.has(playerId) || false;
    const timeSinceLastDamage = playerData.lastDamage ? (now - playerData.lastDamage) : Infinity;
    const REPAIR_START_DELAY = SERVER_CONSTANTS.REPAIR.START_DELAY;
    const REPAIR_AMOUNT = SERVER_CONSTANTS.REPAIR.AMOUNT;
    const REPAIR_INTERVAL = SERVER_CONSTANTS.REPAIR.INTERVAL;

    let repairState = this.playerRepairStates.get(playerId);
    
    // Se è in combattimento, ferma riparazione e rimuovi il timestamp di fine combattimento
    if (isInCombat) {
      if (repairState?.isRepairing) {
        this.stopRepair(playerId);
      }
      // Rimuovi il timestamp di fine combattimento (è ancora in combattimento)
      this.playerCombatEndTimes.delete(playerId);
      return;
    }

    // Calcola tempo dall'ultimo evento (danno o fine combattimento)
    const lastCombatEndTime = this.playerCombatEndTimes.get(playerId);
    const timeSinceLastCombatEnd = lastCombatEndTime ? (now - lastCombatEndTime) : Infinity;
    const timeSinceLastEvent = Math.min(timeSinceLastDamage, timeSinceLastCombatEnd);
    
    // Se ha preso danno recentemente o è uscito dal combattimento recentemente, ferma riparazione
    if (timeSinceLastEvent < REPAIR_START_DELAY) {
      if (repairState?.isRepairing) {
        this.stopRepair(playerId);
      }
      return;
    }

    // Se non sta riparando e può riparare, inizia
    if (!repairState?.isRepairing) {
      const needsRepair = playerData.health < playerData.maxHealth || 
                         playerData.shield < playerData.maxShield;
      
      if (needsRepair) {
        this.startRepair(playerId, now);
      }
      return;
    }

    // Sta riparando - applica riparazione incrementale ogni 2 secondi
    if (repairState.isRepairing) {
      const lastRepairTime = repairState.lastRepairTime || repairState.repairStartTime;
      
      // Applica riparazione ogni 2 secondi
      if (now - lastRepairTime >= REPAIR_INTERVAL) {
        this.applyRepair(playerId, playerData, REPAIR_AMOUNT);
        repairState.lastRepairTime = now;
        this.playerRepairStates.set(playerId, repairState);
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
      isRepairing: true
    });
    
    logger.info('REPAIR', `Player ${playerId} started repairing`);
    
    // Notifica client
    const playerData = this.mapServer.players.get(playerId);
    if (playerData?.ws) {
      playerData.ws.send(JSON.stringify({
        type: 'repair_started',
        playerId: playerData.playerId
      }));
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
    
    // Notifica client
    const playerData = this.mapServer.players.get(playerId);
    if (playerData?.ws) {
      playerData.ws.send(JSON.stringify({
        type: 'repair_stopped',
        playerId: playerData.playerId
      }));
    }
  }

  /**
   * Applica riparazione incrementale (10k ogni volta)
   */
  applyRepair(playerId, playerData, repairAmount) {
    let healthRepaired = 0;
    let shieldRepaired = 0;
    let remainingRepair = repairAmount;

    // Ripara prima lo shield se non è al massimo
    if (playerData.shield < playerData.maxShield) {
      const shieldNeeded = playerData.maxShield - playerData.shield;
      shieldRepaired = Math.min(remainingRepair, shieldNeeded);
      playerData.shield = Math.min(playerData.maxShield, playerData.shield + shieldRepaired);
      remainingRepair -= shieldRepaired;
    }

    // Poi ripara l'HP se c'è ancora riparazione disponibile
    if (remainingRepair > 0 && playerData.health < playerData.maxHealth) {
      const healthNeeded = playerData.maxHealth - playerData.health;
      healthRepaired = Math.min(remainingRepair, healthNeeded);
      playerData.health = Math.min(playerData.maxHealth, playerData.health + healthRepaired);
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
      this.completeRepair(playerId, playerData);
      return;
    }
  }

  /**
   * Completa riparazione (tutto riparato)
   */
  completeRepair(playerId, playerData) {
    const repairState = this.playerRepairStates.get(playerId);
    if (!repairState?.isRepairing) return;

    this.playerRepairStates.set(playerId, {
      ...repairState,
      isRepairing: false
    });

    logger.info('REPAIR', `Player ${playerId} repair completed`);
    
    // Notifica client con repair_complete invece di repair_stopped
    if (playerData?.ws) {
      playerData.ws.send(JSON.stringify({
        type: 'repair_complete',
        playerId: playerData.playerId
      }));
    }
  }

  /**
   * Broadcast aggiornamento riparazione al client con valori riparati
   */
  broadcastPlayerRepairUpdate(playerId, playerData, healthRepaired, shieldRepaired) {
    if (!playerData?.ws) return;

    playerData.ws.send(JSON.stringify({
      type: 'player_state_update',
      playerId: playerData.playerId,
      health: playerData.health,
      maxHealth: playerData.maxHealth,
      shield: playerData.shield,
      maxShield: playerData.maxShield,
      healthRepaired: healthRepaired,
      shieldRepaired: shieldRepaired
    }));
  }

  /**
   * Rimuove stato riparazione quando player disconnette
   */
  removePlayer(playerId) {
    this.playerRepairStates.delete(playerId);
    this.playerCombatEndTimes.delete(playerId);
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
