// ServerCombatManager - Gestione centralizzata del combat lato server
// Dipendenze consentite: logger.cjs, config/constants.cjs

const { logger } = require('../logger.cjs');
const { SERVER_CONSTANTS, NPC_CONFIG } = require('../config/constants.cjs');

class ServerCombatManager {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.npcAttackCooldowns = new Map(); // npcId -> lastAttackTime
    this.playerCombats = new Map(); // playerId -> { npcId, lastAttackTime, attackCooldown }
    this.combatStartCooldowns = new Map(); // playerId -> lastCombatStartTime
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

    // Monitor combattimenti attivi

    // Processa combattimenti player
    this.processPlayerCombats(now);
  }

  /**
   * Inizia combattimento player contro NPC
   */
  startPlayerCombat(playerId, npcId) {
    logger.info('COMBAT', `Start combat: ${playerId} vs ${npcId}`);

    // Anti-spam: controlla se il player ha avviato un combattimento recentemente
    const now = Date.now();
    const lastCombatStart = this.combatStartCooldowns.get(playerId) || 0;
    const minTimeBetweenStarts = 500; // 500ms tra avvii combattimento

    if (now - lastCombatStart < minTimeBetweenStarts) {
      return;
    }

    // Se il player sta già combattendo un NPC diverso, ferma il combattimento precedente
    if (this.playerCombats.has(playerId)) {
      const existingCombat = this.playerCombats.get(playerId);
      if (existingCombat.npcId !== npcId) {
        this.playerCombats.delete(playerId);
        // Non chiamare stopPlayerCombat qui per evitare loop
      } else {
        return;
      }
    }

    // Registra il timestamp dell'avvio combattimento
    this.combatStartCooldowns.set(playerId, now);

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
  }

  /**
   * Ferma combattimento player
   */
  stopPlayerCombat(playerId) {
    if (this.playerCombats.has(playerId)) {
      this.playerCombats.delete(playerId);
    }
  }

  /**
   * Processa tutti i combattimenti attivi dei player
   */
  processPlayerCombats(now) {
    for (const [playerId, combat] of this.playerCombats) {
      this.processPlayerCombat(playerId, combat, now);
    }
  }

  /**
   * Processa combattimento per un singolo player
   */
  processPlayerCombat(playerId, combat, now) {
    // Verifica che il player sia ancora connesso
    const playerData = this.mapServer.players.get(playerId);
    if (!playerData) {
      this.playerCombats.delete(playerId);
      return;
    }

    // Verifica che l'NPC esista ancora
    const npc = this.mapServer.npcManager.getNpc(combat.npcId);
    if (!npc) {
      this.playerCombats.delete(playerId);
      return;
    }

    // Verifica che il player abbia una posizione
    if (!playerData.position) {
      return;
    }

    // Validazione posizione player
    const px = playerData.position.x;
    const py = playerData.position.y;
    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      return;
    }

    // Verifica che il player sia nel range (con periodo di grazia iniziale)
    const distance = Math.sqrt(
      Math.pow(px - npc.position.x, 2) +
      Math.pow(py - npc.position.y, 2)
    );

    // Controllo range rigoroso: ferma combattimento se fuori dal range base
    // I proiettili già sparati continueranno il loro volo, ma non verranno sparati altri
    if (distance > SERVER_CONSTANTS.COMBAT.PLAYER_START_RANGE) {
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
      return; // Non ancora tempo di attaccare
    }

    // Esegui attacco
    this.performPlayerAttack(playerId, playerData, npc, now);
    combat.lastAttackTime = now;
  }

  /**
   * Esegue attacco del player contro NPC
   */
  performPlayerAttack(playerId, playerData, npc, now) {

    // Usa posizione corrente del player dal server (più affidabile)
    const playerPos = playerData.position;

    // Calcola direzione dal player all'NPC
    const dx = npc.position.x - playerPos.x;
    const dy = npc.position.y - playerPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      return;
    }

    const directionX = dx / distance;
    const directionY = dy / distance;

    // Crea proiettile singolo (per semplicità, non dual laser per ora)
    const projectileId = `player_proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const speed = SERVER_CONSTANTS.PROJECTILE.SPEED;

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
    }

    // Registra proiettile
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
        // Player nel range - NPC attacca
        this.performNpcAttack(npc, playerData, now);
        break; // Un attacco per tick
      }
    }
  }

  /**
   * Esegue un attacco NPC contro un player
   */
  performNpcAttack(npc, targetPlayer, now) {
    // CRITICO: Crea una snapshot IMMEDIATA della posizione per evitare race conditions
    const npcPosition = {
      x: npc.position.x,
      y: npc.position.y,
      rotation: npc.position.rotation
    };

    // Controlla che la snapshot abbia una posizione valida
    if (!Number.isFinite(npcPosition.x) || !Number.isFinite(npcPosition.y)) {
      console.error(`❌ [SERVER] NPC ${npc.id} has INVALID position snapshot! x=${npcPosition.x}, y=${npcPosition.y}. SKIPPING ATTACK`);
      return;
    }

    // Calcola direzione diretta verso il player per il proiettile
    const dx = targetPlayer.position.x - npcPosition.x;
    const dy = targetPlayer.position.y - npcPosition.y;
    const angle = Math.atan2(dy, dx);

    // Ruota NPC verso il target (per rendering visivo)
    npc.position.rotation = angle + Math.PI / 2;

    // Crea proiettile NPC
    const projectileId = `npc_proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Posizione con offset per evitare di colpire immediatamente l'NPC stesso - USA SNAPSHOT
    const spawnOffset = SERVER_CONSTANTS.PROJECTILE.SPAWN_OFFSET;
    const projectilePos = {
      x: npcPosition.x + Math.cos(angle) * spawnOffset,
      y: npcPosition.y + Math.sin(angle) * spawnOffset
    };

    // Velocità iniziale verso il target (sarà corretta dal homing)
    const velocity = {
      x: Math.cos(angle) * SERVER_CONSTANTS.PROJECTILE.NPC_SPEED,
      y: Math.sin(angle) * SERVER_CONSTANTS.PROJECTILE.NPC_SPEED
    };

    // Registra proiettile
    try {
      this.mapServer.projectileManager.addProjectile(
        projectileId,
        npc.id, // Attaccante NPC (già include "npc_")
        projectilePos,
        velocity,
        npc.damage || NPC_CONFIG[npc.type].stats.damage,
        'scouter_laser',
        targetPlayer.clientId // Target è il player che viene attaccato
      );
    } catch (error) {
      console.error(`❌ [SERVER] Failed to add projectile ${projectileId} (NPC attack):`, error);
    }

    // Il broadcast viene già fatto automaticamente da addProjectile()

    // Aggiorna cooldown
    this.npcAttackCooldowns.set(npc.id, now);
  }
}

module.exports = ServerCombatManager;
