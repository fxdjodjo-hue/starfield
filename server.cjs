const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Carica configurazione NPC condivisa
const npcConfigPath = path.join(__dirname, 'shared', 'npc-config.json');
const NPC_CONFIG = JSON.parse(fs.readFileSync(npcConfigPath, 'utf8'));

// Carica costanti server
const SERVER_CONSTANTS = require('./server/server-constants.cjs');

// ServerNpcManager - Gestione centralizzata degli NPC
class ServerNpcManager {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.npcs = new Map();
    this.npcIdCounter = 0;

    // Usa le dimensioni dalla mappa
    this.WORLD_WIDTH = mapServer.WORLD_WIDTH;
    this.WORLD_HEIGHT = mapServer.WORLD_HEIGHT;
    this.WORLD_LEFT = -this.WORLD_WIDTH / 2;
    this.WORLD_RIGHT = this.WORLD_WIDTH / 2;
    this.WORLD_TOP = -this.WORLD_HEIGHT / 2;
    this.WORLD_BOTTOM = this.WORLD_HEIGHT / 2;
  }

  /**
   * Crea un nuovo NPC nel mondo
   */
  createNpc(type, x, y) {
    const npcId = `npc_${this.npcIdCounter++}`;

    // Se non specificate, genera posizioni casuali ENTRO i confini del mondo
    const finalX = x ?? (Math.random() * (this.WORLD_RIGHT - this.WORLD_LEFT) + this.WORLD_LEFT);
    const finalY = y ?? (Math.random() * (this.WORLD_BOTTOM - this.WORLD_TOP) + this.WORLD_TOP);

    // Statistiche base per tipo dal config condiviso
    const stats = NPC_CONFIG[type].stats;

    const npc = {
      id: npcId,
      type,
      position: { x: finalX, y: finalY, rotation: Math.random() * Math.PI * 2 },
      velocity: {
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 200
      },
      health: stats.health,
      maxHealth: stats.health,
      shield: stats.shield,
      maxShield: stats.shield,
      damage: stats.damage, // Aggiungi danno per combat
      lastBounce: 0, // Timestamp dell'ultimo rimbalzo ai confini
      behavior: 'cruise',
      lastUpdate: Date.now(),
      lastSignificantMove: 0, // Non è stato ancora trasmesso, impostiamo a 0
      lastDamage: 0 // Non danneggiato ancora
    };

    // Tutti gli NPC ora hanno comportamento normale (cruise)
    // Non ci sono più NPC aggressivi automatici

    this.npcs.set(npcId, npc);
    console.log(`🆕 [SERVER] Created NPC ${npcId} (${type}) at (${finalX.toFixed(0)}, ${finalY.toFixed(0)}) [${npc.behavior}]`);

    return npcId;
  }

  /**
   * Aggiorna lo stato di un NPC
   */
  updateNpc(npcId, updates) {
    const npc = this.npcs.get(npcId);
    if (!npc) {
      console.warn(`[SERVER] Attempted to update non-existent NPC: ${npcId}`);
      return;
    }

    // Controlla se ci sono movimenti significativi
    const hasSignificantMovement = updates.position &&
      (Math.abs(updates.position.x - npc.position.x) > 5 ||
       Math.abs(updates.position.y - npc.position.y) > 5);

    Object.assign(npc, updates);
    npc.lastUpdate = Date.now();

    if (hasSignificantMovement) {
      npc.lastSignificantMove = Date.now();
    }
  }

  /**
   * Ottiene lo stato di un NPC specifico
   */
  getNpc(npcId) {
    return this.npcs.get(npcId);
  }

  /**
   * Ottiene tutti gli NPC
   */
  getAllNpcs() {
    return Array.from(this.npcs.values());
  }

  /**
   * Ottiene NPC che si sono mossi significativamente dall'ultimo controllo
   */
  getNpcsNeedingUpdate(since) {
    return this.getAllNpcs().filter(npc => npc.lastSignificantMove > since);
  }

  /**
   * Applica danno a un NPC
   */
  damageNpc(npcId, damage, attackerId) {
    const npc = this.npcs.get(npcId);
    if (!npc) return false;

    // Prima danneggia lo scudo
    if (npc.shield > 0) {
      const shieldDamage = Math.min(damage, npc.shield);
      npc.shield -= shieldDamage;
      damage -= shieldDamage;
    }

    // Poi danneggia la salute
    if (damage > 0) {
      npc.health = Math.max(0, npc.health - damage);
    }

    npc.lastUpdate = Date.now();
    npc.lastDamage = Date.now(); // Traccia quando è stato danneggiato

    console.log(`💥 [SERVER] NPC ${npcId} damaged: ${npc.health}/${npc.maxHealth} HP, ${npc.shield}/${npc.maxShield} shield`);

    // Se morto, rimuovi l'NPC
    if (npc.health <= 0) {
      this.removeNpc(npcId);
      return true; // NPC morto
    }

    return false; // NPC sopravvissuto
  }

  /**
   * Applica danno a un giocatore (server authoritative)
   */
  damagePlayer(clientId, damage, attackerId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData || playerData.isDead) return false;

    // Prima danneggia lo scudo
    if (playerData.shield > 0) {
      const shieldDamage = Math.min(damage, playerData.shield);
      playerData.shield -= shieldDamage;
      damage -= shieldDamage;
    }

    // Poi danneggia la salute
    if (damage > 0) {
      playerData.health = Math.max(0, playerData.health - damage);
    }

    playerData.lastDamage = Date.now();

    console.log(`💥 [SERVER] Player ${clientId} damaged: ${playerData.health}/${playerData.maxHealth} HP, ${playerData.shield}/${playerData.maxShield} shield`);

    // Se morto, gestisci la morte
    if (playerData.health <= 0) {
      this.handlePlayerDeath(clientId, attackerId);
      return true; // Player morto
    }

    return false; // Player sopravvissuto
  }

  /**
   * Rimuove un NPC dal mondo
   */
  removeNpc(npcId) {
    const existed = this.npcs.delete(npcId);
    if (existed) {
      console.log(`💥 [SERVER] Removed NPC ${npcId}`);
    }
    return existed;
  }

  /**
   * Statistiche del manager
   */
  getStats() {
    const allNpcs = this.getAllNpcs();
    const scouters = allNpcs.filter(npc => npc.type === 'Scouter').length;
    const frigates = allNpcs.filter(npc => npc.type === 'Frigate').length;

    return {
      totalNpcs: allNpcs.length,
      scouters,
      frigates
    };
  }

  /**
   * Inizializza NPC del mondo (chiamato all'avvio del server)
   */
  initializeWorldNpcs(scouterCount = 25, frigateCount = 25) {
    console.log(`🌍 [SERVER] Initializing world NPCs: ${scouterCount} Scouters, ${frigateCount} Frigates`);

    // Distribuisci uniformemente gli NPC nel mondo
    for (let i = 0; i < scouterCount; i++) {
      this.createNpc('Scouter');
    }

    for (let i = 0; i < frigateCount; i++) {
      this.createNpc('Frigate');
    }

    const stats = this.getStats();
    console.log(`✅ [SERVER] World initialization complete: ${stats.totalNpcs} NPCs (${stats.scouters} Scouters, ${stats.frigates} Frigates)`);
  }
}

// Crea server WebSocket sulla porta 3000
const wss = new WebSocket.Server({ port: 3000 });
class ServerProjectileManager {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.projectiles = new Map(); // projectileId -> projectile data
    this.collisionChecks = new Map(); // clientId -> last collision check time
  }

  /**
   * Registra un nuovo proiettile sparato da un giocatore
   */
  addProjectile(projectileId, playerId, position, velocity, damage, projectileType = 'laser', targetId = null, excludeSender = true) {
    const projectile = {
      id: projectileId,
      playerId,
      position: { ...position },
      velocity: { ...velocity },
      damage,
      projectileType,
      targetId, // ID del bersaglio (per homing projectiles)
      createdAt: Date.now(),
      lastUpdate: Date.now()
    };

    this.projectiles.set(projectileId, projectile);
    console.log(`🚀 [SERVER] Projectile ${projectileId} added for player ${playerId}`);

    // Broadcast ai client - escludi il mittente solo se richiesto
    const excludeClientId = excludeSender ? playerId : null;
    this.broadcastProjectileFired(projectile, excludeClientId);
  }

  /**
   * Aggiorna posizione di un proiettile
   */
  updateProjectile(projectileId, position) {
    const projectile = this.projectiles.get(projectileId);
    if (!projectile) return;

    projectile.position = { ...position };
    projectile.lastUpdate = Date.now();
  }

  /**
   * Rimuove un proiettile (distrutto o fuori schermo)
   */
  removeProjectile(projectileId, reason = 'unknown') {
    const projectile = this.projectiles.get(projectileId);
    if (!projectile) return;

    this.projectiles.delete(projectileId);
    console.log(`💥 [SERVER] Projectile ${projectileId} removed (${reason})`);

    // Broadcast distruzione a tutti i client
    this.broadcastProjectileDestroyed(projectileId, reason);
  }

  /**
   * Verifica collisioni tra proiettili e NPC/giocatori
   */
  checkCollisions() {
    const now = Date.now();
    const projectilesToRemove = [];

    for (const [projectileId, projectile] of this.projectiles.entries()) {
      // Simula movimento del proiettile (aggiorna posizione)
      const deltaTime = (now - projectile.lastUpdate) / 1000; // secondi
      projectile.position.x += projectile.velocity.x * deltaTime;
      projectile.position.y += projectile.velocity.y * deltaTime;
      projectile.lastUpdate = now;

      // Verifica collisioni con NPC
      const hitNpc = this.checkNpcCollision(projectile);
      if (hitNpc) {
        // Applica danno all'NPC
        const npcDead = this.mapServer.npcManager.damageNpc(hitNpc.id, projectile.damage, projectile.playerId);

        // Notifica danno
        this.broadcastEntityDamaged(hitNpc, projectile);

        // Se NPC morto, broadcast distruzione
        if (npcDead) {
          this.broadcastEntityDestroyed(hitNpc, projectile.playerId);
        }

        projectilesToRemove.push(projectileId);
        continue;
      }

      // Verifica collisioni con giocatori
      const hitPlayer = this.checkPlayerCollision(projectile);
      if (hitPlayer) {
        // Applica danno al giocatore
        const playerDead = this.damagePlayer(hitPlayer.clientId, projectile.damage, projectile.playerId);

        // Notifica danno
        this.broadcastEntityDamaged(hitPlayer.playerData, projectile, 'player');

        // Se giocatore morto, gestione già in damagePlayer
        if (playerDead) {
          console.log(`☠️ [SERVER] Player ${hitPlayer.clientId} killed by ${projectile.playerId}`);
        }

        projectilesToRemove.push(projectileId);
        continue;
      }

      // Verifica se proiettile è fuori dai confini del mondo
      if (this.isOutOfBounds(projectile.position)) {
        projectilesToRemove.push(projectileId);
        continue;
      }

      // Verifica timeout (proiettili troppo vecchi vengono rimossi)
      if (now - projectile.createdAt > 10000) { // 10 secondi
        projectilesToRemove.push(projectileId);
        continue;
      }
    }

    // Rimuovi proiettili distrutti
    projectilesToRemove.forEach(id => this.removeProjectile(id, 'collision'));
  }

  /**
   * Verifica collisione con NPC
   */
  checkNpcCollision(projectile) {
    const npcs = this.mapServer.npcManager.getAllNpcs();
    for (const npc of npcs) {
      const distance = Math.sqrt(
        Math.pow(projectile.position.x - npc.position.x, 2) +
        Math.pow(projectile.position.y - npc.position.y, 2)
      );

      // Collisione se distanza < 50 pixel (dimensione nave)
      if (distance < 50) {
        return npc;
      }
    }
    return null;
  }

  /**
   * Verifica collisione proiettile con giocatori
   */
  checkPlayerCollision(projectile) {
    for (const [clientId, playerData] of this.mapServer.players.entries()) {
      // Salta il giocatore che ha sparato il proiettile
      if (clientId === projectile.playerId) continue;

      // Salta giocatori morti o senza posizione
      if (!playerData.position || playerData.isDead) continue;

      const distance = Math.sqrt(
        Math.pow(projectile.position.x - playerData.position.x, 2) +
        Math.pow(projectile.position.y - playerData.position.y, 2)
      );

      // Collisione se distanza < 50 pixel (dimensione nave)
      if (distance < 50) {
        return { playerData, clientId };
      }
    }
    return null;
  }

  /**
   * Verifica se posizione è fuori dai confini del mondo
   */
  isOutOfBounds(position) {
    const worldSize = 25000; // Raggio del mondo
    return Math.abs(position.x) > worldSize || Math.abs(position.y) > worldSize;
  }

  /**
   * Broadcast creazione proiettile
   */
  broadcastProjectileFired(projectile, excludeClientId) {
    const message = {
      type: 'projectile_fired',
      projectileId: projectile.id,
      playerId: projectile.playerId,
      position: projectile.position,
      velocity: projectile.velocity,
      damage: projectile.damage,
      projectileType: projectile.projectileType,
      targetId: projectile.targetId
    };

    // Interest radius per proiettili
    this.mapServer.broadcastNear(projectile.position, SERVER_CONSTANTS.NETWORK.INTEREST_RADIUS, message, excludeClientId);
    console.log(`📡 [SERVER] Broadcast projectile ${projectile.id} from ${projectile.playerId} to clients (exclude: ${excludeClientId})`);
  }

  /**
   * Broadcast distruzione proiettile
   */
  broadcastProjectileDestroyed(projectileId, reason) {
    const projectile = this.projectiles.get(projectileId);
    if (!projectile) return;

    const message = {
      type: 'projectile_destroyed',
      projectileId,
      reason
    };

    // Interest radius per distruzione proiettili
    this.mapServer.broadcastNear(projectile.position, SERVER_CONSTANTS.NETWORK.INTEREST_RADIUS, message);
  }

  /**
   * Gestisce la morte di un giocatore
   */
  handlePlayerDeath(clientId, killerId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) return;

    console.log(`💀 [SERVER] Player ${clientId} died! Killer: ${killerId}`);

    playerData.isDead = true;
    playerData.respawnTime = Date.now() + 3000; // 3 secondi di respawn

    // Broadcast morte
    this.broadcastEntityDestroyed(playerData, killerId);

    // Respawn dopo delay
    setTimeout(() => {
      this.respawnPlayer(clientId);
    }, 3000);
  }

  /**
   * Fai respawnare un giocatore
   */
  respawnPlayer(clientId) {
    const playerData = this.mapServer.players.get(clientId);
    if (!playerData) return;

    // Reset stats
    playerData.health = playerData.maxHealth;
    playerData.shield = playerData.maxShield;
    playerData.isDead = false;
    playerData.respawnTime = null;

    // Spawn in posizione sicura (vicino al centro per ora)
    playerData.position = {
      x: (Math.random() - 0.5) * 1000, // ±500 dal centro
      y: (Math.random() - 0.5) * 1000
    };

    console.log(`🔄 [SERVER] Player ${clientId} respawned at (${playerData.position.x.toFixed(0)}, ${playerData.position.y.toFixed(0)})`);

    // Broadcast respawn
    this.broadcastPlayerRespawn(playerData);
  }

  /**
   * Broadcast danno a entità
   */
  broadcastEntityDamaged(entity, projectile, entityType = 'npc') {
    const message = {
      type: 'entity_damaged',
      entityId: entityType === 'npc' ? entity.id : entity.clientId,
      entityType: entityType,
      damage: projectile.damage,
      attackerId: projectile.playerId,
      newHealth: entity.health,
      newShield: entity.shield,
      position: entity.position
    };

    // Interest radius per danni
    this.mapServer.broadcastNear(entity.position, SERVER_CONSTANTS.NETWORK.INTEREST_RADIUS, message);
  }

  /**
   * Broadcast distruzione entità
   */
  broadcastEntityDestroyed(entity, destroyerId, entityType = 'npc') {
    const message = {
      type: 'entity_destroyed',
      entityId: entityType === 'npc' ? entity.id : entity.clientId,
      entityType: entityType,
      destroyerId,
      position: entity.position,
      rewards: entityType === 'npc' ? this.calculateRewards(entity) : undefined
    };

    // Interest radius: 2000 unità per distruzioni (più ampio per effetti visivi)
    this.mapServer.broadcastNear(entity.position, 2000, message);
  }

  /**
   * Broadcast respawn giocatore
   */
  broadcastPlayerRespawn(playerData) {
    const message = {
      type: 'player_respawn',
      clientId: playerData.clientId,
      position: playerData.position,
      health: playerData.health,
      maxHealth: playerData.maxHealth,
      shield: playerData.shield,
      maxShield: playerData.maxShield
    };

    // Broadcast a tutti i giocatori
    this.mapServer.broadcast(message);
  }

  /**
   * Calcola ricompense per distruzione NPC
   */
  calculateRewards(npc) {
    const baseRewards = {
      Scouter: { credits: 50, experience: 10, honor: 5 },
      Frigate: { credits: 100, experience: 20, honor: 10 }
    };

    return baseRewards[npc.type] || { credits: 25, experience: 5, honor: 2 };
  }


  /**
   * Statistiche proiettili attivi
   */
  getStats() {
    return {
      activeProjectiles: this.projectiles.size,
      projectilesByType: Array.from(this.projectiles.values()).reduce((acc, proj) => {
        acc[proj.projectileType] = (acc[proj.projectileType] || 0) + 1;
        return acc;
      }, {})
    };
  }
}

// Queue per aggiornamenti posizione per ridurre race conditions
const positionUpdateQueue = new Map(); // clientId -> Array di aggiornamenti
const PROCESS_INTERVAL = 50; // Processa aggiornamenti ogni 50ms

// Tick unificato MapServer (20 Hz - ogni 50ms)
setInterval(() => {
  mapServer.tick();
}, 50);

console.log('🚀 WebSocket server started on ws://localhost:3000');

// MapServer - Contesto per ogni mappa del gioco
class MapServer {
  constructor(mapId, config = {}) {
    this.mapId = mapId;

    // Dimensioni mappa (configurabili per mappe diverse)
    this.WORLD_WIDTH = config.WORLD_WIDTH || 21000;
    this.WORLD_HEIGHT = config.WORLD_HEIGHT || 13100;

    // Managers specifici della mappa
    this.npcManager = new ServerNpcManager(this);
    this.projectileManager = new ServerProjectileManager(this);

    // Players connessi a questa mappa
    this.players = new Map();

    // Configurazione NPC per questa mappa
    this.npcConfig = config.npcConfig || { scouterCount: 25, frigateCount: 25 };
  }

  // Inizializzazione della mappa
  initialize() {
    console.log(`🗺️ [MapServer:${this.mapId}] Initializing map...`);
    this.npcManager.initializeWorldNpcs(
      this.npcConfig.scouterCount,
      this.npcConfig.frigateCount
    );
  }

  // Gestione giocatori
  addPlayer(clientId, playerData) {
    this.players.set(clientId, playerData);
    console.log(`👤 [MapServer:${this.mapId}] Player ${clientId} joined map`);
  }

  removePlayer(clientId) {
    this.players.delete(clientId);
    console.log(`👋 [MapServer:${this.mapId}] Player ${clientId} left map`);
  }

  // Metodi delegati ai managers
  getAllNpcs() { return this.npcManager.getAllNpcs(); }
  getNpc(npcId) { return this.npcManager.getNpc(npcId); }
  createNpc(type, x, y) { return this.npcManager.createNpc(type, x, y); }

  // Tick unificato per la mappa (20 Hz)
  tick() {
    try {
      // 1. Movimento NPC
      updateNpcMovements();

      // 2. Logica di combat NPC (attacchi automatici)
      if (this.combatManager) {
        this.combatManager.updateCombat();
      }

      // 3. Collisioni proiettili
      this.projectileManager.checkCollisions();

      // 4. Broadcast aggiornamenti NPC significativi
      broadcastNpcUpdates();

      // 5. Processa aggiornamenti posizione giocatori
      processPositionUpdates();

    } catch (error) {
      console.error(`❌ [MapServer:${this.mapId}] Error in tick:`, error);
    }
  }

  // Broadcasting specifico della mappa
  broadcastToMap(message, excludeClientId = null) {
    const payload = JSON.stringify(message);

    for (const [clientId, playerData] of this.players.entries()) {
      if (excludeClientId && clientId === excludeClientId) continue;

      if (playerData.ws.readyState === WebSocket.OPEN) {
        playerData.ws.send(payload);
      }
    }
  }

  // Broadcasting con interest radius (solo giocatori entro il raggio)
  broadcastNear(position, radius, message, excludeClientId = null) {
    const payload = JSON.stringify(message);
    const radiusSq = radius * radius; // Evita sqrt per performance

    for (const [clientId, playerData] of this.players.entries()) {
      if (excludeClientId && clientId === excludeClientId) continue;
      if (!playerData.position || playerData.ws.readyState !== WebSocket.OPEN) continue;

      // Calcola distanza quadrata
      const dx = playerData.position.x - position.x;
      const dy = playerData.position.y - position.y;
      const distSq = dx * dx + dy * dy;

      // Invia solo se entro il raggio
      if (distSq <= radiusSq) {
        playerData.ws.send(payload);
      }
    }
  }
}

// ServerCombatManager - Gestione centralizzata del combat lato server
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

    // Processa combattimenti player
    this.processPlayerCombats(now);
  }

  /**
   * Inizia combattimento player contro NPC
   */
  startPlayerCombat(playerId, npcId) {
    console.log(`⚔️ [SERVER] startPlayerCombat called: ${playerId} vs ${npcId}`);

    // Se il player sta già combattendo un NPC diverso, ferma il combattimento precedente
    if (this.playerCombats.has(playerId)) {
      const existingCombat = this.playerCombats.get(playerId);
      if (existingCombat.npcId !== npcId) {
        console.log(`🔄 [SERVER] Player ${playerId} switching from NPC ${existingCombat.npcId} to ${npcId}, stopping previous combat`);
        this.playerCombats.delete(playerId);
        // Non chiamare stopPlayerCombat qui per evitare loop
      } else {
        console.log(`⚠️ [SERVER] Player ${playerId} already attacking NPC ${npcId}, ignoring duplicate request`);
        return;
      }
    }

    // Verifica che l'NPC esista
    const npc = this.mapServer.npcManager.getNpc(npcId);
    if (!npc) {
      console.warn(`⚠️ [SERVER] Cannot start combat: NPC ${npcId} not found`);
      return;
    }

    // Imposta combattimento attivo
    this.playerCombats.set(playerId, {
      npcId: npcId,
      lastAttackTime: 0,
      attackCooldown: 1000, // 1 sparo al secondo
      combatStartTime: Date.now() // Timestamp di inizio combattimento
    });
  }

  /**
   * Ferma combattimento player
   */
  stopPlayerCombat(playerId) {
    console.log(`🛑 [SERVER] Stopping player combat: ${playerId}`);

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

    // Periodo di grazia: non verificare range nei primi 2 secondi dopo inizio combattimento
    const timeSinceCombatStart = now - (combat.combatStartTime || 0);
    const inGracePeriod = timeSinceCombatStart < 2000; // 2 secondi di grazia

    if (!inGracePeriod && distance > SERVER_CONSTANTS.COMBAT.PLAYER_RANGE) { // Range del player
      console.log(`📏 [SERVER] Player ${playerId} out of range (${distance.toFixed(0)}) after ${timeSinceCombatStart}ms, stopping combat (was attacking NPC ${combat.npcId})`);
      this.playerCombats.delete(playerId);
      return;
    }

    if (inGracePeriod) {
      console.log(`🛡️ [SERVER] Player ${playerId} in grace period (${timeSinceCombatStart}ms), skipping range check`);
    }

    // Verifica cooldown
    if (now - combat.lastAttackTime < combat.attackCooldown) {
      // console.log(`⏰ [SERVER] Player ${playerId} cooling down (${((now - combat.lastAttackTime) / 1000).toFixed(1)}s / ${(combat.attackCooldown / 1000).toFixed(1)}s)`);
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

    // Calcola direzione dal player all'NPC
    const dx = npc.position.x - playerData.position.x;
    const dy = npc.position.y - playerData.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return;

    const directionX = dx / distance;
    const directionY = dy / distance;

    // Crea proiettile singolo (per semplicità, non dual laser per ora)
    const projectileId = `player_proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const speed = SERVER_CONSTANTS.PROJECTILE.SPEED;

    const velocity = {
      x: directionX * speed,
      y: directionY * speed
    };

    // Posizione leggermente avanti al player
    const offset = SERVER_CONSTANTS.PROJECTILE.SPAWN_OFFSET;
    const projectilePos = {
      x: playerData.position.x + directionX * offset,
      y: playerData.position.y + directionY * offset
    };

    // Registra proiettile
    this.mapServer.projectileManager.addProjectile(
      projectileId,
      playerId,
      projectilePos,
      velocity,
      500, // damage
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
    console.log(`🚫 [SERVER] NPC ${npc.id} trying to attack - THIS SHOULD NOT HAPPEN!`);
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

    // Posizione leggermente avanti all'NPC nella direzione del proiettile
    const offset = SERVER_CONSTANTS.PROJECTILE.SPAWN_OFFSET;
    const projectilePos = {
      x: npc.position.x + Math.cos(angle) * offset,
      y: npc.position.y + Math.sin(angle) * offset
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

// Istanza della mappa principale
const mapServer = new MapServer('default_map');
mapServer.initialize();

// Aggiungi combat manager alla mappa
mapServer.combatManager = new ServerCombatManager(mapServer);

/**
 * Processa la queue degli aggiornamenti posizione per ridurre race conditions
 */

function processPositionUpdates() {
  for (const [clientId, updates] of positionUpdateQueue) {
    if (updates.length === 0) continue;

    const latestUpdate = updates[updates.length - 1];

    const positionBroadcast = {
      type: 'remote_player_update',
      clientId,
      position: latestUpdate.position,
      rotation: latestUpdate.rotation,
      tick: latestUpdate.tick,
      nickname: latestUpdate.nickname,
      playerId: latestUpdate.playerId
    };

    mapServer.broadcastToMap(positionBroadcast, clientId);
    positionUpdateQueue.delete(clientId);
  }
}

function broadcastNpcUpdates() {
  const npcs = mapServer.npcManager.getAllNpcs();
  if (npcs.length === 0) return;

  const radius = SERVER_CONSTANTS.NETWORK.WORLD_RADIUS; // Raggio del mondo
  const radiusSq = radius * radius;

  // Per ogni giocatore connesso, invia NPC nel suo raggio di interesse ampio
  for (const [clientId, playerData] of mapServer.players.entries()) {
    if (!playerData.position || playerData.ws.readyState !== WebSocket.OPEN) continue;

    // Filtra NPC entro il raggio ampio
    const relevantNpcs = npcs.filter(npc => {
      const dx = npc.position.x - playerData.position.x;
      const dy = npc.position.y - playerData.position.y;
      return (dx * dx + dy * dy) <= radiusSq;
    });

    if (relevantNpcs.length === 0) continue;

    const message = {
      type: 'npc_bulk_update',
      npcs: relevantNpcs.map(npc => ({
        id: npc.id,
        position: npc.position,
        health: { current: npc.health, max: npc.maxHealth },
        shield: { current: npc.shield, max: npc.maxShield },
        behavior: npc.behavior
      })),
      timestamp: Date.now()
    };

    playerData.ws.send(JSON.stringify(message));
  }
}

// Sistema di movimento NPC semplice (server-side)
function updateNpcMovements() {
  const allNpcs = mapServer.npcManager.getAllNpcs();

  for (const npc of allNpcs) {
    const deltaTime = 1000 / 60; // Fixed timestep per fisica server

    // Salva posizione iniziale per calcolare movimento significativo
    const startX = npc.position.x;
    const startY = npc.position.y;

    // Movimento semplice con velocity
    const speed = NPC_CONFIG[npc.type].stats.speed;
    let deltaX = npc.velocity.x * (deltaTime / 1000) * (speed / 100); // Normalizza velocità base
    let deltaY = npc.velocity.y * (deltaTime / 1000) * (speed / 100);

    // Modifica velocità basata sul comportamento
    switch (npc.behavior) {
      case 'aggressive':
        deltaX *= 2;
        deltaY *= 2;
        break;
      case 'flee':
        deltaX *= -1.5;
        deltaY *= -1.5;
        break;
    }



    // Calcola nuova posizione
    const newX = npc.position.x + deltaX;
    const newY = npc.position.y + deltaY;


    // Applica movimento e controlla confini
    if (newX >= mapServer.npcManager.WORLD_LEFT && newX <= mapServer.npcManager.WORLD_RIGHT) {
      npc.position.x = newX;
    } else {
      // Rimbalza sui confini X
      npc.velocity.x = -npc.velocity.x;
      npc.position.x = Math.max(mapServer.npcManager.WORLD_LEFT, Math.min(mapServer.npcManager.WORLD_RIGHT, newX));
    }

    if (newY >= mapServer.npcManager.WORLD_TOP && newY <= mapServer.npcManager.WORLD_BOTTOM) {
      npc.position.y = newY;
    } else {
      // Rimbalza sui confini Y
      npc.velocity.y = -npc.velocity.y;
      npc.position.y = Math.max(mapServer.npcManager.WORLD_TOP, Math.min(mapServer.npcManager.WORLD_BOTTOM, newY));
    }

    // Calcola movimento significativo (solo se spostamento > 5px)
    const dx = npc.position.x - startX;
    const dy = npc.position.y - startY;
    const distSq = dx * dx + dy * dy;

    if (distSq > 25) { // 5px threshold
      npc.lastSignificantMove = Date.now();
    }

    // Aggiorna rotazione dello sprite per riflettere la direzione del movimento
    if (deltaX !== 0 || deltaY !== 0) {
      npc.position.rotation = Math.atan2(deltaY, deltaX) + Math.PI / 2;
    }

    npc.lastUpdate = Date.now();
  }
}

// Sistema di tick unificato attivo (20 Hz)

wss.on('connection', (ws) => {
  console.log('✅ New client connected');
  let playerData = null;

  // Gestisce messaggi dal client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      // Risponde ai messaggi di join
      if (data.type === 'join') {
        playerData = {
          clientId: data.clientId,
          nickname: data.nickname,
          playerId: data.playerId,
          userId: data.userId,
          connectedAt: new Date().toISOString(),
          lastInputAt: null,
          ws: ws,
          // Health and shield system (server authoritative)
          health: 100000,
          maxHealth: 100000,
          shield: 50000,
          maxShield: 50000,
          // Combat state
          lastDamage: null,
          isDead: false,
          respawnTime: null
        };

        mapServer.addPlayer(data.clientId, playerData);

        console.log(`🎮 [SERVER] Player joined: ${data.clientId}`);
        console.log(`   📝 Nickname: ${data.nickname}`);
        console.log(`   🔢 Player ID: ${data.playerId}`);
        console.log(`   👤 User ID: ${data.userId}`);
        console.log(`👥 [SERVER] Total connected players: ${mapServer.players.size}`);

        mapServer.broadcastToMap({
          type: 'player_joined',
          clientId: data.clientId,
          nickname: data.nickname,
          playerId: data.playerId
        }, data.clientId);

        // Invia le posizioni di tutti i giocatori già connessi al nuovo giocatore
        mapServer.players.forEach((playerData, existingClientId) => {
          if (existingClientId !== data.clientId && playerData.position) {
            const existingPlayerBroadcast = {
              type: 'remote_player_update',
              clientId: existingClientId,
              position: playerData.position,
              rotation: 0,
              tick: 0,
              nickname: playerData.nickname,
              playerId: playerData.playerId
            };
            ws.send(JSON.stringify(existingPlayerBroadcast));
            console.log(`📍 [SERVER] Sent position of existing player ${existingClientId} to new player ${data.clientId}`);
          }
        });

        // Invia tutti gli NPC esistenti al nuovo giocatore
        const allNpcs = mapServer.npcManager.getAllNpcs();
        if (allNpcs.length > 0) {
          const initialNpcsMessage = {
            type: 'initial_npcs',
            npcs: allNpcs.map(npc => ({
              id: npc.id,
              type: npc.type,
              position: npc.position,
              health: { current: npc.health, max: npc.maxHealth },
              shield: { current: npc.shield, max: npc.maxShield },
              behavior: npc.behavior
            })),
            timestamp: Date.now()
          };
          ws.send(JSON.stringify(initialNpcsMessage));
          console.log(`🌍 [SERVER] Sent ${allNpcs.length} initial NPCs to new player ${data.clientId}`);
        }

        ws.send(JSON.stringify({
          type: 'welcome',
          clientId: data.clientId,
          message: `Welcome ${data.nickname}! Connected to server.`
        }));

        // Invia la posizione del nuovo giocatore a tutti gli altri giocatori
        if (data.position) {
          mapServer.broadcastToMap({
            type: 'remote_player_update',
            clientId: data.clientId,
            position: data.position,
            rotation: data.position.rotation || 0,
            tick: 0,
            nickname: data.nickname,
            playerId: data.playerId
          }, data.clientId);
        }

        console.log(`👋 [SERVER] Sent welcome to ${data.clientId}`);
      }

      // Gestisce aggiornamenti posizione del player
      if (data.type === 'position_update') {
        if (playerData) {
          playerData.lastInputAt = new Date().toISOString();
          playerData.position = data.position;

          // Log posizione aggiornata (limitato per evitare spam)
          if (Math.random() < 0.1) { // Log solo il 10% degli aggiornamenti
            console.log(`📍 [SERVER] Position from ${data.clientId}: (${data.position.x.toFixed(1)}, ${data.position.y.toFixed(1)})`);
          }

          // Aggiungi alla queue invece di broadcastare immediatamente
          if (!positionUpdateQueue.has(data.clientId)) {
            positionUpdateQueue.set(data.clientId, []);
          }

          positionUpdateQueue.get(data.clientId).push({
            position: data.position,
            rotation: data.rotation,
            tick: data.tick,
            nickname: playerData.nickname,
            playerId: playerData.playerId,
            senderWs: ws,
            timestamp: Date.now()
          });

          // Limita la dimensione della queue per client (max 5 aggiornamenti recenti)
          const clientQueue = positionUpdateQueue.get(data.clientId);
          if (clientQueue.length > 5) {
            clientQueue.shift(); // Rimuovi il più vecchio
          }
        }

        // Echo back acknowledgment
        ws.send(JSON.stringify({
          type: 'position_ack',
          clientId: data.clientId,
          tick: data.tick
        }));
      }

      // Gestisce heartbeat
      if (data.type === 'heartbeat') {
        // Rispondi al heartbeat per confermare connessione viva
        ws.send(JSON.stringify({
          type: 'heartbeat_ack',
          clientId: data.clientId,
          serverTime: Date.now()
        }));
      }

      // Gestisce spari di proiettili
      if (data.type === 'projectile_fired') {
        console.log(`🔫 [SERVER] Projectile fired: ${data.projectileId} by ${data.playerId}`);

        // Determina il target per i proiettili del player (NPC che sta attaccando)
        let targetId = data.targetId || null;
        if (!targetId) {
          // Controlla se il player sta combattendo contro un NPC
          const playerCombat = mapServer.combatManager.playerCombats.get(data.playerId);
          if (playerCombat) {
            targetId = playerCombat.npcId;
          }
        }

        // Registra il proiettile nel server
        mapServer.projectileManager.addProjectile(
          data.projectileId,
          data.playerId,
          data.position,
          data.velocity,
          data.damage,
          data.projectileType || 'laser',
          targetId
        );

        // Broadcast il proiettile a tutti gli altri client
        const projectileMessage = {
          type: 'projectile_fired',
          projectileId: data.projectileId,
          playerId: data.playerId,
          position: data.position,
          velocity: data.velocity,
          damage: data.damage,
          projectileType: data.projectileType || 'laser',
          targetId: targetId
        };

        // Invia a tutti i client, incluso quello che ha sparato (per coerenza con NPC)
        mapServer.clients.forEach((client, clientId) => {
            client.send(JSON.stringify(projectileMessage));
        });
      }

      // Gestisce richiesta di inizio combattimento
      if (data.type === 'start_combat') {
        // Valida che l'NPC esista
        const npc = mapServer.npcManager.getNpc(data.npcId);
        if (!npc) {
          return;
        }

        console.log(`📡 [SERVER] Received START_COMBAT: player=${data.playerId}, npc=${data.npcId}`);

        // Inizia il combattimento server-side
        mapServer.combatManager.startPlayerCombat(data.playerId, data.npcId);

        // Spara immediatamente il primo proiettile per ridurre il delay percepito
        // Nota: rimuoviamo il setTimeout per evitare race conditions
        const combat = mapServer.combatManager.playerCombats.get(data.playerId);
        if (combat) {
          console.log(`📡 [SERVER] Processing initial combat for ${data.playerId} vs ${data.npcId}`);
          mapServer.combatManager.processPlayerCombat(data.playerId, combat, Date.now());
        } else {
          console.error(`❌ [SERVER] Combat not found after startPlayerCombat for ${data.playerId}`);
        }

        // Broadcast stato combattimento a tutti i client
        const combatUpdate = {
          type: 'combat_update',
          playerId: data.playerId,
          npcId: data.npcId,
          isAttacking: true,
          lastAttackTime: Date.now()
        };

        mapServer.broadcastToMap(combatUpdate);
      }

      // Gestisce richiesta di fine combattimento
      if (data.type === 'stop_combat') {
        console.log(`🛑 [SERVER] Stop combat request: player ${data.playerId}`);

        // Ferma il combattimento server-side
        mapServer.combatManager.stopPlayerCombat(data.playerId);

        // Broadcast stato combattimento a tutti i client
        const combatUpdate = {
          type: 'combat_update',
          playerId: data.playerId,
          npcId: null,
          isAttacking: false,
          lastAttackTime: Date.now()
        };

        mapServer.broadcastToMap(combatUpdate);
      }

      // Gestisce creazione esplosioni
      if (data.type === 'explosion_created') {
        console.log(`💥 [SERVER] Explosion created: ${data.explosionType} for ${data.entityType} ${data.entityId}`);

        // Broadcast l'esplosione a tutti gli altri client
        const message = {
          type: 'explosion_created',
          explosionId: data.explosionId,
          entityId: data.entityId,
          entityType: data.entityType,
          position: data.position,
          explosionType: data.explosionType
        };

        // Broadcast con interest radius: 2000 unità per esplosioni
        mapServer.broadcastNear(data.position, 2000, message);
      }

    } catch (error) {
      console.error('❌ [SERVER] Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    if (playerData) {
      console.log(`❌ [SERVER] Player disconnected: ${playerData.clientId} (${playerData.nickname})`);

      mapServer.broadcastToMap({
        type: 'player_left',
        clientId: playerData.clientId
      });

      mapServer.removePlayer(playerData.clientId);

      // Rimuovi anche dalla queue degli aggiornamenti posizione
      positionUpdateQueue.delete(playerData.clientId);

      console.log(`👥 [SERVER] Remaining players: ${mapServer.players.size}`);
    } else {
      console.log('❌ [SERVER] Unknown client disconnected');
    }
  });

  ws.on('error', (error) => {
    console.error('🔌 [SERVER] WebSocket error:', error);
  });
});

// Gestisce chiusura server
process.on('SIGINT', () => {
  console.log('🛑 Shutting down server...');
  wss.close();
  process.exit(0);
});
