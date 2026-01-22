// ServerCombatManager - Gestione centralizzata del combat lato server
// Dipendenze consentite: logger.cjs, config/constants.cjs, core/combat/DamageCalculationSystem.cjs

const { logger } = require('../logger.cjs');
const ServerLoggerWrapper = require('../core/infrastructure/ServerLoggerWrapper.cjs');
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

  // Pattern ritmico come moltiplicatori rispetto al cooldown base
  // Usa PLAYER_CONFIG.stats.cooldown per single source of truth

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
   * @param {string} playerId - ID del player
   * @param {string} npcId - ID dell'NPC target
   * @param {object} context - Context con connessione WebSocket per errori
   */
  startPlayerCombat(playerId, npcId, context = null) {
    // 🚫 BLOCCA combat senza target valido
    if (!npcId) {
      ServerLoggerWrapper.warn('COMBAT', `Player ${playerId} tried to start combat with null/invalid npcId`);
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
      ServerLoggerWrapper.warn('COMBAT', `Player ${playerId} tried to start combat with non-existing NPC ${npcId}`);
      return;
    }

    ServerLoggerWrapper.combat(`Start combat: ${playerId} vs ${npcId}`);

    // 🚫 COMBAT SESSION SECURITY: Un solo combattimento attivo per player alla volta
    if (this.playerCombats.has(playerId)) {
      const existingCombat = this.playerCombats.get(playerId);
      ServerLoggerWrapper.combat(`🚫 BLOCKED: Player ${playerId} attempted multiple combat sessions. Active session: ${existingCombat.sessionId}, attempted vs ${npcId}`);

      // Invia messaggio di errore al client
      if (context && context.ws) {
        context.ws.send(JSON.stringify({
          type: 'combat_error',
          message: 'Combat session already active. Complete current combat first.',
          code: 'MULTIPLE_COMBAT_SESSIONS',
          activeSessionId: existingCombat.sessionId
        }));
      }

      return; // BLOCCA il nuovo combattimento
    }

    // Registra il timestamp dell'avvio combattimento
    this.combatStartCooldowns.set(playerId, now);

    // Ottieni cooldown dalla configurazione player (coerente con client)
    const attackCooldown = PLAYER_CONFIG.stats.cooldown;

    // Genera session ID univoco per questo combattimento
    const sessionId = `combat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Imposta combattimento attivo con session ID
    this.playerCombats.set(playerId, {
      sessionId: sessionId,
      npcId: npcId,
      lastAttackTime: 0,
      attackCooldown: attackCooldown,
      combatStartTime: Date.now() // Timestamp di inizio combattimento
    });

    ServerLoggerWrapper.combat(`Combat session started: ${sessionId} for player ${playerId} vs ${npcId}`);
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
   * Pulisce i cooldown di un NPC quando viene rimosso dal mondo
   * @param {string} npcId - ID dell'NPC da rimuovere
   */
  cleanupNpcCooldown(npcId) {
    this.npcAttackCooldowns.delete(npcId);
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
      ServerLoggerWrapper.warn('COMBAT', `Player ${playerId} combat target removed: npcId=${combat.npcId}`);
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

    // 🔒 SECURITY: Cooldown fisso dal PLAYER_CONFIG (server-authoritative)
    // Il danno viene applicato secondo il cooldown configurato
    // L'animazione ritmica è gestita lato client (solo visiva)

    // ✅ FIX: Usa configurazione centralizzata dal PLAYER_CONFIG (single source of truth)
    const baseCooldown = combat.attackCooldown || PLAYER_CONFIG.stats.cooldown;
    const lastAttackTime = combat.lastAttackTime || 0;
    const timeSinceLastAttack = now - lastAttackTime;

    // ✅ FIX: Log di debug per identificare problemi di inizializzazione (solo con DEBUG_COMBAT)
    if (process.env.DEBUG_COMBAT === 'true') {
      // Combat state check logging removed for production - too verbose
    }

    if (timeSinceLastAttack < baseCooldown) {
      return; // Non ancora tempo di attaccare - il client non può forzare attacchi
    }

    // Esegui attacco (danno applicato secondo cooldown configurato)
    // Combat attack logging removed for production - too verbose
    this.performPlayerAttack(playerId, playerData, npc, now);
    combat.lastAttackTime = now;
  }

  /**
   * Esegue attacco deterministico (MMO style) - hit garantito
   * @param {string} ownerId - ID di chi spara (npcId)
   * @param {Object} ownerPosition - Posizione di chi spara {x, y}
   * @param {Object} targetPlayer - Player target (con clientId)
   * @param {number} damage - Danno del proiettile
   * @param {number} hitTime - Timestamp quando applicare il danno
   * @param {string} projectileType - Tipo di proiettile
   * @returns {string|null} ID del proiettile creato
   */
  performDeterministicAttack(ownerId, ownerPosition, targetPlayer, damage, hitTime, projectileType = 'scouter_laser') {
    // Crea proiettile homing VISUALE (non fisico)
    const projectileId = `${ownerId}_proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calcola direzione iniziale
    const dx = targetPlayer.position.x - ownerPosition.x;
    const dy = targetPlayer.position.y - ownerPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      return null; // Non sparare se posizioni coincidenti
    }

    // Normalizza direzione
    const directionX = dx / distance;
    const directionY = dy / distance;

    // Posizione di spawn
    const projectilePos = {
      x: ownerPosition.x + directionX * SERVER_CONSTANTS.PROJECTILE.SPAWN_OFFSET,
      y: ownerPosition.y + directionY * SERVER_CONSTANTS.PROJECTILE.SPAWN_OFFSET
    };

    // Velocità per movimento visivo (non fisica)
    const velocity = {
      x: directionX * SERVER_CONSTANTS.PROJECTILE.SPEED,
      y: directionY * SERVER_CONSTANTS.PROJECTILE.SPEED
    };

    try {
      // Crea proiettile con dati speciali per hit deterministico
      const projectileData = {
        id: projectileId,
        playerId: ownerId,
        position: projectilePos,
        velocity: velocity,
        damage: damage,
        projectileType: projectileType,
        targetId: targetPlayer.clientId, // Target per homing visivo
        hitTime: hitTime, // Quando applicare il danno (deterministico)
        isDeterministic: true, // Flag per identificare proiettili deterministici
        createdAt: Date.now(),
        lastUpdate: Date.now()
      };

      this.mapServer.projectileManager.projectiles.set(projectileId, projectileData);

      // Broadcast ai client (NPC projectiles are excluded from sender)
      const excludeSender = true; // NPC projectiles not visible to themselves
      this.mapServer.projectileManager.broadcaster.broadcastProjectileFired(projectileData, excludeSender, damage);

      return projectileId;
    } catch (error) {
      ServerLoggerWrapper.error('COMBAT', `Failed to create deterministic projectile ${projectileId}: ${error.message}`);
      return null;
    }
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
      ServerLoggerWrapper.error('COMBAT', `Failed to add projectile ${projectileId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Esegue attacco del player contro NPC
   * @returns {string|null} ID del proiettile creato
   */
  performPlayerAttack(playerId, playerData, npc, now) {
    // DEBUG: Log quando il player spara
    // Combat tick logging removed for production - too verbose

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
    // NPC attacca SOLO se è in modalità aggressive (non appena un player entra nel range)
    if (npc.behavior !== 'aggressive') {
      return; // Non attaccare se non è aggressivo
    }

    // Per proiettili deterministici, permettiamo multipli proiettili attivi
    // dato che ogni colpo è garantito e non ci sono collisioni fisiche

    // Controlla cooldown attacco
    const lastAttack = this.npcAttackCooldowns.get(npc.id) || 0;
    const cooldown = NPC_CONFIG[npc.type].stats.cooldown || 2000; // Fallback ragionevole per NPC
    if (now - lastAttack < cooldown) {
      if (process.env.DEBUG_COMBAT === 'true') {
        console.log(`[NPC ${npc.id}] Non attacca: cooldown attivo. lastAttack=${lastAttack}, cooldown=${cooldown}, now=${now}`);
      }
      return;
    }

    // Trova player nel raggio di attacco
    const attackRange = NPC_CONFIG[npc.type].stats.range;
    const attackRangeSq = attackRange * attackRange;

    let targetPlayer = null;

    // PRIORITÀ 1: L'ultimo attaccante (Retaliation)
    if (npc.lastAttackerId) {
      const attackerData = this.mapServer.players.get(npc.lastAttackerId);
      if (attackerData && attackerData.position) {
        const dx = attackerData.position.x - npc.position.x;
        const dy = attackerData.position.y - npc.position.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= attackRangeSq) {
          targetPlayer = attackerData;
        }
      }
    }

    // PRIORITÀ 2: Se l'ultimo attaccante non è più nel range, cerca il più vicino
    if (!targetPlayer) {
      let minDistanceSq = Infinity;
      for (const [clientId, playerData] of this.mapServer.players.entries()) {
        if (!playerData.position) continue;
        const dx = playerData.position.x - npc.position.x;
        const dy = playerData.position.y - npc.position.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= attackRangeSq && distSq < minDistanceSq) {
          minDistanceSq = distSq;
          targetPlayer = playerData;
        }
      }
    }

    if (targetPlayer) {
      // Player nel range E NPC è aggressivo - NPC attacca
      if (process.env.DEBUG_COMBAT === 'true') {
        const dx = targetPlayer.position.x - npc.position.x;
        const dy = targetPlayer.position.y - npc.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        console.log(`[NPC ${npc.id}] Attacca player ${targetPlayer.clientId} nel range (comportamento: ${npc.behavior}). Distanza: ${dist.toFixed(1)}`);
      }
      this.performNpcAttack(npc, targetPlayer, now);
    }
  }

  /**
   * Esegue un attacco NPC contro un player
   */
  performNpcAttack(npc, targetPlayer, now) {
    // Verifica posizioni valide
    if (!Number.isFinite(npc.position.x) || !Number.isFinite(npc.position.y)) {
      ServerLoggerWrapper.error('COMBAT', `NPC ${npc.id} has INVALID position! x=${npc.position.x}, y=${npc.position.y}. SKIPPING ATTACK`);
      return;
    }

    if (!targetPlayer.position || !Number.isFinite(targetPlayer.position.x) || !Number.isFinite(targetPlayer.position.y)) {
      ServerLoggerWrapper.error('COMBAT', `Invalid player position for NPC ${npc.id} attack`);
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

    // HIT DETERMINISTICO (MMO Style): Il colpo è deciso ora, non al momento dell'impatto
    const hitTime = now + 600; // 600ms di viaggio del proiettile (tempo fisso)

    // Crea proiettile homing con hit garantito
    const projectileId = this.performDeterministicAttack(
      npc.id,
      npc.position,
      targetPlayer,
      damage,
      hitTime,
      'scouter_laser'
    );

    // Aggiorna cooldown sempre quando l'NPC prova ad attaccare (indipendentemente dal successo)
    this.npcAttackCooldowns.set(npc.id, now);

    if (process.env.DEBUG_COMBAT === 'true') {
      if (projectileId) {
        console.log(`[NPC ${npc.id}] Attacco deterministico riuscito contro ${targetPlayer.clientId}. Projectile: ${projectileId}, hitTime: ${hitTime}`);
      } else {
        console.log(`[NPC ${npc.id}] Attacco fallito contro ${targetPlayer.clientId} - proiettile non creato`);
      }
    }
  }
}

module.exports = ServerCombatManager;
