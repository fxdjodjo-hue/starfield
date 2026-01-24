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
    const REPAIR_AMOUNT = SERVER_CONSTANTS.REPAIR.AMOUNT;
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
        this.applyRepair(playerId, playerData, REPAIR_AMOUNT, now);
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
   * Applica riparazione incrementale (10k ogni volta) - ripara HP e shield contemporaneamente
   */
  applyRepair(playerId, playerData, repairAmount, now) {
    let healthRepaired = 0;
    let shieldRepaired = 0;

    // Calcola i danni per HP e shield
    const healthDamage = playerData.maxHealth - playerData.health;
    const shieldDamage = playerData.maxShield - playerData.shield;
    const totalDamage = healthDamage + shieldDamage;

    if (totalDamage > 0) {
      // Distribuisci la riparazione proporzionalmente tra HP e shield
      const healthRepairAmount = Math.floor((healthDamage / totalDamage) * repairAmount);
      const shieldRepairAmount = repairAmount - healthRepairAmount;

      // Applica riparazione HP
      if (healthDamage > 0) {
        healthRepaired = Math.min(healthRepairAmount, healthDamage);
        playerData.health = Math.min(playerData.maxHealth, playerData.health + healthRepaired);
      }

      // Applica riparazione Shield
      if (shieldDamage > 0) {
        shieldRepaired = Math.min(shieldRepairAmount, shieldDamage);
        playerData.shield = Math.min(playerData.maxShield, playerData.shield + shieldRepaired);
      }
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
