// MessageRouter - Routing e gestione di tutti i tipi di messaggio WebSocket
// Responsabilità: Gestisce tutti i tipi di messaggio (join, position, combat, chat, etc.)
// Dipendenze: logger.cjs, mapServer, playerDataManager, authManager, messageBroadcaster, core/combat/DamageCalculationSystem.cjs

const { logger } = require('../../logger.cjs');
const ServerLoggerWrapper = require('../infrastructure/ServerLoggerWrapper.cjs');
const WebSocket = require('ws');
const messageBroadcaster = require('../messaging/MessageBroadcaster.cjs');
const DamageCalculationSystem = require('../combat/DamageCalculationSystem.cjs');
const playerConfig = require('../../../shared/player-config.json');
const { MAP_CONFIGS } = require('../../config/MapConfigs.cjs');
const AUTH_AUDIT_LOGS = process.env.AUTH_AUDIT_LOGS === 'true';
const MOVEMENT_AUDIT_LOGS = process.env.MOVEMENT_AUDIT_LOGS === 'true';

async function auditJoinAuthToken(data, context) {
  if (!AUTH_AUDIT_LOGS) return;

  const clientId = data?.clientId || 'unknown';
  const userId = data?.userId;
  const authToken = data?.authToken;
  if (!userId) {
    ServerLoggerWrapper.warn('SECURITY', `[AUTH AUDIT] join missing userId clientId=${clientId}`);
    return;
  }
  if (!authToken) {
    ServerLoggerWrapper.warn('SECURITY', `[AUTH AUDIT] join missing authToken clientId=${clientId} userId=${userId}`);
    return;
  }

  const supabase = context?.playerDataManager?.getSupabaseClient?.();
  if (!supabase?.auth?.getUser) {
    ServerLoggerWrapper.warn('SECURITY', `[AUTH AUDIT] join cannot verify token (supabase auth unavailable) clientId=${clientId} userId=${userId}`);
    return;
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(authToken);
    if (error || !user) {
      ServerLoggerWrapper.warn('SECURITY', `[AUTH AUDIT] join invalid authToken clientId=${clientId} userId=${userId} error=${error?.message || 'unknown'}`);
      return;
    }

    if (user.id !== userId) {
      ServerLoggerWrapper.warn('SECURITY', `[AUTH AUDIT] join authId mismatch clientId=${clientId} userId=${userId} tokenUser=${user.id}`);
    }
  } catch (error) {
    ServerLoggerWrapper.warn('SECURITY', `[AUTH AUDIT] join token verification failed clientId=${clientId} userId=${userId} error=${error.message}`);
  }
}

/**
 * Handler per messaggio 'join'
 */
async function handleJoin(data, sanitizedData, context) {
  const { ws, mapServer, mapManager, playerDataManager, authManager, messageBroadcaster } = context;

  await auditJoinAuthToken(data, context);

  // Carica i dati del giocatore dal database
  let loadedData;
  try {
    loadedData = await playerDataManager.loadPlayerData(data.userId);
    ServerLoggerWrapper.debug('CONNECTION', `Loaded data for ${data.userId}: ${loadedData.items ? loadedData.items.length : 0} items`);

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

  // Seleziona la mappa corretta basata sulla persistenza
  let effectiveMapServer = mapServer;
  console.log(`[MapPersistence DEBUG] loadedData.currentMapId: '${loadedData.currentMapId}', mapManager: ${!!mapManager}`);
  if (loadedData.currentMapId && mapManager) {
    const savedMap = mapManager.getMap(loadedData.currentMapId);
    console.log(`[MapPersistence DEBUG] mapManager.getMap('${loadedData.currentMapId}') returned: ${savedMap ? savedMap.mapId : 'null'}`);
    if (savedMap) {
      effectiveMapServer = savedMap;
      ServerLoggerWrapper.info('CONNECTION', `[MapPersistence] User ${data.nickname} joining saved map: ${loadedData.currentMapId}`);
    }
  }

  // Calcola max health/shield basati sugli upgrade e item equipaggiati
  const maxHealth = authManager.calculateMaxHealth(loadedData.upgrades.hpUpgrades, loadedData.items);
  const maxShield = authManager.calculateMaxShield(loadedData.upgrades.shieldUpgrades, loadedData.items);

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
    quests: loadedData.quests || [],
    items: loadedData.items || []
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
  for (const [existingClientId, existingPlayerData] of effectiveMapServer.players.entries()) {
    if (existingPlayerData.playerId === playerData.playerId && existingClientId !== persistentClientId) {
      ServerLoggerWrapper.security(`🧹 CLEANUP: Removing old instance of player ${playerData.playerId} with clientId ${existingClientId} (reconnection)`);

      // Broadcast player left per il vecchio giocatore
      const playerLeftMsg = messageBroadcaster.formatPlayerLeftMessage(existingClientId);
      effectiveMapServer.broadcastToMap(playerLeftMsg);

      // Rimuovi dalla mappa
      effectiveMapServer.removePlayer(existingClientId);
    }
  }

  // Aggiorna il clientId nel playerData per coerenza
  playerData.clientId = persistentClientId;

  // Persistenza mappa
  playerData.currentMapId = effectiveMapServer.mapId;

  // Rank caricato direttamente dal database (Hybrid System: Fisso + Percentili)
  playerData.rank = loadedData.rank || 'Basic Space Pilot';

  console.log(`[SERVER_RANK_CALC] User ${data.nickname}: Honor=${loadedData.inventory?.honor}, Rank=${playerData.rank} (Calculated by Database)`);

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

  effectiveMapServer.addPlayer(persistentClientId, playerData);

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
    playerData.playerId,
    playerData.rank,
    playerData.position,
    playerData.health,
    playerData.maxHealth,
    playerData.shield,
    playerData.maxShield
  );
  effectiveMapServer.broadcastToMap(playerJoinedMsg, persistentClientId);

  // Invia posizioni dei giocatori esistenti
  effectiveMapServer.players.forEach((existingPlayerData, existingClientId) => {
    if (existingClientId !== persistentClientId && existingPlayerData.position) {
      const existingPlayerBroadcast = {
        type: 'remote_player_update',
        clientId: existingClientId,
        position: existingPlayerData.position,
        rotation: existingPlayerData.position.rotation || 0,
        tick: 0,
        nickname: existingPlayerData.nickname,
        playerId: existingPlayerData.playerId,
        rank: existingPlayerData.rank,
        health: existingPlayerData.health,
        maxHealth: existingPlayerData.maxHealth,
        shield: existingPlayerData.shield,
        maxShield: existingPlayerData.maxShield
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
      rank: playerData.rank,
      health: playerData.health,
      maxHealth: playerData.maxHealth,
      shield: playerData.shield,
      maxShield: playerData.maxShield
    };
    effectiveMapServer.broadcastToMap(newPlayerBroadcast, persistentClientId);
  }

  // Invia solo gli NPC vicini (raggio 5000) per coprire l'intera screenview
  const allNpcs = effectiveMapServer.npcManager.getAllNpcs();
  const joinNpcRadius = 5000;
  const joinNpcRadiusSq = joinNpcRadius * joinNpcRadius;

  const relevantNpcs = allNpcs.filter(npc => {
    const dx = npc.position.x - playerData.position.x;
    const dy = npc.position.y - playerData.position.y;
    return (dx * dx + dy * dy) <= joinNpcRadiusSq;
  });

  if (relevantNpcs.length > 0) {
    const initialNpcsMessage = messageBroadcaster.formatInitialNpcsMessage(relevantNpcs);
    ws.send(JSON.stringify(initialNpcsMessage));
    ServerLoggerWrapper.debug('SERVER', `Sent ${relevantNpcs.length}/${allNpcs.length} initial NPCs to new player ${persistentClientId} in ${effectiveMapServer.mapId}`);
  }

  // Welcome message
  const welcomeMessage = messageBroadcaster.formatWelcomeMessage(
    playerData,
    data.nickname,
    (hp) => authManager.calculateMaxHealth(hp),
    (shield) => authManager.calculateMaxShield(shield),
    playerData.isAdministrator,
    effectiveMapServer.mapId
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
  const rawClientTimestamp = Number.isFinite(data.t) ? data.t : null;

  // AUDIT ONLY: clientTimestamp is used for interpolation/telemetry, not authority.
  if (MOVEMENT_AUDIT_LOGS) {
    if (!playerData.movementAudit) {
      playerData.movementAudit = {
        lastMissingTsLog: 0,
        lastSkewLog: 0
      };
    }

    if (!rawClientTimestamp) {
      if (now - playerData.movementAudit.lastMissingTsLog > 10000) {
        ServerLoggerWrapper.warn('SECURITY', `[MOVEMENT AUDIT] Missing client timestamp in position_update clientId=${data.clientId} playerId=${playerData.playerId}`);
        playerData.movementAudit.lastMissingTsLog = now;
      }
    } else {
      const skewMs = rawClientTimestamp - now;
      const SKEW_LOG_THRESHOLD_MS = 5000;
      if (Math.abs(skewMs) > SKEW_LOG_THRESHOLD_MS && now - playerData.movementAudit.lastSkewLog > 5000) {
        ServerLoggerWrapper.warn('SECURITY', `[MOVEMENT AUDIT] clientTimestamp skew=${skewMs}ms clientId=${data.clientId} playerId=${playerData.playerId}`);
        playerData.movementAudit.lastSkewLog = now;
      }
    }
  }

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

  // 🏳️ SKIP ANTI-TELEPORT CHECKS if player is migrating (allow immediate movement after map change)
  if (playerData.isMigrating) {
    // Still accept and broadcast updates; only bypass anti-teleport validation.
  } else {

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
    // Sync top-level coordinates for safety/legacy compatibility
    playerData.x = sanitizedData.x;
    playerData.y = sanitizedData.y;
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
    rank: playerData.rank,
    health: playerData.health,
    maxHealth: playerData.maxHealth,
    shield: playerData.shield,
    maxShield: playerData.maxShield,
    senderWs: ws,
    // clientTimestamp is used for interpolation timing only (not authoritative)
    // Falls back to server time if client doesn't provide timestamp
    clientTimestamp: data.t || Date.now()
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
    damage: 100,
    missileDamage: 100 // New limit coordinated with others
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
      // Phase 3: Solo Cosmos with 12% growth rate and 3x base multiplier at lv 40
      const cosmos = Math.floor(baseCost.cosmos * 3 * (1 + (currentLevel - 40) * 0.12));
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
      playerData.maxHealth = authManager.calculateMaxHealth(playerData.upgrades.hpUpgrades, playerData.items);
      break;
    case 'shield':
      playerData.upgrades.shieldUpgrades += 1;
      playerData.maxShield = authManager.calculateMaxShield(playerData.upgrades.shieldUpgrades, playerData.items);
      break;
    case 'speed':
      playerData.upgrades.speedUpgrades += 1;
      break;
    case 'damage':
      playerData.upgrades.damageUpgrades += 1;
      break;
    case 'missileDamage':
      playerData.upgrades.missileDamageUpgrades = (playerData.upgrades.missileDamageUpgrades || 0) + 1;
      break;
    default:
      playerData.inventory.credits = oldCredits;
      playerData.inventory.cosmos = oldCosmos;
      return;
  }

  // Ensure health and shield are within current limits after upgrade
  playerData.health = Math.min(playerData.health, playerData.maxHealth);
  playerData.shield = Math.min(playerData.shield, playerData.maxShield);

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
    playerData?.upgrades,
    playerData?.items || []
  );

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
              rankName: 'Basic Space Pilot'
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
      // Usa il rank già calcolato dal database (Hybrid System)
      const rankName = entry.rank_name || 'Basic Space Pilot';

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
    playerData.isAdministrator,
    playerData.rank,
    playerData.items
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

  // 🌍 FIX: Respawn Logic with MAP MIGRATION (Always respawn in 'palantir')
  const TARGET_MAP_ID = 'palantir';

  // Se siamo nella mappa sbagliata (es. singularity), migriamo il player a palantir
  if (mapServer.mapId !== TARGET_MAP_ID) {
    logger.info('RESPAWN', `Player ${data.clientId} died in ${mapServer.mapId}, migrating to ${TARGET_MAP_ID} for respawn`);

    // 1. Revive & apply standard respawn stats (same as local respawn)
    playerData.isDead = false;
    playerData.respawnTime = null;
    const PlayerStatsSystem = require('../PlayerStatsSystem.cjs');
    const statsSystem = new PlayerStatsSystem(mapServer);
    statsSystem.resetPlayerStats(data.clientId);

    // 2. Define Spawn Position (Safe Zone)
    const spawnPos = {
      x: 0 + (Math.random() * 400 - 200),
      y: 0 + (Math.random() * 400 - 200)
    };

    // 3. Notify Client (Clear Death Screen & Update Stats)
    const respawnMsg = {
      type: 'player_respawn',
      clientId: data.clientId,
      position: spawnPos,
      health: playerData.health,
      maxHealth: playerData.maxHealth,
      shield: playerData.shield,
      maxShield: playerData.maxShield
    };
    ws.send(JSON.stringify(respawnMsg));

    // 4. Perform Migration
    if (context.mapManager) {
      context.mapManager.migratePlayer(data.clientId, mapServer.mapId, TARGET_MAP_ID, spawnPos);
      return undefined; // Migration handles the rest
    } else {
      logger.error('RESPAWN', `CRITICAL: MapManager missing for cross-map respawn of ${data.clientId}`);
      // Fallthrough to local respawn as fallback
    }
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
 * Handler per messaggio 'equip_item'
 */
async function handleEquipItem(data, sanitizedData, context) {
  const { ws, playerData: contextPlayerData, mapServer, authManager, playerDataManager } = context;

  // Fallback a mapServer se playerData non è nel context
  const playerData = contextPlayerData || mapServer.players.get(data.clientId);
  if (!playerData) return;

  // Security check
  const clientIdValidation = authManager.validateClientId(data.clientId, playerData);
  if (!clientIdValidation.valid) {
    logger.error('SECURITY', `🚫 BLOCKED: Equip item request with invalid clientId from ${data.clientId}`);
    return;
  }

  const { instanceId, slot } = data;

  if (!playerData.items) {
    playerData.items = [];
  }

  // Trova l'oggetto nell'inventario
  const item = playerData.items.find(i => i.instanceId === instanceId);
  if (!item && instanceId !== null) {
    logger.warn('INVENTORY', `Player ${data.clientId} tried to equip non-existing item ${instanceId}`);
    return;
  }

  // Se instanceId è null, stiamo disequipaggiando lo slot
  if (instanceId === null) {
    // Rimuovi questo slot da tutti gli oggetti equipaggiati
    playerData.items.forEach(i => {
      if (i.slot === slot) i.slot = null;
    });
    logger.info('INVENTORY', `Player ${data.clientId} unequipped slot ${slot}`);
  } else {
    // Rimuovi vecchi equipaggiamenti nello stesso slot
    playerData.items.forEach(i => {
      if (i.slot === slot) i.slot = null;
    });
    // Equipaggia il nuovo oggetto
    item.slot = slot;
    logger.info('INVENTORY', `Player ${data.clientId} equipped ${item.id} (${instanceId}) in slot ${slot}`);
    logger.info('INVENTORY', `Current items state: ${JSON.stringify(playerData.items.map(i => ({ id: i.id, slot: i.slot })))}`);
  }

  // 🔄 RECALCULATE MAX STATS: Ensure server-side max values include item bonuses
  playerData.maxHealth = authManager.calculateMaxHealth(playerData.upgrades.hpUpgrades, playerData.items);
  playerData.maxShield = authManager.calculateMaxShield(playerData.upgrades.shieldUpgrades, playerData.items);

  // 🔒 STAT CAPPING: Ensure current stats don't exceed new max (e.g., when un-equipping hull/shield)
  playerData.health = Math.min(playerData.health, playerData.maxHealth);
  playerData.shield = Math.min(playerData.shield, playerData.maxShield);

  // SAVE IMMEDIATELY: Ensure persistence on every equipment change
  try {
    // Non attendiamo il salvataggio per non bloccare la risposta al client, ma logghiamo eventuali errori
    playerDataManager.savePlayerData(playerData).catch(err => {
      logger.error('DATABASE', `Failed to save equipment change for ${playerData.userId}: ${err.message}`);
    });
  } catch (e) {
    logger.error('DATABASE', `Error triggering save for equipment change: ${e.message}`);
  }

  // Invia aggiornamento stato al client (incluso nuove maxHealth/maxShield)
  ws.send(JSON.stringify({
    type: 'player_state_update',
    inventory: { ...playerData.inventory },
    upgrades: { ...playerData.upgrades },
    items: playerData.items,
    health: playerData.health,
    maxHealth: playerData.maxHealth,
    shield: playerData.shield,
    maxShield: playerData.maxShield,
    source: 'equip_change'
  }));
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
 * Handler per messaggio 'portal_use'
 */
async function handlePortalUse(data, sanitizedData, context) {
  const { ws, mapServer, mapManager, playerData } = context;

  if (!playerData || !mapServer) return;

  const mapConfig = MAP_CONFIGS[mapServer.mapId];
  if (!mapConfig || !mapConfig.portals) return;

  // Trova il portale nel messaggio o il più vicino
  const portals = mapConfig.portals;
  let targetPortal = null;

  // Ottieni posizione attuale del giocatore (usa .position se disponibile)
  const px = playerData.position?.x ?? playerData.x ?? 0;
  const py = playerData.position?.y ?? playerData.y ?? 0;

  if (data.portalId) {
    // Confronta convertendo entrambi in stringa per sicurezza (ID numerico ECS vs ID stringa Config)
    targetPortal = portals.find(p => String(p.id) === String(data.portalId));
  }

  // ⏳ COOLDOWN: 10 Seconds Map Switching Limit
  const now = Date.now();

  if (playerData.lastPortalUseTime && (now - playerData.lastPortalUseTime < 10000)) {
    const remainingSeconds = Math.ceil((10000 - (now - playerData.lastPortalUseTime)) / 1000);
    logger.warn('MAP', `Player ${playerData.clientId} attempted portal use before cooldown (wait ${remainingSeconds}s)`);
    ws.send(JSON.stringify({
      type: 'error',
      message: `Portal recharging. Wait ${remainingSeconds}s.`,
      code: 'PORTAL_COOLDOWN'
    }));
    return;
  }

  // Se non trovato per ID, cerca per prossimità (molto più affidabile)
  if (!targetPortal) {
    for (const portal of portals) {
      const dx = portal.x - px;
      const dy = portal.y - py;
      const distSq = dx * dx + dy * dy;
      if (distSq < 1500 * 1500) { // Range aumentato a 1500px per massima tolleranza
        targetPortal = portal;
        break;
      }
    }
  }

  if (targetPortal) {
    ServerLoggerWrapper.info('MAP', `Player ${playerData.clientId} using portal ${targetPortal.id} -> ${targetPortal.targetMap}`);
    playerData.lastPortalUseTime = Date.now(); // Set cooldown timestamp
    playerData.isMigrating = true; // 🏳️ Flag to suppress teleport warnings
    setTimeout(() => { playerData.isMigrating = false; }, 2000); // Reset after 2s
    mapManager.migratePlayer(playerData.clientId, mapServer.mapId, targetPortal.targetMap, targetPortal.targetPosition);
  } else {
    ServerLoggerWrapper.warn('MAP', `Player ${playerData.clientId} attempted to use portal but none found nearby.`);
  }
}
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
  equip_item: handleEquipItem,
  player_respawn_request: handlePlayerRespawnRequest,
  global_monitor_request: handleGlobalMonitorRequest,
  portal_use: handlePortalUse,
  quest_progress_update: handleQuestProgressUpdate,
  quest_accept: handleQuestAccept,
  quest_abandon: handleQuestAbandon
};

/**
 * Handler per messaggio 'quest_progress_update'
 * Sincronizza gli obiettivi delle quest dal client al server per permettere il salvataggio corretto
 */
function handleQuestProgressUpdate(data, sanitizedData, context) {
  const { ws, playerData: contextPlayerData, mapServer } = context;

  const playerData = contextPlayerData || mapServer.players.get(data.clientId);
  if (!playerData) return;

  const { questId, objectives } = sanitizedData;

  if (!questId || !Array.isArray(objectives)) {
    logger.warn('QUEST', `Invalid quest update data from ${data.clientId}`);
    return;
  }

  // Trova la quest nei dati del player in memoria
  const quest = playerData.quests ? playerData.quests.find(q =>
    (q.quest_id === questId || q.id === questId)
  ) : null;

  if (quest) {
    // Aggiorna gli obiettivi in memoria
    quest.objectives = objectives;
    logger.debug('QUEST', `Updated objectives for quest ${questId} for player ${playerData.nickname}`);
  } else {
    // Se la quest non esiste in memoria (es. appena accettata lato client ma non ancora syncata?),
    // potremmo doverla aggiungere, ma per ora ci concentriamo sull'aggiornamento di obiettivi esistenti.
    // Le nuove quest dovrebbero essere gestite da 'quest_accept' o ricaricate.
    // Tuttavia, se il flusso di accettazione è client-side only e poi syncata, dovremmo gestirla qui.
    // MA: In questo sistema, accettazione quest sembra essere client-side logic + sync.
    // Se non troviamo la quest, loggiamo warning.
    logger.warn('QUEST', `Quest ${questId} not found in memory for player ${playerData.nickname} during update`);
  }
}

/**
 * Handler per messaggio 'quest_accept'
 */
async function handleQuestAccept(data, sanitizedData, context) {
  const { ws, playerData: contextPlayerData, mapServer } = context;
  const playerData = contextPlayerData || mapServer.players.get(data.clientId);
  if (!playerData) return;

  const { questId } = sanitizedData;
  if (!questId) return;

  if (mapServer.questManager) {
    await mapServer.questManager.acceptQuest(playerData, questId);
  }
}

/**
 * Handler per messaggio 'quest_abandon'
 */
async function handleQuestAbandon(data, sanitizedData, context) {
  const { ws, playerData: contextPlayerData, mapServer } = context;
  const playerData = contextPlayerData || mapServer.players.get(data.clientId);
  if (!playerData) return;

  const { questId } = sanitizedData;
  if (!questId) return;

  if (mapServer.questManager) {
    await mapServer.questManager.abandonQuest(playerData, questId);
  }
}

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
  const deathRestrictedActions = ['position_update', 'projectile_fired', 'start_combat', 'skill_upgrade', 'chat_message', 'portal_use', 'quest_accept', 'quest_abandon'];
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
