// ServerCombatManager - Gestione centralizzata del combat lato server
// Dipendenze consentite: logger.cjs, config/constants.cjs, core/combat/DamageCalculationSystem.cjs

const { logger } = require('../logger.cjs');
const { SERVER_CONSTANTS, NPC_CONFIG } = require('../config/constants.cjs');
const DamageCalculationSystem = require('../core/combat/DamageCalculationSystem.cjs');

class ServerCombatManager {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.npcAttackCooldowns = new Map(); // npcId -> lastAttackTime
    this.playerCombats = new Map(); // playerId -> { npcId, lastAttackTime, attackCooldown, useFastInterval }
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
    logger.info('COMBAT', `Start combat: ${playerId} vs ${npcId || 'no-target'}`);

    // 🔒 SECURITY: Anti-spam - previene spam di start_combat per bypassare cooldown
    const now = Date.now();
    const lastCombatStart = this.combatStartCooldowns.get(playerId) || 0;
    const minTimeBetweenStarts = 500; // 500ms tra avvii combattimento

    if (now - lastCombatStart < minTimeBetweenStarts) {
      // Ignora richieste troppo frequenti
      return;
    }

    // Se il player sta già combattendo, non fare nulla
    if (this.playerCombats.has(playerId)) {
      return;
    }

    // Registra il timestamp dell'avvio combattimento
    this.combatStartCooldowns.set(playerId, now);

    // Se npcId è null, crea uno stato di combattimento senza target specifico
    if (!npcId) {
      this.playerCombats.set(playerId, {
        npcId: null,
        startTime: now,
        lastActivity: now
      });
      return;
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
  }

  /**
   * Ferma combattimento player
   */
  stopPlayerCombat(playerId) {
    if (this.playerCombats.has(playerId)) {
      this.playerCombats.delete(playerId);
      
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
    const baseCooldown = combat.attackCooldown; // 800ms dal config (server-authoritative)
    
    const timeSinceLastAttack = now - combat.lastAttackTime;
    if (timeSinceLastAttack < baseCooldown) {
      return; // Non ancora tempo di attaccare - il client non può forzare attacchi
    }

    // Esegui attacco (danno applicato ogni 800ms)
    this.performPlayerAttack(playerId, playerData, npc, now);
    combat.lastAttackTime = now;
  }

  /**
   * Esegue attacco del player contro NPC
   * @returns {string|null} ID del proiettile creato
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

    // Calcola danno usando DamageCalculationSystem (logica di gioco)
    const baseDamage = DamageCalculationSystem.getBasePlayerDamage();
    const calculatedDamage = DamageCalculationSystem.calculatePlayerDamage(
      baseDamage,
      playerData.upgrades
    );

    // Registra proiettile (broadcast immediato - animazione ritmica gestita lato client)
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
    
    return projectileId;
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

    // Calcola direzione diretta verso la posizione CORRENTE del player
    // Verifica che la posizione del player sia valida
    if (!targetPlayer.position || !Number.isFinite(targetPlayer.position.x) || !Number.isFinite(targetPlayer.position.y)) {
      console.error(`❌ [SERVER] Invalid player position for NPC ${npc.id} attack`);
      return;
    }
    
    const dx = targetPlayer.position.x - npcPosition.x;
    const dy = targetPlayer.position.y - npcPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Se la distanza è 0 o troppo piccola, non sparare
    if (distance < 10) {
      return;
    }
    
    const angle = Math.atan2(dy, dx);

    // Ruota NPC verso il target (stesso sistema del player)
    npc.position.rotation = angle;

    // Crea proiettile NPC
    const projectileId = `npc_proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Posizione con offset per evitare di colpire immediatamente l'NPC stesso - USA SNAPSHOT
    const spawnOffset = SERVER_CONSTANTS.PROJECTILE.SPAWN_OFFSET;
    const projectilePos = {
      x: npcPosition.x + Math.cos(angle) * spawnOffset,
      y: npcPosition.y + Math.sin(angle) * spawnOffset
    };

    // TEST: Usa velocità player invece di NPC_SPEED
    const velocity = {
      x: Math.cos(angle) * SERVER_CONSTANTS.PROJECTILE.SPEED,
      y: Math.sin(angle) * SERVER_CONSTANTS.PROJECTILE.SPEED
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
