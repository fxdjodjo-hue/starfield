// ServerCombatManager - Gestione centralizzata del combat lato server
// Dipendenze consentite: logger.cjs, config/constants.cjs, core/combat/DamageCalculationSystem.cjs

const { logger } = require('../logger.cjs');
const ServerLoggerWrapper = require('../core/infrastructure/ServerLoggerWrapper.cjs');
const { SERVER_CONSTANTS, NPC_CONFIG } = require('../config/constants.cjs');
const DamageCalculationSystem = require('../core/combat/DamageCalculationSystem.cjs');
const PLAYER_CONFIG = require('../../shared/player-config.json');
const { getEffectivePlayerPosition } = require('../core/map/PlayerPositionResolver.cjs');

class ServerCombatManager {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.npcAttackCooldowns = new Map(); // npcId -> lastAttackTime
    this.playerCombats = new Map(); // playerId -> { npcId, lastAttackTime, attackCooldown }
    this.combatStartCooldowns = new Map(); // playerId -> lastCombatStartTime
  }

  /**
   * Verifica se una posizione si trova all'interno di una Safe Zone
   * @param {object} position - {x, y}
   * @returns {boolean}
   */
  isInSafeZone(position) {
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return false;

    for (const zone of SERVER_CONSTANTS.SAFE_ZONES) {
      const dx = position.x - zone.x;
      const dy = position.y - zone.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= zone.radius * zone.radius) {
        return true;
      }
    }
    return false;
  }

  /**
   * Lock target ownership when combat starts so NPC reacts immediately.
   * Keeps an existing lock if another player already owns this NPC.
   */
  lockNpcTargetOnCombatStart(npc, playerId, now) {
    if (!npc || !npc.position) return;

    const existingOwner = npc.lastAttackerId ? String(npc.lastAttackerId) : null;
    if (existingOwner && existingOwner !== playerId) {
      return;
    }

    const playerData = this.mapServer.players.get(playerId);
    if (!playerData || !playerData.position) return;

    npc.lastAttackerId = playerId;
    npc.lastDamage = now;
    npc.behavior = 'aggressive';

    const targetPos = getEffectivePlayerPosition(playerData, now) || playerData.position;
    const dx = targetPos.x - npc.position.x;
    const dy = targetPos.y - npc.position.y;
    if (Number.isFinite(dx) && Number.isFinite(dy) && (dx !== 0 || dy !== 0)) {
      npc.position.rotation = Math.atan2(dy, dx);
    }
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
    const combatPlayerId = String(playerId);

    // 🚫 BLOCCA combat senza target valido
    if (!npcId) {
      ServerLoggerWrapper.warn('COMBAT', `Player ${combatPlayerId} tried to start combat with null/invalid npcId`);
      return; // Non creare il combat
    }

    // 🔒 SECURITY: Anti-spam - previene spam di start_combat per bypassare cooldown
    const now = Date.now();
    const lastCombatStart = this.combatStartCooldowns.get(combatPlayerId) || 0;
    const minTimeBetweenStarts = 500; // 500ms tra avvii combattimento

    if (now - lastCombatStart < minTimeBetweenStarts) {
      // Ignora richieste troppo frequenti
      return;
    }

    // ✅ Verifica sempre che l'NPC esista prima di creare qualsiasi combat
    const existingNpc = this.mapServer.npcManager.getNpc(npcId);
    if (!existingNpc) {
      ServerLoggerWrapper.warn('COMBAT', `Player ${combatPlayerId} tried to start combat with non-existing NPC ${npcId}`);
      return;
    }

    // 🛡️ SAFE ZONE CHECK - REMOVED: Allow player to start combat ANYWHERE
    /*
    const playerData = this.mapServer.players.get(playerId);
    if (playerData && (this.isInSafeZone(playerData.position) || this.isInSafeZone(existingNpc.position))) {
      if (context && context.ws) {
        context.ws.send(JSON.stringify({
          type: 'combat_error',
          message: 'Combat is disabled in Safe Zones',
          code: 'SAFE_ZONE_PROTECTION'
        }));
      }
      return;
    }
    */

    this.lockNpcTargetOnCombatStart(existingNpc, combatPlayerId, now);
    ServerLoggerWrapper.combat(`Start combat: ${combatPlayerId} vs ${npcId}`);

    // 🚫 COMBAT SESSION SECURITY: Un solo combattimento attivo per player alla volta
    if (this.playerCombats.has(combatPlayerId)) {
      const existingCombat = this.playerCombats.get(combatPlayerId);
      ServerLoggerWrapper.combat(`🚫 BLOCKED: Player ${combatPlayerId} attempted multiple combat sessions. Active session: ${existingCombat.sessionId}, attempted vs ${npcId}`);

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
    this.combatStartCooldowns.set(combatPlayerId, now);

    // Ottieni cooldown dalla configurazione player (coerente con client)
    const attackCooldown = PLAYER_CONFIG.stats.cooldown;

    // Genera session ID univoco per questo combattimento
    const sessionId = `combat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Imposta combattimento attivo con session ID
    this.playerCombats.set(combatPlayerId, {
      sessionId: sessionId,
      npcId: npcId,
      lastAttackTime: 0,
      lastMissileTime: Date.now(), // NEW: Start cooldown immediately to prevent instant fire
      attackCooldown: attackCooldown,
      combatStartTime: Date.now(), // Timestamp di inizio combattimento
      outOfRangeSince: 0
    });

    ServerLoggerWrapper.combat(`Combat session started: ${sessionId} for player ${combatPlayerId} vs ${npcId}`);
  }

  /**
   * Ferma combattimento player
   */
  stopPlayerCombat(playerId) {
    const combatPlayerId = String(playerId);

    if (this.playerCombats.has(combatPlayerId)) {
      this.playerCombats.delete(combatPlayerId);

      // Remove temporary cooldown entry to avoid start/stop spam buildup
      this.combatStartCooldowns.delete(combatPlayerId);

      // Notify repair manager that combat ended
      if (this.mapServer.repairManager && typeof this.mapServer.repairManager.onCombatEnded === 'function') {
        this.mapServer.repairManager.onCombatEnded(combatPlayerId);
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

    // 🛡️ SAFE ZONE CHECK - REMOVED: Allow player to attack ANYWHERE
    /*
    if (this.isInSafeZone(playerData.position) || this.isInSafeZone(npc.position)) {
      this.playerCombats.delete(playerId);
      if (playerData.ws) {
        playerData.ws.send(JSON.stringify({
          type: 'stop_combat',
          reason: 'safe_zone',
          playerId: playerId
        }));
      }
      return;
    }
    */

    // Verifica che il player abbia una posizione
    if (!playerData.position) {
      return;
    }

    const effectivePlayerPos = getEffectivePlayerPosition(playerData, now) || playerData.position;
    const effectivePx = effectivePlayerPos.x;
    const effectivePy = effectivePlayerPos.y;

    // Validazione posizione player
    if (!Number.isFinite(effectivePx) || !Number.isFinite(effectivePy)) {
      return;
    }

    // Verifica che il player sia nel range rettangolare
    const rangeWidth = SERVER_CONSTANTS.COMBAT.PLAYER_RANGE_WIDTH;
    const rangeHeight = SERVER_CONSTANTS.COMBAT.PLAYER_RANGE_HEIGHT;

    const serverDx = Math.abs(playerData.position.x - npc.position.x);
    const serverDy = Math.abs(playerData.position.y - npc.position.y);
    const effectiveDx = Math.abs(effectivePx - npc.position.x);
    const effectiveDy = Math.abs(effectivePy - npc.position.y);
    const inRange = effectiveDx <= rangeWidth / 2 && effectiveDy <= rangeHeight / 2;

    if (!inRange) {
      // Grace window per evitare stop/start oscillanti dovuti a jitter di sincronizzazione.
      if (!combat.outOfRangeSince) {
        combat.outOfRangeSince = now;
      }

      const OUT_OF_RANGE_GRACE_MS = 1200;
      if (now - combat.outOfRangeSince < OUT_OF_RANGE_GRACE_MS) {
        return;
      }

      this.playerCombats.delete(playerId);

      // Notifica repair manager che il combattimento è terminato
      if (this.mapServer.repairManager && typeof this.mapServer.repairManager.onCombatEnded === 'function') {
        this.mapServer.repairManager.onCombatEnded(playerId);
      }

      if (process.env.DEBUG_COMBAT === 'true') {
        ServerLoggerWrapper.combat(
          `STOP_COMBAT out_of_range player=${playerId} npc=${npc.id} source=${effectivePlayerPos.source || 'server'} serverDx=${Math.round(serverDx)} serverDy=${Math.round(serverDy)} effectiveDx=${Math.round(effectiveDx)} effectiveDy=${Math.round(effectiveDy)}`
        );
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

    combat.outOfRangeSince = 0;

    const dx = Math.abs(effectivePx - npc.position.x);
    const dy = Math.abs(effectivePy - npc.position.y);

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
    this.performPlayerAttack(playerId, playerData, npc, now, {
      x: effectivePx,
      y: effectivePy,
      rotation: playerData.position?.rotation || playerData.rotation || 0
    });
    combat.lastAttackTime = now;

    // 🚀 AUTO-FIRE MISSILES
    // Controlla cooldown missili (indipendente dal laser)
    const missileCooldown = PLAYER_CONFIG.stats.missileCooldown || 3000;
    const lastMissileTime = combat.lastMissileTime || 0;

    if (now - lastMissileTime >= missileCooldown) {
      // 🚀 PREDICTIVE MISSILE LOGIC: Lancio un missile solo se il target sopravviverà abbastanza a lungo

      // 1. Calcola DPS stimato dei laser (Danno / Cooldown)
      const laserDamage = DamageCalculationSystem.calculatePlayerDamage(
        DamageCalculationSystem.getBasePlayerDamage(),
        playerData.upgrades
      );
      const laserCooldownSec = (PLAYER_CONFIG.stats.cooldown || 1500) / 1000;
      const laserDps = laserDamage / laserCooldownSec;

      // 2. Calcola tempo alla morte (TTD)
      const targetTotalHealth = npc.health + npc.shield;
      const timeToDeath = targetTotalHealth / laserDps;

      // 3. Calcola tempo di arrivo del missile (Distanza / Velocità + Buffer)
      const dist = Math.sqrt(dx * dx + dy * dy);
      const missileSpeed = SERVER_CONSTANTS.PROJECTILE.MISSILE_SPEED || 300;
      const arrivalTime = (dist / missileSpeed) + 0.5; // 0.5s buffer di sicurezza

      // 4. Fuoco solo se TTD > arrivalTime
      if (timeToDeath > arrivalTime) {
        this.performPlayerMissileAttack(playerId, playerData, npc, now, {
          x: effectivePx,
          y: effectivePy,
          rotation: playerData.position?.rotation || playerData.rotation || 0
        });
        combat.lastMissileTime = now;
      }
    }
  }

  /**
   * Esegue attacco missile automatico del player
   */
  performPlayerMissileAttack(playerId, playerData, npc, now, attackOrigin = null) {
    // Calcola danno missili: Base + Bonus Upgrades
    // Nota: I missili scalano con missileDamageUpgrades, non weaponDamageUpgrades
    const baseMissileDamage = PLAYER_CONFIG.stats.missileDamage || 100;

    // Calcolo bonus upgrade (simile a DamageCalculationSystem ma specifico per missili)
    let upgradeMultiplier = 1.0;
    if (playerData.upgrades && playerData.upgrades.missileDamageUpgrades) {
      upgradeMultiplier += (playerData.upgrades.missileDamageUpgrades * 0.05);
    }

    let itemMultiplier = 1.0;
    // 🚀 FIX: Aggiungi bonus dagli item equipaggiati per i missili
    if (playerData.items && Array.isArray(playerData.items)) {
      const itemConfig = require('../../shared/item-config.json');
      const ITEM_REGISTRY = itemConfig.ITEM_REGISTRY;

      const equippedMissileItem = playerData.items.find(i => i.slot === 'MISSILE');
      if (equippedMissileItem) {
        const itemDef = ITEM_REGISTRY[equippedMissileItem.id];
        if (itemDef?.stats?.missileBonus) {
          itemMultiplier += itemDef.stats.missileBonus;
        }
      }
    }

    const damage = Math.floor(baseMissileDamage * upgradeMultiplier * itemMultiplier);

    // Usa la stessa posizione effettiva del loop combat per evitare dual source durante jitter.
    const playerPos = attackOrigin || playerData.position;

    // Crea proiettile missile (FISICO, non deterministico)
    // Usiamo la logica standard dei laser ma con tipo 'missile' e target specifico per homing
    const projectileId = this.performAttack(
      playerId,              // ownerId
      playerPos,             // ownerPosition
      npc.position,          // targetPosition
      damage,                // damage
      'missile',             // projectileType
      npc.id                 // targetId (abilita homing nel ProjectilePhysics)
    );

    if (process.env.DEBUG_COMBAT === 'true' && projectileId) {
      console.log(`[PLAYER ${playerId}] Fired physics missile at NPC ${npc.id}. Damage: ${damage}`);
    }

    return projectileId;
  }

  /**
   * Esegue attacco deterministico (MMO style) - hit garantito
   * @param {string} ownerId - ID di chi spara (npcId)
   * @param {Object} ownerPosition - Posizione di chi spara {x, y}
   * @param {Object} targetPlayer - Player target (con clientId) o NPC target (con id)
   * @param {number} damage - Danno del proiettile
   * @param {number} hitTime - Timestamp quando applicare il danno
   * @param {string} projectileType - Tipo di proiettile
   * @returns {string|null} ID del proiettile creato
   */
  performDeterministicAttack(ownerId, ownerPosition, target, damage, hitTime, projectileType = 'scouter_laser') {
    // Crea proiettile homing VISUALE (non fisico)
    const projectileId = `${ownerId}_proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calcola direzione iniziale
    const dx = target.position.x - ownerPosition.x;
    const dy = target.position.y - ownerPosition.y;
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
        damage: damage,
        projectileType: projectileType,
        targetId: target.clientId || target.id, // Target per homing visivo (supporta sia Player che NPC)
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
    const speed = projectileType === 'missile' ? SERVER_CONSTANTS.PROJECTILE.MISSILE_SPEED : SERVER_CONSTANTS.PROJECTILE.SPEED;

    const velocity = {
      x: directionX * speed,
      y: directionY * speed
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
  performPlayerAttack(playerId, playerData, npc, now, attackOrigin = null) {
    // DEBUG: Log quando il player spara
    // Combat tick logging removed for production - too verbose

    // Usa posizione corrente del player dal server (più affidabile)
    const playerPos = attackOrigin || playerData.position;

    // Calcola danno usando DamageCalculationSystem (logica di gioco)
    const baseDamage = DamageCalculationSystem.getBasePlayerDamage();
    const calculatedDamage = DamageCalculationSystem.calculatePlayerDamage(
      baseDamage,
      playerData.upgrades,
      playerData.items
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

    // 🛡️ SAFE ZONE NPC CHECK: NPC non attacca se è in una zona sicura (tranne se è una ritorsione)
    const isRetaliationPossible = npc.lastAttackerId ? true : false;
    if (this.isInSafeZone(npc.position) && !isRetaliationPossible) {
      return;
    }

    // Trova player nel raggio di attacco (solo chi ha targhettato questo NPC)
    const attackRange = NPC_CONFIG[npc.type].stats.range;
    const attackRangeSq = attackRange * attackRange;

    const lastAttackerId = npc.lastAttackerId ? String(npc.lastAttackerId) : null;
    let targetPlayer = null;
    let newestCombatTime = -Infinity;

    // PRIORITÀ 1: L'ultimo attaccante, ma solo se sta davvero targhettando questo NPC
    if (lastAttackerId) {
      const lastCombat = this.playerCombats.get(lastAttackerId);
      if (lastCombat && lastCombat.npcId === npc.id) {
        const attackerData = this.mapServer.players.get(lastAttackerId);
        if (attackerData && attackerData.position && !attackerData.isDead) {
          const attackerPos = getEffectivePlayerPosition(attackerData, now) || attackerData.position;
          // RETALIATION: Permetti attacco anche in Safe Zone se è l'aggressore
          const dx = attackerPos.x - npc.position.x;
          const dy = attackerPos.y - npc.position.y;
          const distSq = dx * dx + dy * dy;

          if (distSq <= attackRangeSq) {
            targetPlayer = attackerData;
          }
        }
      }
    }

    // PRIORITÀ 2: Solo player con combat attivo su questo NPC (no nearest globale)
    if (!targetPlayer) {
      for (const [clientId, combat] of this.playerCombats.entries()) {
        if (!combat || combat.npcId !== npc.id) continue;

        const playerData = this.mapServer.players.get(clientId);
        if (!playerData || playerData.isDead || !playerData.position) continue;

        const targetPos = getEffectivePlayerPosition(playerData, now) || playerData.position;

        // SAFE ZONE CHECK: Non agganciare player in Safe Zone (tranne ritorsione)
        if (this.isInSafeZone(targetPos)) continue;

        const dx = targetPos.x - npc.position.x;
        const dy = targetPos.y - npc.position.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > attackRangeSq) continue;

        const combatStartTime = combat.combatStartTime || 0;
        if (combatStartTime >= newestCombatTime) {
          newestCombatTime = combatStartTime;
          targetPlayer = playerData;
        }
      }
    }

    if (targetPlayer) {
      // Player nel range E NPC è aggressivo - NPC attacca
      if (process.env.DEBUG_COMBAT === 'true') {
        const targetPos = getEffectivePlayerPosition(targetPlayer, now) || targetPlayer.position;
        const dx = targetPos.x - npc.position.x;
        const dy = targetPos.y - npc.position.y;
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

    const effectiveTargetPos = getEffectivePlayerPosition(targetPlayer, now) || targetPlayer.position;
    if (!Number.isFinite(effectiveTargetPos.x) || !Number.isFinite(effectiveTargetPos.y)) {
      return;
    }

    // 🛡️ FINAL SAFE ZONE SECURITY CHECK
    // Permetti l'attacco se è una ritorsione (lastAttackerId), altrimenti blocca se in Safe Zone
    // 🚀 RETALIATION bypassa completamente la protezione della Safe Zone (sia per NPC che per Player)
    const lastAttackerId = npc.lastAttackerId ? String(npc.lastAttackerId) : null;
    const targetClientId = targetPlayer.clientId ? String(targetPlayer.clientId) : null;
    const isRetaliation = lastAttackerId === targetClientId;

    if (!isRetaliation && (this.isInSafeZone(npc.position) || this.isInSafeZone(effectiveTargetPos))) {
      return;
    }

    // Calcola direzione e distanza
    const dx = effectiveTargetPos.x - npc.position.x;
    const dy = effectiveTargetPos.y - npc.position.y;
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
    const targetForProjectile = {
      ...targetPlayer,
      position: {
        x: effectiveTargetPos.x,
        y: effectiveTargetPos.y
      }
    };

    const projectileId = this.performDeterministicAttack(
      npc.id,
      npc.position,
      targetForProjectile,
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
