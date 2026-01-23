// MessageRouter - Routing e gestione di tutti i tipi di messaggio WebSocket
// Responsabilità: Gestisce tutti i tipi di messaggio (join, position, combat, chat, etc.)
// Dipendenze: logger.cjs, mapServer, playerDataManager, authManager, messageBroadcaster, core/combat/DamageCalculationSystem.cjs

const { logger } = require('../../logger.cjs');
const ServerLoggerWrapper = require('../infrastructure/ServerLoggerWrapper.cjs');
const WebSocket = require('ws');
const messageBroadcaster = require('../messaging/MessageBroadcaster.cjs');
const DamageCalculationSystem = require('../combat/DamageCalculationSystem.cjs');
const playerConfig = require('../../shared/player-config.json');

/**
 * Handler per messaggio 'join'
 */
async function handleJoin(data, sanitizedData, context) {
  const { ws, mapServer, playerDataManager, authManager, messageBroadcaster } = context;

  // Carica i dati del giocatore dal database
  let loadedData;
  try {
    loadedData = await playerDataManager.loadPlayerData(data.userId);

    // Verifica che playerId sia valido dopo il caricamento
    if (!loadedData || !loadedData.playerId || loadedData.playerId === 0) {
      ServerLoggerWrapper.security(`Invalid player data loaded for ${data.userId}: playerId=${loadedData?.playerId}`);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid player data. Please contact support.',
        code: 'INVALID_PLAYER_DATA'
      }));
      ws.close(1008, 'Invalid player data');
      return null;
    }
  } catch (error) {
    ServerLoggerWrapper.database(`Failed to load player data for ${data.userId}: ${error.message}`);

    let errorMessage = 'Failed to load player data. Please contact support.';
    let errorCode = 'LOAD_PLAYER_DATA_FAILED';

    if (error.message.includes('ACCESS DENIED')) {
      errorMessage = error.message;
      errorCode = 'ACCESS_DENIED';
    } else if (error.message.includes('fetch failed') || error.message.includes('ENOTFOUND')) {
      errorMessage = 'Database connection failed. Please try again later.';
      errorCode = 'DATABASE_CONNECTION_FAILED';
    } else if (error.message.includes('DATABASE ERROR')) {
      errorMessage = error.message;
      errorCode = 'DATABASE_ERROR';
    }

    ws.send(JSON.stringify({
      type: 'error',
      message: errorMessage,
      code: errorCode
    }));
    ws.close(1008, 'Failed to load player data');
    return null;
  }

  // Calcola max health/shield basati sugli upgrade
  const maxHealth = authManager.calculateMaxHealth(loadedData.upgrades.hpUpgrades);
  const maxShield = authManager.calculateMaxShield(loadedData.upgrades.shieldUpgrades);

  // 🟢 MMO-CORRECT: Usa SEMPRE i valori salvati (NULL = errore critico, mai fallback)
  // Se il player esiste, HP deve arrivare dal DB. Se manca → errore, non fallback silenzioso

  if (loadedData.health === null || loadedData.health === undefined) {
    ServerLoggerWrapper.system(`🚨 CRITICAL: MISSING HEALTH DATA for existing player ${data.userId} (${loadedData.playerId})`);
    ServerLoggerWrapper.system(`This should NEVER happen after DB migration. Check migration status and DB integrity.`);
    throw new Error(`DATABASE ERROR: Missing current_health for player ${loadedData.playerId}. DB migration may have failed.`);
  }

  if (loadedData.shield === null || loadedData.shield === undefined) {
    ServerLoggerWrapper.system(`🚨 CRITICAL: MISSING SHIELD DATA for existing player ${data.userId} (${loadedData.playerId})`);
    ServerLoggerWrapper.system(`This should NEVER happen after DB migration. Check migration status and DB integrity.`);
    throw new Error(`DATABASE ERROR: Missing current_shield for player ${loadedData.playerId}. DB migration may have failed.`);
  }

  const savedHealth = Math.min(loadedData.health, maxHealth);
  const savedShield = Math.min(loadedData.shield, maxShield);

  logger.info('CONNECTION', `🎯 APPLY Health: loaded=${loadedData.health}, max=${maxHealth}, applied=${savedHealth}`);
  logger.info('CONNECTION', `🎯 APPLY Shield: loaded=${loadedData.shield}, max=${maxShield}, applied=${savedShield}`);

  const playerData = {
    clientId: data.clientId,
    nickname: data.nickname,
    playerId: loadedData.playerId,
    userId: data.userId,
    isAdministrator: loadedData.isAdministrator || false, // Admin status
    connectedAt: new Date().toISOString(),
    lastInputAt: null,
    position: data.position,
    ws: ws,
    upgrades: loadedData.upgrades,
    health: savedHealth,
    maxHealth: maxHealth,
    shield: savedShield,
    maxShield: maxShield,
    lastDamage: null,
    isDead: false,
    respawnTime: null,
    joinTime: Date.now(), // Timestamp quando ha fatto join
    isFullyLoaded: false, // 🚫 Blocca auto-repair finché non è true
    inventory: loadedData.inventory,
    quests: loadedData.quests || []
  };

  // Verifica che inventory sia presente
  if (!playerData.inventory) {
    ServerLoggerWrapper.security(`🚨 CRITICAL: Player ${data.userId} joined with null inventory!`);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to load player inventory. Please contact support.',
      code: 'INVENTORY_LOAD_FAILED'
    }));
    ws.close(1008, 'Inventory load failed');
    return null;
  }

  // 🔄 CRITICAL: Usa playerId come clientId per renderlo PERSISTENTE tra riconnessioni
  // Invece del clientId temporaneo inviato dal client, usa l'ID stabile del giocatore
  const persistentClientId = `${playerData.playerId}`;

  // 🚨 CRITICAL: Prima di aggiungere il nuovo giocatore, rimuovi eventuali vecchi giocatori
  // con lo stesso playerId ma clientId diverso (riconnessioni)
  for (const [existingClientId, existingPlayerData] of mapServer.players.entries()) {
    if (existingPlayerData.playerId === playerData.playerId && existingClientId !== persistentClientId) {
      ServerLoggerWrapper.security(`🧹 CLEANUP: Removing old instance of player ${playerData.playerId} with clientId ${existingClientId} (reconnection)`);

      // Broadcast player left per il vecchio giocatore
      const playerLeftMsg = messageBroadcaster.formatPlayerLeftMessage(existingClientId);
      mapServer.broadcastToMap(playerLeftMsg);

      // Rimuovi dalla mappa
      mapServer.removePlayer(existingClientId);
    }
  }

  // Helper per calcolare il rank (duplicato logica client RankSystem)
  function calculatePlayerRank(experience, totalHonor, recentHonor, isAdministrator) {
    if (isAdministrator) return 'Administrator';

    // I rank militari e le loro soglie (duplicato da RankSystem.ts)
    const MILITARY_RANKS = [
      { name: 'Chief General', minPoints: 100000 },
      { name: 'General', minPoints: 75000 },
      { name: 'Basic General', minPoints: 50000 },
      { name: 'Chief Colonel', minPoints: 35000 },
      { name: 'Colonel', minPoints: 25000 },
      { name: 'Basic Colonel', minPoints: 15000 },
      { name: 'Chief Major', minPoints: 10000 },
      { name: 'Major', minPoints: 7500 },
      { name: 'Basic Major', minPoints: 5000 },
      { name: 'Chief Captain', minPoints: 3500 },
      { name: 'Captain', minPoints: 2500 },
      { name: 'Basic Captain', minPoints: 1500 },
      { name: 'Chief Lieutenant', minPoints: 1000 },
      { name: 'Lieutenant', minPoints: 750 },
      { name: 'Basic Lieutenant', minPoints: 500 },
      { name: 'Chief Sergeant', minPoints: 350 },
      { name: 'Sergeant', minPoints: 250 },
      { name: 'Basic Sergeant', minPoints: 150 },
      { name: 'Chief Space Pilot', minPoints: 100 },
      { name: 'Space Pilot', minPoints: 50 },
      { name: 'Basic Space Pilot', minPoints: 25 },
      { name: 'Recruit', minPoints: 0 }
    ];

    // Formula: EXP + (Honor * 0.5) + (RecentHonor * 2)
    // Fallback: usa honor corrente se recentHonor non disponibile
    const recentHonorValue = recentHonor !== undefined && recentHonor !== null ? recentHonor : totalHonor;
    const rankingPoints = experience + (totalHonor * 0.5) + (recentHonorValue * 2);

    // Trova il rank
    for (const rank of MILITARY_RANKS) {
      if (rankingPoints >= rank.minPoints) {
        return rank.name;
      }
    }
    return 'Recruit';
  }

  // Aggiorna il clientId nel playerData per coerenza
  playerData.clientId = persistentClientId;

  // Calcola il rank iniziale
  // NOTA: Qui usiamo honor corrente come approssimazione di recentHonor se non disponibile
  // Idealmente dovremmo caricare recentHonor dal DB
  const currentHonor = loadedData.inventory?.honor || 0;
  // TODO: Caricare recentHonor dal DB per calcolo preciso
  // Per ora usiamo currentHonor come stima per recentHonor
  const recentHonorApprox = currentHonor;

  playerData.rank = calculatePlayerRank(
    loadedData.inventory?.experience || 0,
    currentHonor,
    recentHonorApprox,
    playerData.isAdministrator
  );

  // 🚨 CRITICAL: Inizializza coordinate del player usando la persistenza del DB o spawn come fallback
  // loadedData.position contiene i dati caricati dal DB in PlayerDataManager.loadPlayerData
  const spawnX = 200 + (Math.random() * 200);
  const spawnY = 200 + (Math.random() * 200);

  playerData.x = loadedData.position?.x ?? spawnX;
  playerData.y = loadedData.position?.y ?? spawnY;
  playerData.rotation = loadedData.position?.rotation ?? 0;
  playerData.velocityX = 0;
  playerData.velocityY = 0;

  // Aggiorna l'oggetto position per il broadcast iniziale
  playerData.position = {
    x: playerData.x,
    y: playerData.y,
    rotation: playerData.rotation,
    velocityX: playerData.velocityX,
    velocityY: playerData.velocityY
  };

  mapServer.addPlayer(persistentClientId, playerData);

  ServerLoggerWrapper.info('PLAYER', `Player joined: ${data.nickname} (${playerData.playerId}) - Rank: ${playerData.rank}`);

  // TEMP: Enable repair system after initial sync (replace with explicit load completion)
  // Questo timeout è un hack temporaneo - in futuro sostituire con:
  // await loadHealth(); await loadShield(); await loadPosition(); await loadShipState();
  setTimeout(() => {
    playerData.isFullyLoaded = true;
    // Player load completion logging removed for cleaner production console
  }, 2000); // 2 secondi per sync iniziale

  if (mapServer.players.size >= 10) {
    ServerLoggerWrapper.system(`High player count: ${mapServer.players.size} players connected`);
  }

  // Broadcast player joined
  const playerJoinedMsg = messageBroadcaster.formatPlayerJoinedMessage(
    persistentClientId,
    data.nickname,
    playerData.playerId
  );
  mapServer.broadcastToMap(playerJoinedMsg, persistentClientId);

  // Invia posizioni dei giocatori esistenti
  mapServer.players.forEach((existingPlayerData, existingClientId) => {
    if (existingClientId !== persistentClientId && existingPlayerData.position) {
      const existingPlayerBroadcast = {
        type: 'remote_player_update',
        clientId: existingClientId,
        position: existingPlayerData.position,
        rotation: existingPlayerData.position.rotation || 0,
        tick: 0,
        nickname: existingPlayerData.nickname,
        playerId: existingPlayerData.playerId,
        rank: existingPlayerData.rank || 'Recruit' // Includi rank
      };
      ws.send(JSON.stringify(existingPlayerBroadcast));
    }
  });

  // Broadcast posizione del nuovo giocatore a tutti gli altri
  if (playerData.position) {
    const newPlayerBroadcast = {
      type: 'remote_player_update',
      clientId: persistentClientId,
      position: playerData.position,
      rotation: playerData.position.rotation || 0,
      tick: 0,
      nickname: data.nickname,
      playerId: playerData.playerId,
      rank: playerData.rank // Includi rank
    };
    mapServer.broadcastToMap(newPlayerBroadcast, persistentClientId);
  }

  // Invia NPC esistenti
  const allNpcs = mapServer.npcManager.getAllNpcs();
  if (allNpcs.length > 0) {
    const initialNpcsMessage = messageBroadcaster.formatInitialNpcsMessage(allNpcs);
    ws.send(JSON.stringify(initialNpcsMessage));
    ServerLoggerWrapper.debug('SERVER', `Sent ${allNpcs.length} initial NPCs to new player ${persistentClientId}`);
  }

  // Welcome message
  const welcomeMessage = messageBroadcaster.formatWelcomeMessage(
    playerData,
    data.nickname,
    (hp) => authManager.calculateMaxHealth(hp),
    (shield) => authManager.calculateMaxShield(shield),
    playerData.isAdministrator
  );

  try {
    ws.send(JSON.stringify(welcomeMessage));
  } catch (error) {
    ServerLoggerWrapper.warn('SERVER', `Failed to send welcome message: ${error.message}`);
  }

  return playerData;
}

/**
 * Handler per messaggio 'position_update'
 */
function handlePositionUpdate(data, sanitizedData, context) {
  const { ws, playerData: contextPlayerData, mapServer } = context;

  // Fallback a mapServer se playerData non è nel context
  const playerData = contextPlayerData || mapServer.players.get(data.clientId);
  if (!playerData) return;

  // 🔒 SECURITY: Rate limiting lato server per position_update
  const now = Date.now();

  // Inizializza timestamp per rate limiting
  if (!playerData.lastPositionUpdateTime) {
    playerData.lastPositionUpdateTime = now;
    playerData.positionUpdateCount = 0;
  }

  // Reset counter ogni secondo
  if (now - playerData.lastPositionUpdateTime >= 1000) {
    playerData.positionUpdateCount = 0;
    playerData.lastPositionUpdateTime = now;
  }

  // Max 50 position updates al secondo (aumentato per fluidità nei combattimenti)
  const MAX_POSITION_UPDATES_PER_SECOND = 50;
  if (playerData.positionUpdateCount >= MAX_POSITION_UPDATES_PER_SECOND) {
    // Rate limit superato - ignora questo update
    return;
  }
  playerData.positionUpdateCount++;

  // 🔒 SECURITY: Anti-teleport - verifica che il movimento sia fisicamente possibile
  const PLAYER_CONFIG = require('../../../shared/player-config.json');
  const baseSpeed = PLAYER_CONFIG.stats.speed || 300; // 300 unità/secondo

  // Calcola velocità effettiva del giocatore basata sui suoi upgrade
  const playerSpeedUpgrades = playerData.upgrades?.speedUpgrades || 0;
  const speedMultiplier = 1.0 + (playerSpeedUpgrades * 0.005); // Ogni upgrade = +0.5% velocità
  const actualMaxSpeed = baseSpeed * speedMultiplier;

  // Calcola tempo effettivo dall'ultimo movimento (non dall'ultimo rate limit reset)
  const timeSinceLastMovement = now - (playerData.lastMovementTime || now);
  const timeInSeconds = Math.max(timeSinceLastMovement / 1000, 0.01); // Minimo 10ms per evitare divisioni per zero

  // Distanza massima possibile in questo intervallo di tempo
  const maxPossibleDistance = actualMaxSpeed * timeInSeconds;

  if (playerData.position && Number.isFinite(playerData.position.x) && Number.isFinite(playerData.position.y)) {
    const dx = sanitizedData.x - playerData.position.x;
    const dy = sanitizedData.y - playerData.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Threshold più permissivo per compensare lag network e buffering client (15x per gestire burst posizioni)
    const TELEPORT_THRESHOLD_MULTIPLIER = 15;
    const teleportThreshold = maxPossibleDistance * TELEPORT_THRESHOLD_MULTIPLIER;

    // Se la distanza è troppo grande, potrebbe essere un teleport hack
    if (distance > teleportThreshold) {
      ServerLoggerWrapper.security(`🚫 Possible teleport hack from clientId:${data.clientId} playerId:${playerData.playerId}: ` +
        `distance ${distance.toFixed(2)} > threshold ${teleportThreshold.toFixed(2)} | ` +
        `actualMaxSpeed: ${actualMaxSpeed.toFixed(0)} u/s | ` +
        `speedUpgrades: ${playerSpeedUpgrades} | ` +
        `timeDelta: ${timeSinceLastMovement}ms | ` +
        `from (${playerData.position.x.toFixed(1)}, ${playerData.position.y.toFixed(1)}) ` +
        `to (${sanitizedData.x.toFixed(1)}, ${sanitizedData.y.toFixed(1)})`);
      // Ignora questo update invece di applicarlo
      return;
    }
  }

  playerData.lastInputAt = new Date().toISOString();

  if (Number.isFinite(sanitizedData.x) && Number.isFinite(sanitizedData.y)) {
    playerData.position = {
      x: sanitizedData.x,
      y: sanitizedData.y,
      rotation: sanitizedData.rotation,
      velocityX: sanitizedData.velocityX || 0,
      velocityY: sanitizedData.velocityY || 0
    };
    // Aggiorna timestamp per calcolo movimento successivo
    playerData.lastMovementTime = now;
  }

  // Aggiungi alla queue
  if (!mapServer.positionUpdateQueue.has(data.clientId)) {
    mapServer.positionUpdateQueue.set(data.clientId, []);
  }

  mapServer.positionUpdateQueue.get(data.clientId).push({
    x: data.x,
    y: data.y,
    rotation: data.rotation,
    velocityX: data.velocityX || 0,
    velocityY: data.velocityY || 0,
    tick: data.tick,
    nickname: playerData.nickname,
    playerId: playerData.playerId,
    rank: playerData.rank, // Aggiunto rank alla queue
    senderWs: ws,
    timestamp: Date.now()
  });

  // Limita dimensione queue
  const clientQueue = mapServer.positionUpdateQueue.get(data.clientId);
  if (clientQueue.length > 5) {
    clientQueue.shift();
  }

  // Echo back acknowledgment
  ws.send(JSON.stringify({
    type: 'position_ack',
    clientId: data.clientId,
    tick: data.tick
  }));
}

/**
 * Handler per messaggio 'heartbeat'
 */
function handleHeartbeat(data, sanitizedData, context) {
  const { ws } = context;

  ws.send(JSON.stringify({
    type: 'heartbeat_ack',
    clientId: data.clientId,
    serverTime: Date.now()
  }));
}

/**
 * Handler per messaggio 'skill_upgrade_request'
 */
async function handleSkillUpgradeRequest(data, sanitizedData, context) {
  const { ws, playerData: contextPlayerData, mapServer, authManager, playerDataManager, messageBroadcaster } = context;

  // Fallback a mapServer se playerData non è nel context
  const playerData = contextPlayerData || mapServer.players.get(data.clientId);
  if (!playerData) {
    logger.warn('SKILL_UPGRADE', `Player data not found for clientId: ${data.clientId}`);
    return;
  }

  // Security check
  const playerIdValidation = authManager.validatePlayerId(data.playerId, playerData);
  if (!playerIdValidation.valid) {
    ServerLoggerWrapper.security(`🚫 BLOCKED: Skill upgrade attempt with mismatched playerId from clientId:${data.clientId} playerId:${playerData.playerId}`);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Invalid player ID for skill upgrade.',
      code: 'INVALID_PLAYER_ID'
    }));
    return;
  }

  const baseUpgradeCosts = playerConfig.upgradeCosts;

  const upgradeLimits = {
    hp: 100,
    shield: 100,
    speed: 100,
    damage: 100
  };

  function calculateUpgradeCost(statType, currentLevel) {
    const baseCost = baseUpgradeCosts[statType];
    const levelMultiplier = 1 + (currentLevel * 0.15);

    if (currentLevel < 20) {
      const credits = Math.floor(baseCost.credits * levelMultiplier);
      return { credits, cosmos: 0 };
    } else if (currentLevel < 40) {
      const credits = Math.floor(baseCost.credits * levelMultiplier);
      const cosmos = Math.floor(baseCost.cosmos * (1 + (currentLevel - 20) * 0.1));
      return { credits, cosmos };
    } else {
      const cosmos = Math.floor(baseCost.cosmos * 2 * (1 + (currentLevel - 40) * 0.2));
      return { credits: 0, cosmos };
    }
  }

  const currentLevel = playerData.upgrades[data.upgradeType + 'Upgrades'] || 0;
  const cost = calculateUpgradeCost(data.upgradeType, currentLevel);
  const maxLimit = upgradeLimits[data.upgradeType];

  if (maxLimit === undefined) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Invalid upgrade type',
      code: 'INVALID_UPGRADE_TYPE'
    }));
    return;
  }

  if (currentLevel >= maxLimit) {
    ws.send(JSON.stringify({
      type: 'error',
      message: `Maximum upgrades reached for ${data.upgradeType} (${maxLimit}/${maxLimit})`,
      code: 'MAX_UPGRADES_REACHED'
    }));
    return;
  }

  const currentCredits = Number(playerData.inventory.credits || 0);
  const currentCosmos = Number(playerData.inventory.cosmos || 0);

  if (currentCredits < cost.credits || currentCosmos < cost.cosmos) {
    let costMessage = '';
    if (cost.credits > 0 && cost.cosmos > 0) {
      costMessage = `${cost.credits} credits + ${cost.cosmos} cosmos`;
    } else if (cost.credits > 0) {
      costMessage = `${cost.credits} credits`;
    } else if (cost.cosmos > 0) {
      costMessage = `${cost.cosmos} cosmos`;
    }
    ws.send(JSON.stringify({
      type: 'error',
      message: `Not enough resources for upgrade. Required: ${costMessage}`,
      code: 'INSUFFICIENT_RESOURCES'
    }));
    return;
  }

  const oldCredits = currentCredits;
  const oldCosmos = currentCosmos;

  // Sottrai risorse
  playerData.inventory.credits = currentCredits - cost.credits;
  playerData.inventory.cosmos = currentCosmos - cost.cosmos;

  // Applica upgrade
  switch (data.upgradeType) {
    case 'hp':
      playerData.upgrades.hpUpgrades += 1;
      playerData.maxHealth = authManager.calculateMaxHealth(playerData.upgrades.hpUpgrades);
      break;
    case 'shield':
      playerData.upgrades.shieldUpgrades += 1;
      playerData.maxShield = authManager.calculateMaxShield(playerData.upgrades.shieldUpgrades);
      break;
    case 'speed':
      playerData.upgrades.speedUpgrades += 1;
      break;
    case 'damage':
      playerData.upgrades.damageUpgrades += 1;
      break;
    default:
      playerData.inventory.credits = oldCredits;
      playerData.inventory.cosmos = oldCosmos;
      return;
  }

  const recentHonor = await playerDataManager.getRecentHonorAverage(playerData.userId, 30);

  ws.send(JSON.stringify({
    type: 'player_state_update',
    inventory: { ...playerData.inventory },
    upgrades: { ...playerData.upgrades },
    health: playerData.health,
    maxHealth: playerData.maxHealth,
    shield: playerData.shield,
    maxShield: playerData.maxShield,
    recentHonor: recentHonor,
    source: `skill_upgrade_${data.upgradeType}`
  }));
}

/**
 * Handler per messaggio 'projectile_fired'
 */
function handleProjectileFired(data, sanitizedData, context) {
  const { ws, playerData: contextPlayerData, mapServer, authManager } = context;

  // Fallback a mapServer se playerData non è nel context
  const playerData = contextPlayerData || mapServer.players.get(data.clientId);
  if (!playerData) {
    logger.warn('PROJECTILE', `Player data not found for clientId: ${data.clientId}`);
    return;
  }

  // Security check
  const playerIdValidation = authManager.validatePlayerId(data.playerId, playerData);
  if (!playerIdValidation.valid) {
    ServerLoggerWrapper.security(`🚫 BLOCKED: Projectile fire attempt with mismatched playerId from clientId:${data.clientId} playerId:${playerData.playerId}`);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Invalid player ID for projectile action.',
      code: 'INVALID_PLAYER_ID'
    }));
    return;
  }

  let targetId = data.targetId || null;
  console.log(`[SERVER_PROJECTILE] Received projectile fired: projectileId=${data.projectileId}, targetId=${targetId}, projectileType=${data.projectileType}, rawTargetId=${JSON.stringify(data.targetId)}`);
  if (!targetId) {
    const playerCombat = mapServer.combatManager.playerCombats.get(data.clientId);
    if (playerCombat) {
      targetId = playerCombat.npcId;
      console.log(`[SERVER_PROJECTILE] Using targetId from playerCombat: ${targetId}`);
    }
  }

  // Server authoritative damage calculation (usa DamageCalculationSystem)
  const baseDamage = DamageCalculationSystem.getBasePlayerDamage();
  let calculatedDamage = DamageCalculationSystem.calculatePlayerDamage(
    baseDamage,
    playerData?.upgrades
  );

  // Missile damage logic removed - missiles are no longer supported

  // Usa clientId per identificare il giocatore nel sistema di collisione
  // data.playerId è l'authId (usato per security check)
  // data.clientId è l'identificatore della connessione (usato per collisione)
  mapServer.projectileManager.addProjectile(
    data.projectileId,
    data.clientId, // Usa clientId per identificare il giocatore nel sistema di collisione
    data.position,
    data.velocity,
    calculatedDamage,
    data.projectileType || 'laser',
    targetId
  );

  const projectileMessage = {
    type: 'projectile_fired',
    projectileId: data.projectileId,
    playerId: data.playerId, // Mantieni authId per retrocompatibilità client
    clientId: data.clientId, // clientId per identificare il giocatore locale
    position: data.position,
    velocity: data.velocity,
    damage: calculatedDamage,
    projectileType: data.projectileType || 'laser',
    targetId: targetId
  };

  mapServer.players.forEach((client, clientId) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(projectileMessage));
    }
  });
}

/**
 * Handler per messaggio 'start_combat'
 */
function handleStartCombat(data, sanitizedData, context) {
  // DEBUG: Log quando riceve start_combat
  console.log(`[SERVER_START_COMBAT] Received start_combat: clientId=${data.clientId}, playerId=${data.playerId}, npcId=${data.npcId}`);

  const { ws, playerData: contextPlayerData, mapServer, authManager, messageBroadcaster } = context;

  // Fallback a mapServer se playerData non è nel context
  const playerData = contextPlayerData || mapServer.players.get(data.clientId);
  if (!playerData) {
    ServerLoggerWrapper.system(`Player data not found for clientId: ${data.clientId}`);
    return;
  }

  // Security check
  const playerIdValidation = authManager.validatePlayerId(data.playerId, playerData);
  if (!playerIdValidation.valid) {
    logger.error('SECURITY', `🚫 BLOCKED: Combat start attempt with mismatched playerId from clientId:${data.clientId} playerId:${playerData.playerId}`);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Invalid player ID for combat action.',
      code: 'INVALID_PLAYER_ID'
    }));
    return;
  }

  const npc = mapServer.npcManager.getNpc(data.npcId);
  if (!npc) {
    ServerLoggerWrapper.combat(`START_COMBAT: NPC ${data.npcId} not found`);
    return;
  }

  mapServer.combatManager.startPlayerCombat(data.clientId, data.npcId, context);

  const combat = mapServer.combatManager.playerCombats.get(data.clientId);
  if (combat) {
    mapServer.combatManager.processPlayerCombat(data.clientId, combat, Date.now());

    // Broadcast solo se il combat è stato creato con successo
    const combatUpdate = messageBroadcaster.formatCombatUpdateMessage(
      data.playerId,
      data.npcId,
      true,
      data.clientId, // Passa il persistent clientId
      combat.sessionId // Passa il session ID univoco
    );
    mapServer.broadcastToMap(combatUpdate);
  } else {
    ServerLoggerWrapper.error('SERVER', `Combat not found after startPlayerCombat for ${data.clientId}`);
  }
}

/**
 * Handler per messaggio 'stop_combat'
 */
function handleStopCombat(data, sanitizedData, context) {
  const { playerData: contextPlayerData, mapServer, messageBroadcaster } = context;

  // Fallback a mapServer se playerData non è nel context
  const playerData = contextPlayerData || mapServer.players.get(data.clientId);
  if (!playerData) return;

  // ✅ ARCHITECTURAL CLEANUP: Chiudi completamente il combat invece di settare npcId=null
  // Questo è più sicuro e consistente con la nuova architettura
  if (mapServer.combatManager.playerCombats.has(data.clientId)) {
    mapServer.combatManager.stopPlayerCombat(data.clientId);
    // Combat stop logging removed for production - too verbose
  }

  const combatUpdate = messageBroadcaster.formatCombatUpdateMessage(
    data.playerId,
    null,
    false,
    data.clientId
  );
  mapServer.broadcastToMap(combatUpdate);
}

/**
 * Handler per messaggio 'explosion_created'
 */
function handleExplosionCreated(data, sanitizedData, context) {
  const { mapServer } = context;

  const message = {
    type: 'explosion_created',
    explosionId: data.explosionId,
    entityId: data.entityId,
    entityType: data.entityType,
    position: data.position,
    explosionType: data.explosionType
  };

  mapServer.broadcastNear(data.position, 2000, message);
}

/**
 * Handler per messaggio 'request_leaderboard'
 */
async function handleRequestLeaderboard(data, sanitizedData, context) {
  const { ws, playerData: contextPlayerData, mapServer, authManager, messageBroadcaster, playerDataManager } = context;

  // Fallback a mapServer se playerData non è nel context (leaderboard è pubblica, playerData può essere null)
  const playerData = contextPlayerData || (data.clientId ? mapServer.players.get(data.clientId) : null);

  try {
    const sortBy = data.sortBy || 'ranking_points';
    const limit = data.limit || 100;

    ServerLoggerWrapper.system(`Requesting leaderboard: sortBy=${sortBy}, limit=${limit}`);

    // Usa playerDataManager per accedere a Supabase (ha un client funzionante)
    const supabase = playerDataManager.getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const { data: leaderboardData, error: leaderboardError } = await supabase.rpc(
      'get_leaderboard',
      {
        p_limit: limit,
        p_sort_by: sortBy
      }
    );

    // Debug dettagliato per capire quanti giocatori ci sono
    const { count: totalUserProfiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    const { count: totalUserProfilesNonAdmin, error: nonAdminError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_administrator', false);

    const { count: totalCurrencies, error: currenciesError } = await supabase
      .from('player_currencies')
      .select('*', { count: 'exact', head: true });

    const { count: totalStats, error: statsError } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });

    const actualReturned = Array.isArray(leaderboardData) ? leaderboardData.length : 0;
    const highestPlayerId = Array.isArray(leaderboardData) && leaderboardData.length > 0
      ? Math.max(...leaderboardData.map(p => p.player_id))
      : 'Unknown';

    ServerLoggerWrapper.database(`Leaderboard detailed stats`, {
      requested: limit,
      returned: actualReturned,
      databaseBreakdown: {
        totalUserProfiles: totalUserProfiles || 0,
        totalNonAdminProfiles: totalUserProfilesNonAdmin || 0,
        totalCurrencies: totalCurrencies || 0,
        totalStats: totalStats || 0
      },
      highestPlayerId: highestPlayerId,
      sortBy: sortBy,
      hasData: !!leaderboardData,
      hasError: !!leaderboardError,
      errorMessage: leaderboardError?.message
    });

    if (leaderboardError) {
      logger.error('DATABASE', `Error getting leaderboard:`, {
        message: leaderboardError.message,
        details: leaderboardError.details,
        hint: leaderboardError.hint,
        code: leaderboardError.code
      });

      // Se la funzione non esiste o c'è un errore di rete, prova a ottenere i player direttamente
      const isFunctionError = leaderboardError.message?.includes('does not exist') ||
        leaderboardError.code === '42883' ||
        leaderboardError.message?.includes('ENOTFOUND') ||
        leaderboardError.message?.includes('fetch failed');

      if (isFunctionError) {
        logger.warn('LEADERBOARD', 'RPC call failed, trying direct query fallback');
        try {
          const supabase = playerDataManager.getSupabaseClient();
          if (!supabase) {
            throw new Error('Supabase client not available for fallback');
          }

          const { data: profiles, error: profilesError } = await supabase
            .from('user_profiles')
            .select('player_id, username')
            .order('player_id', { ascending: true })
            .limit(limit);

          if (!profilesError && profiles && profiles.length > 0) {
            const simpleEntries = profiles.map((profile, index) => ({
              rank: index + 1,
              playerId: profile.player_id,
              username: profile.username,
              experience: 0,
              honor: 0,
              recentHonor: 0,
              rankingPoints: 0,
              kills: 0,
              playTime: 0,
              level: 1,
              rankName: 'Recruit'
            }));

            const leaderboardResponse = messageBroadcaster.formatLeaderboardResponse(
              simpleEntries,
              sortBy,
              undefined
            );
            ws.send(JSON.stringify(leaderboardResponse));
            logger.info('LEADERBOARD', `Sent fallback leaderboard with ${simpleEntries.length} entries`);
            return;
          } else if (profilesError) {
            logger.error('LEADERBOARD', `Fallback query error: ${profilesError.message}`);
          }
        } catch (fallbackError) {
          logger.error('LEADERBOARD', `Fallback query exception: ${fallbackError.message}`);
        }
      }

      ws.send(JSON.stringify({
        type: 'leaderboard_response',
        entries: [],
        sortBy: sortBy,
        error: `Failed to load leaderboard: ${leaderboardError.message || 'Unknown error'}`
      }));
      return;
    }

    logger.info('LEADERBOARD', `Query returned ${leaderboardData?.length || 0} entries`);

    if (!leaderboardData || leaderboardData.length === 0) {
      logger.warn('LEADERBOARD', 'No leaderboard data returned from database');
      logger.info('LEADERBOARD', 'Raw response:', JSON.stringify(leaderboardData, null, 2));
    } else {
      logger.info('LEADERBOARD', `First entry sample:`, JSON.stringify(leaderboardData[0], null, 2));
    }

    let playerRank = undefined;
    if (playerData?.userId) {
      const playerEntry = leaderboardData?.find((entry) => {
        return entry.player_id === playerData.playerId;
      });
      if (playerEntry) {
        playerRank = playerEntry.rank_position;
      }
    }

    const entries = (leaderboardData || []).map((entry) => {
      const rankingPoints = parseFloat(entry.ranking_points) || 0;
      const rankName = authManager.calculateRankName(rankingPoints, entry.is_administrator || false);

      return {
        rank: parseInt(entry.rank_position) || 0,
        playerId: parseInt(entry.player_id) || 0,
        username: entry.username || `Player #${entry.player_id}`,
        experience: parseInt(entry.experience) || 0,
        honor: parseInt(entry.honor) || 0,
        recentHonor: parseFloat(entry.recent_honor) || 0,
        rankingPoints: rankingPoints,
        kills: parseInt(entry.kills) || 0,
        playTime: parseInt(entry.play_time) || 0,
        level: parseInt(entry.level) || 1,
        rankName: rankName
      };
    });

    const leaderboardResponse = messageBroadcaster.formatLeaderboardResponse(
      entries,
      sortBy,
      playerRank
    );
    ws.send(JSON.stringify(leaderboardResponse));

    logger.info('LEADERBOARD', `Sent leaderboard to ${data.clientId} (${entries.length} entries, sort: ${sortBy})`);
  } catch (error) {
    logger.error('LEADERBOARD', `Error processing leaderboard request:`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    ws.send(JSON.stringify({
      type: 'leaderboard_response',
      entries: [],
      sortBy: data.sortBy || 'ranking_points',
      error: `Failed to load leaderboard: ${error.message || 'Unknown error'}`
    }));
  }
}

/**
 * Handler per messaggio 'request_player_data'
 */
async function handleRequestPlayerData(data, sanitizedData, context) {
  const { ws, playerData: contextPlayerData, mapServer, authManager, playerDataManager, messageBroadcaster } = context;

  // Fallback a mapServer se playerData non è nel context
  const playerData = contextPlayerData || mapServer.players.get(data.clientId);
  if (!playerData) return;

  // Security check
  const playerIdValidation = authManager.validatePlayerId(data.playerId, playerData);
  if (!playerIdValidation.valid) {
    logger.error('SECURITY', `🚫 BLOCKED: Player data request with mismatched playerId from clientId:${data.clientId} playerId:${playerData.playerId}`);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Invalid player ID for data request.',
      code: 'INVALID_PLAYER_ID'
    }));
    return;
  }

  const recentHonor = await playerDataManager.getRecentHonorAverage(playerData.userId, 30);

  const responseMessage = messageBroadcaster.formatPlayerDataResponse(
    data.playerId,
    playerData.inventory,
    playerData.upgrades,
    playerData.quests,
    recentHonor,
    playerData.isAdministrator
  );
  ws.send(JSON.stringify(responseMessage));
}

/**
 * Handler per messaggio 'chat_message'
 */
function handleChatMessage(data, sanitizedData, context) {
  const { ws, playerData: contextPlayerData, mapServer, authManager, messageBroadcaster, filterChatMessage } = context;

  // Fallback a mapServer se playerData non è nel context
  const playerData = contextPlayerData || mapServer.players.get(data.clientId);

  const now = Date.now();
  logger.info('CHAT', `Received chat message from ${data.clientId}: ${data.content?.substring(0, 50)}`);

  if (!data.content || typeof data.content !== 'string') {
    logger.warn('CHAT', 'Invalid content type');
    return;
  }

  // Security check
  const clientIdValidation = authManager.validateClientId(data.clientId, playerData);
  if (!clientIdValidation.valid) {
    logger.warn('SECURITY', `🚫 BLOCKED: Chat message with mismatched clientId. Received: ${data.clientId}, Expected: ${playerData?.clientId}, PlayerId: ${playerData?.playerId}`);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Invalid client ID for chat message.',
      code: 'INVALID_CLIENT_ID'
    }));
    return;
  }

  const content = data.content.trim();
  if (content.length === 0 || content.length > 200) {
    logger.warn('CHAT', `Invalid message length: ${content.length}`);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Chat message must be between 1 and 200 characters.'
    }));
    return;
  }

  const filteredContent = filterChatMessage(content);

  const chatBroadcast = messageBroadcaster.formatChatMessage(
    data.clientId,
    playerData.nickname || 'Unknown Player',
    filteredContent,
    now,
    playerData.playerId || null,
    playerData.isAdministrator || false
  );

  const playersCount = mapServer.players.size;
  logger.info('CHAT', `Broadcasting chat message from ${playerData.nickname} to ${playersCount} players (excluding sender)`);
  mapServer.broadcastToMap(chatBroadcast, data.clientId);
}


/**
 * Handler per messaggio 'player_respawn_request'
 */
function handlePlayerRespawnRequest(data, sanitizedData, context) {
  const { ws, mapServer } = context;

  logger.info('RESPAWN', `Player ${data.clientId} requested respawn`);

  // Trova il player
  const playerData = mapServer.players.get(data.clientId);
  if (!playerData) {
    logger.warn('RESPAWN', `Player ${data.clientId} not found for respawn`);
    return undefined;
  }

  // Verifica che il player sia morto
  if (!playerData.isDead) {
    logger.warn('RESPAWN', `Player ${data.clientId} is not dead, cannot respawn`);
    return undefined;
  }

  // Respawna il player usando RespawnCoordinator (separazione responsabilità)
  const RespawnCoordinator = require('../RespawnCoordinator.cjs');
  const RespawnSystem = require('../RespawnSystem.cjs');
  const PlayerStatsSystem = require('../PlayerStatsSystem.cjs');
  const PenaltySystem = require('../PenaltySystem.cjs');

  const respawnCoordinator = new RespawnCoordinator(mapServer);
  respawnCoordinator.setRespawnSystem(new RespawnSystem(mapServer));
  respawnCoordinator.setStatsSystem(new PlayerStatsSystem(mapServer));
  respawnCoordinator.setPenaltySystem(new PenaltySystem(mapServer));

  logger.info('RESPAWN', `Respawning player ${data.clientId}`);
  respawnCoordinator.respawnPlayer(data.clientId);

  return undefined;
}

/**
 * Handler per messaggio 'save_request'
 */
async function handleSaveRequest(data, sanitizedData, context) {
  const { ws, playerData: contextPlayerData, mapServer, authManager, playerDataManager } = context;

  // Fallback a mapServer se playerData non è nel context
  const playerData = contextPlayerData || mapServer.players.get(data.clientId);
  if (!playerData) return;

  // Security check
  const clientIdValidation = authManager.validateClientId(data.clientId, playerData);
  const playerIdValidation = authManager.validatePlayerId(data.playerId, playerData);
  if (!clientIdValidation.valid || !playerIdValidation.valid) {
    logger.error('SECURITY', `🚫 BLOCKED: Save request with invalid client/player ID from clientId:${data.clientId} playerId:${playerData.playerId}`);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Invalid client or player ID for save request.',
      code: 'INVALID_IDS'
    }));
    return;
  }

  try {
    await playerDataManager.savePlayerData(playerData);

    ws.send(JSON.stringify({
      type: 'save_response',
      success: true,
      message: 'Data saved successfully',
      timestamp: Date.now()
    }));
  } catch (error) {
    logger.error('DATABASE', `Error during immediate save for player ${playerData.playerId}: ${error.message}`);

    ws.send(JSON.stringify({
      type: 'save_response',
      success: false,
      message: 'Save failed',
      error: error.message,
      timestamp: Date.now()
    }));
  }
}

/**
 * Handler per messaggio 'global_monitor_request'
 */
function handleGlobalMonitorRequest(data, sanitizedData, context) {
  const { ws, mapServer } = context;

  // Permetti accesso speciale per client "monitor" (dashboard)
  if (data.clientId === 'monitor') {
    const globalState = mapServer.getGlobalGameState();

    ws.send(JSON.stringify({
      type: 'global_monitor_update',
      state: globalState
    }));

    logger.info('GLOBAL_MONITOR', 'Global monitor data sent to dashboard client');
    return;
  }

  // Per client normali, richiedi autenticazione come admin
  const playerData = mapServer.players.get(data.clientId);
  if (!playerData) {
    logger.warn('GLOBAL_MONITOR', `Player ${data.clientId} not found for global monitor request`);
    return;
  }

  // Solo admin possono accedere
  if (!playerData.isAdministrator) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Access denied. Administrator required.',
      code: 'ACCESS_DENIED'
    }));
    return;
  }

  const globalState = mapServer.getGlobalGameState();

  ws.send(JSON.stringify({
    type: 'global_monitor_update',
    state: globalState
  }));

  logger.info('GLOBAL_MONITOR', `Global monitor data sent to admin ${playerData.nickname}`);
}

/**
 * Mappa handler per tipo di messaggio
 */
const handlers = {
  join: handleJoin,
  position_update: handlePositionUpdate,
  heartbeat: handleHeartbeat,
  skill_upgrade_request: handleSkillUpgradeRequest,
  projectile_fired: handleProjectileFired,
  start_combat: handleStartCombat,
  stop_combat: handleStopCombat,
  explosion_created: handleExplosionCreated,
  request_leaderboard: handleRequestLeaderboard,
  request_player_data: handleRequestPlayerData,
  chat_message: handleChatMessage,
  save_request: handleSaveRequest,
  player_respawn_request: handlePlayerRespawnRequest,
  global_monitor_request: handleGlobalMonitorRequest
};

/**
 * Route un messaggio al handler appropriato
 * @param {Object} params
 * @param {string} params.type - Tipo di messaggio
 * @param {Object} params.data - Dati del messaggio originali
 * @param {Object} params.sanitizedData - Dati sanitizzati
 * @param {Object} params.context - Context con tutte le dipendenze
 * @returns {Promise<*>} Risultato dell'handler (può essere playerData per join, undefined per altri)
 */
/**
 * Valida contesto e stato del giocatore prima di processare qualsiasi messaggio
 * CRITICAL SECURITY: Server-side validation totale - ogni messaggio deve essere:
 * 1. Atteso (messaggio conosciuto)
 * 2. Schema valido (già fatto dall'InputValidator)
 * 3. Coerente con stato server
 * 4. Permesso in quel momento
 *
 * NOTA: I messaggi 'join' e 'global_monitor_request' sono ESCLUSI da questa validazione perché:
 * - 'join' crea il playerData
 * - 'global_monitor_request' è usato dalla dashboard di monitoraggio (client speciale)
 */
function validatePlayerContext(type, data, context) {
  const { ws, playerData: contextPlayerData, mapServer, authManager } = context;

  // Fallback a mapServer se playerData non è nel context
  const playerData = contextPlayerData || mapServer.players.get(data.clientId);

  // 🚫 SECURITY: Giocatore deve esistere
  if (!playerData) {
    logger.error('SECURITY', `🚫 BLOCKED: Message ${type} from non-existent player ${data.clientId}`);
    ws.close(1008, 'Player not found');
    return { valid: false, reason: 'PLAYER_NOT_FOUND' };
  }

  // 🚫 SECURITY: Client ID deve corrispondere (accetta anche clientId persistente {playerId})
  const clientIdValidation = authManager.validateClientId(data.clientId, playerData);

  // Controlla se il clientId inviato corrisponde al clientId persistente
  const expectedPersistentClientId = `${playerData.playerId}`;
  const isPersistentClientId = data.clientId === expectedPersistentClientId;

  // SOLUZIONE MIGLIORE: Niente eccezioni - il client deve aspettare il welcome
  // Se riceve messaggi con vecchio clientId, è perché il client è malimplementato
  const allowedWithOldClientId = []; // ZERO eccezioni - massima sicurezza

  if (!clientIdValidation.valid && !isPersistentClientId && !allowedWithOldClientId.includes(type)) {
    // 🚫 SECURITY: Per messaggi critici, blocca e disconnetti
    if (type !== 'heartbeat') {
      logger.error('SECURITY', `🚫 BLOCKED: Message ${type} with invalid clientId from ${data.clientId} playerId:${playerData.playerId} (expected: ${playerData.clientId} or ${expectedPersistentClientId})`);
      ws.close(1008, 'Invalid client ID');
      return { valid: false, reason: 'INVALID_CLIENT_ID' };
    } else {
      // ❤️ MMO-FRIENDLY: Per heartbeat, logga ma ignora (possono essere stale da riconnessioni)
      logger.info('SECURITY', `❤️ IGNORED: Stale heartbeat with invalid clientId from ${data.clientId} playerId:${playerData.playerId} (reconnection artifact)`);
      return { valid: false, reason: 'STALE_HEARTBEAT_IGNORED' };
    }
  }

  // Per heartbeat con clientId vecchio (non persistente), logga ma permetti (riconnessioni)
  if (!clientIdValidation.valid && !isPersistentClientId && type === 'heartbeat') {
    logger.info('SECURITY', `⚠️ ALLOWED: Stale heartbeat from ${data.clientId} playerId:${playerData.playerId} (old clientId, reconnection in progress)`);
  }

  // Per messaggi permessi con vecchio clientId, logga ma permetti
  if (!clientIdValidation.valid && !isPersistentClientId && allowedWithOldClientId.includes(type)) {
    logger.info('SECURITY', `⚠️ ALLOWED: ${type} with old clientId from ${data.clientId} playerId:${playerData.playerId} (sent before welcome)`);
  }

  // 🚫 SECURITY: Player ID deve corrispondere (se presente nel messaggio)
  if (data.playerId) {
    const playerIdValidation = authManager.validatePlayerId(data.playerId, playerData);
    if (!playerIdValidation.valid) {
      logger.error('SECURITY', `🚫 BLOCKED: Message ${type} with invalid playerId from clientId:${data.clientId} playerId:${playerData.playerId}`);
      ws.close(1008, 'Invalid player ID');
      return { valid: false, reason: 'INVALID_PLAYER_ID' };
    }
  }

  // 🚫 SECURITY: Giocatore deve essere vivo per azioni di gioco (eccetto respawn)
  const deathRestrictedActions = ['position_update', 'projectile_fired', 'start_combat', 'skill_upgrade', 'chat_message'];
  if (deathRestrictedActions.includes(type) && playerData.health <= 0) {
    logger.warn('SECURITY', `🚫 BLOCKED: Dead player ${data.clientId} attempted ${type} - health: ${playerData.health}`);
    return { valid: false, reason: 'PLAYER_DEAD' };
  }

  // 🚫 SECURITY: Rate limiting contestuale
  const now = Date.now();

  // Inizializza rate limiting se necessario
  if (!playerData.messageRateLimit) {
    playerData.messageRateLimit = {
      lastMessageTime: now,
      messageCount: 0,
      windowStart: now
    };
  }

  // Reset counter ogni minuto
  if (now - playerData.messageRateLimit.windowStart >= 60000) {
    playerData.messageRateLimit.messageCount = 0;
    playerData.messageRateLimit.windowStart = now;
  }

  // Max 2000 messaggi al minuto per player (aumentato per gameplay fluido)
  playerData.messageRateLimit.messageCount++;
  if (playerData.messageRateLimit.messageCount > 2000) {
    logger.error('SECURITY', `🚫 BLOCKED: Rate limit exceeded for ${data.clientId} playerId:${playerData.playerId} (${playerData.messageRateLimit.messageCount} messages/minute)`);
    ws.close(1008, 'Rate limit exceeded');
    return { valid: false, reason: 'RATE_LIMIT_EXCEEDED' };
  }

  // 🚫 SECURITY: Validazione specifica per tipo di messaggio
  switch (type) {
    case 'position_update':
      // Deve essere in un'area valida della mappa (Map is 21k x 13k, security allows buffer)
      if (data.x < -12000 || data.x > 12000 || data.y < -10000 || data.y > 10000) {
        logger.error('SECURITY', `🚫 BLOCKED: Invalid position (${data.x}, ${data.y}) from ${data.clientId} playerId:${playerData.playerId}`);
        return { valid: false, reason: 'INVALID_POSITION' };
      }
      break;

    case 'projectile_fired':
      // Deve avere munizioni (server-authoritative)
      if (playerData.ammo <= 0) {
        logger.warn('SECURITY', `🚫 BLOCKED: No ammo projectile attempt from ${data.clientId} playerId:${playerData.playerId} (ammo: ${playerData.ammo})`);
        return { valid: false, reason: 'NO_AMMO' };
      }
      break;

    case 'skill_upgrade':
      // Deve avere abbastanza crediti (server-authoritative)
      if (playerData.credits < data.cost) {
        logger.warn('SECURITY', `🚫 BLOCKED: Insufficient credits for upgrade from ${data.clientId} playerId:${playerData.playerId} (has: ${playerData.credits}, needs: ${data.cost})`);
        return { valid: false, reason: 'INSUFFICIENT_CREDITS' };
      }
      break;

    case 'start_combat':
      // Non deve già essere in combattimento
      if (playerData.inCombat) {
        logger.warn('SECURITY', `🚫 BLOCKED: Already in combat attempt from ${data.clientId} playerId:${playerData.playerId}`);
        return { valid: false, reason: 'ALREADY_IN_COMBAT' };
      }
      break;
  }

  return { valid: true };
}

async function routeMessage({ type, data, sanitizedData, context }) {
  const handler = handlers[type];

  if (!handler) {
    logger.warn('ROUTER', `Unknown message type: ${type} from ${data.clientId || 'unknown'}`);
    return undefined;
  }

  // 🔴 CRITICAL SECURITY: Validazione contestuale prima di ogni handler
  // ECCEZIONI: Questi messaggi non richiedono un playerData esistente
  if (type !== 'join' && type !== 'global_monitor_request') {
    const contextValidation = validatePlayerContext(type, data, context);
    if (!contextValidation.valid) {
      // Messaggio già loggato e connessione chiusa se necessario
      return undefined;
    }
  }

  try {
    return await handler(data, sanitizedData, context);
  } catch (error) {
    logger.error('ROUTER', `Error handling message type ${type}: ${error.message}`);
    logger.error('ROUTER', `Stack: ${error.stack}`);

    // Invia errore al client se possibile
    if (context.ws && context.ws.readyState === WebSocket.OPEN) {
      context.ws.send(JSON.stringify({
        type: 'error',
        message: 'Internal server error processing message',
        code: 'INTERNAL_ERROR'
      }));
    }

    throw error;
  }
}

module.exports = {
  routeMessage
};