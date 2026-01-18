// ServerCombatManager - Gestione centralizzata del combat lato server
// Dipendenze consentite: logger.cjs, config/constants.cjs, core/combat/DamageCalculationSystem.cjs

const { logger } = require('../logger.cjs');
const { SERVER_CONSTANTS, NPC_CONFIG } = require('../config/constants.cjs');
const DamageCalculationSystem = require('../core/combat/DamageCalculationSystem.cjs');
const PLAYER_CONFIG = require('../../shared/player-config.json');

class ServerCombatManager {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.npcAttackCooldowns = new Map(); // npcId -> lastAttackTime
    this.playerCombats = new Map(); // playerId -> { npcId, lastAttackTime, attackCooldown }
    this.combatStartCooldowns = new Map(); // playerId -> lastCombatStartTime
  }

  // Pattern ritmico come moltiplicatori rispetto al cooldown base (800ms)
  // Pattern: 0.870-0.870-1.217-1.043 = 696-696-974-835ms quando cooldown base è 800ms
  // Media = 1.0 → fire rate medio = 800ms (cooldown base preservato)

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
    // 🚫 BLOCCA combat senza target valido
    if (!npcId) {
      console.warn(`[COMBAT-ERROR] Player ${playerId} tried to start combat with null/invalid npcId`);
      return; // Non creare il combat
    }

    // 🔒 SECURITY: Anti-spam - previene spam di start_combat per bypassare cooldown
    const now = Date.now();
    const lastCombatStart = this.combatStartCooldowns.get(playerId) || 0;
    const minTimeBetweenStarts = 500; // 500ms tra avvii combattimento

    if (now - lastCombatStart < minTimeBetweenStarts) {
      // Ignora richieste troppo frequenti
      return;
    }

    // ✅ Verifica sempre che l'NPC esista prima di creare qualsiasi combat
    const existingNpc = this.mapServer.npcManager.getNpc(npcId);
    if (!existingNpc) {
      console.warn(`[COMBAT-ERROR] Player ${playerId} tried to start combat with non-existing NPC ${npcId}`);
      return;
    }

    logger.info('COMBAT', `Start combat: ${playerId} vs ${npcId}`);

    // Se il player sta già combattendo, controlla se deve aggiornare il target
    if (this.playerCombats.has(playerId)) {
      const existingCombat = this.playerCombats.get(playerId);
      if (existingCombat.npcId === npcId) {
        // Già combatte contro questo NPC, non fare nulla
        return;
      } else {
        // Aggiorna target a un nuovo NPC valido
        existingCombat.npcId = npcId;
        existingCombat.startTime = now;
        existingCombat.lastActivity = now;
        existingCombat.lastAttackTime = 0; // Reset per nuovo target
        existingCombat.attackCooldown = PLAYER_CONFIG.stats.cooldown;
        existingCombat.combatStartTime = now;
        logger.info('COMBAT', `Updated combat target: ${playerId} now vs ${npcId}`);
        return;
      }
    }

    // Registra il timestamp dell'avvio combattimento
    this.combatStartCooldowns.set(playerId, now);

    // Ottieni cooldown dalla configurazione player (coerente con client)
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

      // ✅ FIX: Rimuovi anche l'entry dai cooldown temporanei per evitare spam
      this.combatStartCooldowns.delete(playerId);

      // Notifica repair manager che il combattimento è terminato
      if (this.mapServer.repairManager && typeof this.mapServer.repairManager.onCombatEnded === 'function') {
        this.mapServer.repairManager.onCombatEnded(playerId);
      }
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

    // ✅ ARCHITECTURAL CLEANUP: Non esistono più combat con npcId=null
    // Tutti i combat hanno un target valido verificato

    // 🚫 Verifica che l'NPC target esista ancora
    const targetNpc = this.mapServer.npcManager.getNpc(combat.npcId);
    if (!targetNpc) {
      console.warn(`[COMBAT-ERROR] Player ${playerId} combat target removed: npcId=${combat.npcId}`);
      this.playerCombats.delete(playerId);
      this.combatStartCooldowns.delete(playerId);
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

    // Verifica che il player sia nel range rettangolare
    const rangeWidth = SERVER_CONSTANTS.COMBAT.PLAYER_RANGE_WIDTH;
    const rangeHeight = SERVER_CONSTANTS.COMBAT.PLAYER_RANGE_HEIGHT;

    const dx = Math.abs(px - npc.position.x);
    const dy = Math.abs(py - npc.position.y);

    // Controllo range rigoroso rettangolare: ferma combattimento se fuori dal rettangolo
    // I proiettili già sparati continueranno il loro volo, ma non verranno sparati altri
    if (dx > rangeWidth / 2 || dy > rangeHeight / 2) {
      this.playerCombats.delete(playerId);

      // Notifica repair manager che il combattimento è terminato
      if (this.mapServer.repairManager && typeof this.mapServer.repairManager.onCombatEnded === 'function') {
        this.mapServer.repairManager.onCombatEnded(playerId);
      }

      // Notifica il client che il combattimento è stato fermato automaticamente per range
      const stopCombatMessage = {
        type: 'stop_combat',
        reason: 'out_of_range',
        playerId: playerId
      };
      playerData.ws.send(JSON.stringify(stopCombatMessage));

      return;
    }

    // 🔒 SECURITY: Cooldown fisso 800ms (server-authoritative)
    // Il danno viene applicato sempre ogni 800ms
    // L'animazione ritmica è gestita lato client (solo visiva)

    // ✅ FIX: Validazione robusta con fallback su valori di default
    const baseCooldown = combat.attackCooldown || PLAYER_CONFIG?.stats?.cooldown || 800;
    const lastAttackTime = combat.lastAttackTime || 0;
    const timeSinceLastAttack = now - lastAttackTime;

    // ✅ FIX: Log di debug per identificare problemi di inizializzazione
    console.log(`[COMBAT-SERVER] combat state check: playerId=${playerId}, npcId=${combat.npcId}, lastAttackTime=${lastAttackTime}, attackCooldown=${combat.attackCooldown}, baseCooldown=${baseCooldown}, timeSinceLastAttack=${timeSinceLastAttack}, hasAllFields=${!!(combat.lastAttackTime !== undefined && combat.attackCooldown !== undefined)}`);

    if (timeSinceLastAttack < baseCooldown) {
      return; // Non ancora tempo di attaccare - il client non può forzare attacchi
    }

    // Esegui attacco (danno applicato ogni 800ms)
    console.log(`[COMBAT-SERVER] performPlayerAttack called, playerId=${playerId}, timeSinceLastAttack=${timeSinceLastAttack}, baseCooldown=${baseCooldown}, npcId=${combat.npcId}`);
    this.performPlayerAttack(playerId, playerData, npc, now);
    combat.lastAttackTime = now;
  }

  /**
   * Esegue attacco generico (player o NPC) con traiettoria lineare
   * @param {string} ownerId - ID di chi spara (playerId o npcId)
   * @param {Object} ownerPosition - Posizione di chi spara {x, y}
   * @param {Object} targetPosition - Posizione del target {x, y}
   * @param {number} damage - Danno del proiettile
   * @param {string} projectileType - Tipo di proiettile ('laser' o altro)
   * @param {string} targetId - ID del target
   * @returns {string|null} ID del proiettile creato
   */
  performAttack(ownerId, ownerPosition, targetPosition, damage, projectileType = 'laser', targetId = null) {
    // DEBUG: Log per vedere se viene chiamato
    // Calcola direzione normalizzata dal owner al target
    const dx = targetPosition.x - ownerPosition.x;
    const dy = targetPosition.y - ownerPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      return null; // Non sparare se posizioni coincidenti
    }

    // Normalizza direzione
    const directionX = dx / distance;
    const directionY = dy / distance;

    // Crea proiettile
    const projectileId = `${ownerId}_proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 🚀 TRAIETTORIA LINEARE UNIFICATA per tutti (player e NPC)
    const projectilePos = {
      x: ownerPosition.x + directionX * SERVER_CONSTANTS.PROJECTILE.SPAWN_OFFSET,
      y: ownerPosition.y + directionY * SERVER_CONSTANTS.PROJECTILE.SPAWN_OFFSET
    };

    // Velocità costante verso il target
    const velocity = {
      x: directionX * SERVER_CONSTANTS.PROJECTILE.SPEED,
      y: directionY * SERVER_CONSTANTS.PROJECTILE.SPEED
    };

    // Registra proiettile (broadcast automatico)
    // Player devono vedere i propri laser, NPC no
    const isPlayer = !ownerId.startsWith('npc_');
    const excludeSender = !isPlayer; // false per player, true per NPC

    try {
      this.mapServer.projectileManager.addProjectile(
        projectileId,
        ownerId,
        projectilePos,
        velocity,
        damage,
        projectileType,
        targetId,
        excludeSender
      );
      return projectileId;
    } catch (error) {
      console.error(`❌ [SERVER] Failed to add projectile ${projectileId}:`, error);
      return null;
    }
  }

  /**
   * Esegue attacco del player contro NPC
   * @returns {string|null} ID del proiettile creato
   */
  performPlayerAttack(playerId, playerData, npc, now) {
    // DEBUG: Log quando il player spara
    console.log(`[SERVER_PLAYER_ATTACK] Player ${playerId} attacking NPC ${npc.id} at combat tick`);

    // Usa posizione corrente del player dal server (più affidabile)
    const playerPos = playerData.position;

    // Calcola danno usando DamageCalculationSystem (logica di gioco)
    const baseDamage = DamageCalculationSystem.getBasePlayerDamage();
    const calculatedDamage = DamageCalculationSystem.calculatePlayerDamage(
      baseDamage,
      playerData.upgrades
    );

    // Usa la funzione comune per creare il proiettile
    const projectileId = this.performAttack(
      playerId,              // ownerId - ID del player
      playerPos,             // ownerPosition - posizione attuale del player
      npc.position,          // targetPosition - posizione dell'NPC
      calculatedDamage,      // damage - danno calcolato
      'laser',               // projectileType - tipo corretto per player
      npc.id                 // targetId - ID dell'NPC
    );

    // ✅ Aggiorna cooldown PLAYER se il proiettile è stato creato
    // Questo assicura che il player possa sparare più volte
    if (projectileId) {
      playerData.lastAttackTime = now;
    }

    return projectileId;
  }

  /**
   * Processa logica di combat per un singolo NPC
   */
  processNpcCombat(npc, now) {
    // TEMPORANEO: NPC non attaccano mai automaticamente (sempre in cruise)
    // Commentato controllo danno recente e comportamento aggressivo
    // const wasRecentlyDamaged = npc.lastDamage && (now - npc.lastDamage) < 10000; // 10 secondi
    // const isAggressive = npc.behavior === 'aggressive';

    // NPC non sparano mai automaticamente
    return;

    // Controlla cooldown attacco
    const lastAttack = this.npcAttackCooldowns.get(npc.id) || 0;
    const cooldown = NPC_CONFIG[npc.type].stats.cooldown || 1500;
    if (now - lastAttack < cooldown) return;

    // Trova player nel raggio di attacco
    const attackRange = NPC_CONFIG[npc.type].stats.range;
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
    // Verifica posizioni valide
    if (!Number.isFinite(npc.position.x) || !Number.isFinite(npc.position.y)) {
      console.error(`❌ [SERVER] NPC ${npc.id} has INVALID position! x=${npc.position.x}, y=${npc.position.y}. SKIPPING ATTACK`);
      return;
    }

    if (!targetPlayer.position || !Number.isFinite(targetPlayer.position.x) || !Number.isFinite(targetPlayer.position.y)) {
      console.error(`❌ [SERVER] Invalid player position for NPC ${npc.id} attack`);
      return;
    }

    // Calcola direzione e distanza
    const dx = targetPlayer.position.x - npc.position.x;
    const dy = targetPlayer.position.y - npc.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Se troppo vicino, non sparare
    if (distance < 10) {
      return;
    }

    // Ruota NPC verso il target
    npc.position.rotation = Math.atan2(dy, dx);

    // Calcola danno NPC
    const damage = npc.damage || NPC_CONFIG[npc.type].stats.damage;

    // Usa la funzione comune per creare il proiettile
    const projectileId = this.performAttack(
      npc.id,
      npc.position,
      targetPlayer.position,
      damage,
      'scouter_laser',
      targetPlayer.clientId
    );

    // Aggiorna cooldown se il proiettile è stato creato
    if (projectileId) {
      this.npcAttackCooldowns.set(npc.id, now);
    }
  }
}

module.exports = ServerCombatManager;
