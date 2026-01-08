// ServerCombatManager - Gestione centralizzata del combat lato server
// Dipendenze consentite: logger.cjs, config/constants.cjs

const { logger } = require('../logger.cjs');
const { SERVER_CONSTANTS, NPC_CONFIG } = require('../config/constants.cjs');

class ServerCombatManager {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.npcAttackCooldowns = new Map(); // npcId -> lastAttackTime
    this.playerCombats = new Map(); // playerId -> { npcId, lastAttackTime, attackCooldown }
  }

  /**
   * Aggiorna logica di combat per tutti gli NPC e player
   */
  updateCombat() {
    const allNpcs = this.mapServer.npcManager.getAllNpcs();
    const now = Date.now();

    // Processa combattimenti NPC
    for (const npc of allNpcs) {
      this.processNpcCombat(npc, now);
    }

    // Debug: mostra numero combattimenti attivi ogni secondo
    if (now % 1000 < 50) { // Solo una volta al secondo
      console.log(`⚔️ [COMBAT] Active combats: ${this.playerCombats.size}`);
    }

    // Processa combattimenti player
    this.processPlayerCombats(now);
  }

  /**
   * Inizia combattimento player contro NPC
   */
  startPlayerCombat(playerId, npcId) {
    logger.info('COMBAT', `Start combat: ${playerId} vs ${npcId}`);

    // Se il player sta già combattendo un NPC diverso, ferma il combattimento precedente
    if (this.playerCombats.has(playerId)) {
      const existingCombat = this.playerCombats.get(playerId);
      if (existingCombat.npcId !== npcId) {
        logger.debug('COMBAT', `Player ${playerId} switching from NPC ${existingCombat.npcId} to ${npcId}, stopping previous combat`);
        this.playerCombats.delete(playerId);
        // Non chiamare stopPlayerCombat qui per evitare loop
      } else {
        logger.debug('COMBAT', `Player ${playerId} already attacking NPC ${npcId}, ignoring duplicate request`);
        return;
      }
    }

    // Verifica che l'NPC esista
    const npc = this.mapServer.npcManager.getNpc(npcId);
    if (!npc) {
      console.warn(`⚠️ [SERVER] Cannot start combat: NPC ${npcId} not found`);
      return;
    }

    // Ottieni cooldown dalla configurazione player (coerente con client)
    const PLAYER_CONFIG = require('../../shared/player-config.json');
    const attackCooldown = PLAYER_CONFIG.stats.cooldown;

    // Imposta combattimento attivo
    this.playerCombats.set(playerId, {
      npcId: npcId,
      lastAttackTime: 0,
      attackCooldown: attackCooldown,
      combatStartTime: Date.now() // Timestamp di inizio combattimento
    });

    logger.debug('COMBAT', `Started player combat: ${playerId} vs ${npcId} (cooldown: ${attackCooldown}ms)`);
  }

  /**
   * Ferma combattimento player
   */
  stopPlayerCombat(playerId) {
    logger.debug('COMBAT', `Stopping player combat: ${playerId}`);

    if (this.playerCombats.has(playerId)) {
      this.playerCombats.delete(playerId);
    }
  }

  /**
   * Processa tutti i combattimenti attivi dei player
   */
  processPlayerCombats(now) {
    if (this.playerCombats.size > 0) {
      console.log(`🎯 [COMBAT] Processing ${this.playerCombats.size} player combats`);
    }

    for (const [playerId, combat] of this.playerCombats) {
      this.processPlayerCombat(playerId, combat, now);
    }
  }

  /**
   * Processa combattimento per un singolo player
   */
  processPlayerCombat(playerId, combat, now) {
    console.log(`🔄 [COMBAT] Processing combat for player ${playerId} vs NPC ${combat.npcId}`);

    // Verifica che il player sia ancora connesso
    const playerData = this.mapServer.players.get(playerId);
    if (!playerData) {
      console.log(`🛑 [SERVER] Player ${playerId} disconnected, stopping combat`);
      this.playerCombats.delete(playerId);
      return;
    }

    // Verifica che l'NPC esista ancora
    const npc = this.mapServer.npcManager.getNpc(combat.npcId);
    if (!npc) {
      console.log(`🛑 [SERVER] NPC ${combat.npcId} destroyed, stopping combat for ${playerId}`);
      this.playerCombats.delete(playerId);
      return;
    }

    // Verifica che il player abbia una posizione
    if (!playerData.position) {
      console.log(`📍 [SERVER] Player ${playerId} has no position, skipping combat`);
      return;
    }

    // Verifica che il player sia nel range (con periodo di grazia iniziale)
    const distance = Math.sqrt(
      Math.pow(playerData.position.x - npc.position.x, 2) +
      Math.pow(playerData.position.y - npc.position.y, 2)
    );

    // Controllo range rigoroso: ferma combattimento se fuori dal range base
    // I proiettili già sparati continueranno il loro volo, ma non verranno sparati altri
    if (distance > SERVER_CONSTANTS.COMBAT.PLAYER_START_RANGE) {
      console.log(`📏 [SERVER] Player ${playerId} out of range (${distance.toFixed(1)}px > ${SERVER_CONSTANTS.COMBAT.PLAYER_START_RANGE}px), stopping combat`);
      this.playerCombats.delete(playerId);

      // Notifica il client che il combattimento è stato fermato automaticamente per range
      const stopCombatMessage = {
        type: 'stop_combat',
        reason: 'out_of_range',
        playerId: playerId
      };
      playerData.ws.send(JSON.stringify(stopCombatMessage));

      return;
    }

    // Verifica cooldown
    const timeSinceLastAttack = now - combat.lastAttackTime;
    if (timeSinceLastAttack < combat.attackCooldown) {
      console.log(`⏰ [SERVER] Player ${playerId} cooling down (${(timeSinceLastAttack / 1000).toFixed(1)}s / ${(combat.attackCooldown / 1000).toFixed(1)}s)`);
      return; // Non ancora tempo di attaccare
    }

    // Esegui attacco
    console.log(`🔫 [SERVER] Player ${playerId} attacking NPC ${combat.npcId} (distance: ${distance.toFixed(0)}, range: ${SERVER_CONSTANTS.COMBAT.PLAYER_RANGE})`);
    this.performPlayerAttack(playerId, playerData, npc, now);
    combat.lastAttackTime = now;
  }

  /**
   * Esegue attacco del player contro NPC
   */
  performPlayerAttack(playerId, playerData, npc, now) {
    console.log(`🚀 [SERVER] Player ${playerId} firing projectile at NPC ${npc.id}`);

    // Usa posizione corrente del player dal server (più affidabile)
    const playerPos = playerData.position;

    // Calcola direzione dal player all'NPC
    const dx = npc.position.x - playerPos.x;
    const dy = npc.position.y - playerPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      console.log(`⚠️ [SERVER] Distance is 0, skipping attack`);
      return;
    }

    const directionX = dx / distance;
    const directionY = dy / distance;

    // Crea proiettile singolo (per semplicità, non dual laser per ora)
    const projectileId = `player_proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const speed = SERVER_CONSTANTS.PROJECTILE.SPEED;

    logger.debug('PROJECTILE', `Creating projectile ${projectileId} from (${playerPos.x.toFixed(0)}, ${playerPos.y.toFixed(0)}) to (${npc.position.x.toFixed(0)}, ${npc.position.y.toFixed(0)})`);

    const velocity = {
      x: directionX * speed,
      y: directionY * speed
    };

    // Posizione dal centro esatto del player (no offset per centrare sempre)
    const projectilePos = {
      x: playerPos.x,
      y: playerPos.y
    };

    // Calcola danno basato sugli upgrade del player (Server Authoritative)
    let calculatedDamage = 500; // Base damage
    if (playerData.upgrades) {
      // Calculate damage bonus: 1.0 + (damageUpgrades * 0.01)
      const damageBonus = 1.0 + (playerData.upgrades.damageUpgrades * 0.01);
      calculatedDamage = Math.floor(500 * damageBonus);
      console.log(`🎯 [SERVER] Player ${playerId} damage calculated: ${calculatedDamage} (base: 500, bonus: ${damageBonus.toFixed(3)}, upgrades: ${JSON.stringify(playerData.upgrades)})`);
    }

    // Registra proiettile
    console.log(`📡 [SERVER] Adding projectile ${projectileId} to projectileManager`);
    this.mapServer.projectileManager.addProjectile(
      projectileId,
      playerId,
      projectilePos,
      velocity,
      calculatedDamage, // damage calcolato basato sugli upgrade
      'laser',
      npc.id, // targetId - ID dell'NPC bersaglio per homing
      false // excludeSender - il client deve vedere i suoi proiettili
    );
    console.log(`✅ [SERVER] Projectile ${projectileId} added successfully`);
  }

  /**
   * Processa logica di combat per un singolo NPC
   */
  processNpcCombat(npc, now) {
    // NPC attaccano solo se danneggiati recentemente O in modalità aggressive
    const wasRecentlyDamaged = npc.lastDamage && (now - npc.lastDamage) < 10000; // 10 secondi
    const isAggressive = npc.behavior === 'aggressive';

    if (!wasRecentlyDamaged && !isAggressive) return;

    // Controlla cooldown attacco
    const lastAttack = this.npcAttackCooldowns.get(npc.id) || 0;
    const cooldown = NPC_CONFIG[npc.type].stats.cooldown || 1500;
    if (now - lastAttack < cooldown) return;

    // Trova player nel raggio di attacco
    const attackRange = NPC_CONFIG[npc.type].stats.range || 300;
    const attackRangeSq = attackRange * attackRange;

    for (const [clientId, playerData] of this.mapServer.players.entries()) {
      if (!playerData.position) continue;

      const dx = playerData.position.x - npc.position.x;
      const dy = playerData.position.y - npc.position.y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq <= attackRangeSq) {
        // Player nel range - NPC attacca (TEMPORANEAMENTE DISABILITATO)
        console.log(`🚫 [SERVER] NPC ${npc.id} could attack player ${clientId} but attacks are DISABLED`);
        // this.performNpcAttack(npc, playerData, now);
        break; // Un attacco per tick
      }
    }
  }

  /**
   * Esegue un attacco NPC contro un player
   */
  performNpcAttack(npc, targetPlayer, now) {
    logger.error('COMBAT', `NPC ${npc.id} trying to attack - THIS SHOULD NOT HAPPEN!`);
    // Calcola direzione diretta verso il player per il proiettile
    const dx = targetPlayer.position.x - npc.position.x;
    const dy = targetPlayer.position.y - npc.position.y;
    const angle = Math.atan2(dy, dx);

    // Ruota NPC verso il target (per rendering visivo)
    npc.position.rotation = angle + Math.PI / 2;

    // Crea proiettile NPC
    const projectileId = `npc_proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const speed = SERVER_CONSTANTS.PROJECTILE.SPEED; // Velocità proiettile

    const velocity = {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed
    };

    // Posizione dal centro esatto dell'NPC (no offset per centrare sempre)
    const projectilePos = {
      x: npc.position.x,
      y: npc.position.y
    };

    // Registra proiettile
    this.mapServer.projectileManager.addProjectile(
      projectileId,
      npc.id, // Attaccante NPC (già include "npc_")
      projectilePos,
      velocity,
      npc.damage || NPC_CONFIG[npc.type].stats.damage,
      'scouter_laser',
      targetPlayer.clientId // Target è il player che viene attaccato
    );

    // Il broadcast viene già fatto automaticamente da addProjectile()

    // Aggiorna cooldown
    this.npcAttackCooldowns.set(npc.id, now);
  }
}

module.exports = ServerCombatManager;
