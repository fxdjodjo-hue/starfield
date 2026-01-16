// MessageRouter - Routing e gestione di tutti i tipi di messaggio WebSocket
// Responsabilità: Gestisce tutti i tipi di messaggio (join, position, combat, chat, etc.)
// Dipendenze: logger.cjs, mapServer, playerDataManager, authManager, messageBroadcaster, core/combat/DamageCalculationSystem.cjs

const { logger } = require('../../logger.cjs');
const WebSocket = require('ws');
const DamageCalculationSystem = require('../combat/DamageCalculationSystem.cjs');

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
      logger.error('JOIN', `Invalid player data loaded for ${data.userId}: playerId=${loadedData?.playerId}`);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid player data. Please contact support.',
        code: 'INVALID_PLAYER_DATA'
      }));
      ws.close(1008, 'Invalid player data');
      return null;
    }
  } catch (error) {
    logger.error('JOIN', `Failed to load player data for ${data.userId}: ${error.message}`);
    
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
    health: authManager.calculateMaxHealth(loadedData.upgrades.hpUpgrades),
    maxHealth: authManager.calculateMaxHealth(loadedData.upgrades.hpUpgrades),
    shield: authManager.calculateMaxShield(loadedData.upgrades.shieldUpgrades),
    maxShield: authManager.calculateMaxShield(loadedData.upgrades.shieldUpgrades),
    lastDamage: null,
    isDead: false,
    respawnTime: null,
    inventory: loadedData.inventory,
    quests: loadedData.quests || []
  };

  // Verifica che inventory sia presente
  if (!playerData.inventory) {
    logger.error('JOIN', `🚨 CRITICAL: Player ${data.userId} joined with null inventory!`);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to load player inventory. Please contact support.',
      code: 'INVENTORY_LOAD_FAILED'
    }));
    ws.close(1008, 'Inventory load failed');
    return null;
  }

  mapServer.addPlayer(data.clientId, playerData);

  logger.info('PLAYER', `Player joined: ${data.clientId}`);
  logger.info('PLAYER', `  Nickname: ${data.nickname}`);
  logger.info('PLAYER', `  Player ID: ${playerData.playerId}`);
  logger.info('PLAYER', `  User ID: ${data.userId}`);
  logger.info('SERVER', `Total connected players: ${mapServer.players.size}`);

  if (mapServer.players.size >= 10) {
    logger.warn('SERVER', `High player count: ${mapServer.players.size} players connected`);
  }

  // Broadcast player joined
  const playerJoinedMsg = messageBroadcaster.formatPlayerJoinedMessage(
    data.clientId,
    data.nickname,
    playerData.playerId
  );
  mapServer.broadcastToMap(playerJoinedMsg, data.clientId);

  // Invia posizioni dei giocatori esistenti
  mapServer.players.forEach((existingPlayerData, existingClientId) => {
    if (existingClientId !== data.clientId && existingPlayerData.position) {
      const existingPlayerBroadcast = {
        type: 'remote_player_update',
        clientId: existingClientId,
        position: existingPlayerData.position,
        rotation: existingPlayerData.position.rotation || 0,
        tick: 0,
        nickname: existingPlayerData.nickname,
        playerId: existingPlayerData.playerId
      };
      ws.send(JSON.stringify(existingPlayerBroadcast));
    }
  });

  // Invia NPC esistenti
  const allNpcs = mapServer.npcManager.getAllNpcs();
  if (allNpcs.length > 0) {
    const initialNpcsMessage = messageBroadcaster.formatInitialNpcsMessage(allNpcs);
    ws.send(JSON.stringify(initialNpcsMessage));
    logger.info('SERVER', `Sent ${allNpcs.length} initial NPCs to new player ${data.clientId}`);
  }

  // Welcome message
  const welcomeMessage = messageBroadcaster.formatWelcomeMessage(
    playerData,
    data.nickname,
    (hp) => authManager.calculateMaxHealth(hp),
    (shield) => authManager.calculateMaxShield(shield)
  );
  
  try {
    ws.send(JSON.stringify(welcomeMessage));
  } catch (error) {
    console.error('❌ [SERVER] Failed to send welcome message:', error);
  }

  // Invia la posizione del nuovo giocatore a tutti gli altri giocatori
  if (data.position) {
    mapServer.broadcastToMap({
      type: 'remote_player_update',
      clientId: data.clientId,
      position: data.position,
      rotation: data.position.rotation || 0,
      tick: 0,
      nickname: data.nickname,
      playerId: playerData.playerId
    }, data.clientId);
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

  playerData.lastInputAt = new Date().toISOString();

  if (Number.isFinite(sanitizedData.x) && Number.isFinite(sanitizedData.y)) {
    playerData.position = {
      x: sanitizedData.x,
      y: sanitizedData.y,
      rotation: sanitizedData.rotation,
      velocityX: sanitizedData.velocityX || 0,
      velocityY: sanitizedData.velocityY || 0
    };
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
    logger.error('SECURITY', `🚫 BLOCKED: Skill upgrade attempt with mismatched playerId from ${data.clientId}`);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Invalid player ID for skill upgrade.',
      code: 'INVALID_PLAYER_ID'
    }));
    return;
  }

  const baseUpgradeCosts = {
    hp: { credits: 5000, cosmos: 10 },
    shield: { credits: 3000, cosmos: 5 },
    speed: { credits: 8000, cosmos: 15 },
    damage: { credits: 10000, cosmos: 20 }
  };

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
    logger.error('SECURITY', `🚫 BLOCKED: Projectile fire attempt with mismatched playerId from ${data.clientId}`);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Invalid player ID for projectile action.',
      code: 'INVALID_PLAYER_ID'
    }));
    return;
  }

  let targetId = data.targetId || null;
  if (!targetId) {
    const playerCombat = mapServer.combatManager.playerCombats.get(data.clientId);
    if (playerCombat) {
      targetId = playerCombat.npcId;
    }
  }

  // Server authoritative damage calculation (usa DamageCalculationSystem)
  const baseDamage = DamageCalculationSystem.getBasePlayerDamage();
  const calculatedDamage = DamageCalculationSystem.calculatePlayerDamage(
    baseDamage,
    playerData?.upgrades
  );

  mapServer.projectileManager.addProjectile(
    data.projectileId,
    data.playerId,
    data.position,
    data.velocity,
    calculatedDamage,
    data.projectileType || 'laser',
    targetId
  );

  const projectileMessage = {
    type: 'projectile_fired',
    projectileId: data.projectileId,
    playerId: data.playerId,
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
  const { ws, playerData: contextPlayerData, mapServer, authManager, messageBroadcaster } = context;
  
  // Fallback a mapServer se playerData non è nel context
  const playerData = contextPlayerData || mapServer.players.get(data.clientId);
  if (!playerData) {
    logger.warn('COMBAT', `Player data not found for clientId: ${data.clientId}`);
    return;
  }

  // Security check
  const playerIdValidation = authManager.validatePlayerId(data.playerId, playerData);
  if (!playerIdValidation.valid) {
    logger.error('SECURITY', `🚫 BLOCKED: Combat start attempt with mismatched playerId from ${data.clientId}`);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Invalid player ID for combat action.',
      code: 'INVALID_PLAYER_ID'
    }));
    return;
  }

  const npc = mapServer.npcManager.getNpc(data.npcId);
  if (!npc) {
    logger.error('COMBAT', `START_COMBAT: NPC ${data.npcId} not found`);
    return;
  }

  mapServer.combatManager.startPlayerCombat(data.clientId, data.npcId);

  const combat = mapServer.combatManager.playerCombats.get(data.clientId);
  if (combat) {
    mapServer.combatManager.processPlayerCombat(data.clientId, combat, Date.now());
  } else {
    console.error(`❌ [SERVER] Combat not found after startPlayerCombat for ${data.clientId}`);
  }

  const combatUpdate = messageBroadcaster.formatCombatUpdateMessage(
    data.playerId,
    data.npcId,
    true
  );
  mapServer.broadcastToMap(combatUpdate);
}

/**
 * Handler per messaggio 'stop_combat'
 */
function handleStopCombat(data, sanitizedData, context) {
  const { playerData: contextPlayerData, mapServer, messageBroadcaster } = context;
  
  // Fallback a mapServer se playerData non è nel context
  const playerData = contextPlayerData || mapServer.players.get(data.clientId);
  if (!playerData) return;

  mapServer.combatManager.stopPlayerCombat(data.clientId);

  const combatUpdate = messageBroadcaster.formatCombatUpdateMessage(
    data.playerId,
    null,
    false
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

    logger.info('LEADERBOARD', `Requesting leaderboard: sortBy=${sortBy}, limit=${limit}`);

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

    logger.info('LEADERBOARD', `RPC response:`, {
      hasData: !!leaderboardData,
      dataType: Array.isArray(leaderboardData) ? 'array' : typeof leaderboardData,
      dataLength: Array.isArray(leaderboardData) ? leaderboardData.length : 'N/A',
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
      const rankName = authManager.calculateRankName(rankingPoints);
      
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
    logger.error('SECURITY', `🚫 BLOCKED: Player data request with mismatched playerId from ${data.clientId}`);
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
    logger.warn('SECURITY', `🚫 BLOCKED: Chat message with mismatched clientId. Received: ${data.clientId}, Expected: ${playerData?.clientId}`);
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
    playerData.playerId || null
  );

  const playersCount = mapServer.players.size;
  logger.info('CHAT', `Broadcasting chat message from ${playerData.nickname} to ${playersCount} players (excluding sender)`);
  mapServer.broadcastToMap(chatBroadcast, data.clientId);
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
    logger.error('SECURITY', `🚫 BLOCKED: Save request with invalid client/player ID from ${data.clientId}`);
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
  save_request: handleSaveRequest
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
async function routeMessage({ type, data, sanitizedData, context }) {
  const handler = handlers[type];
  
  if (!handler) {
    logger.warn('ROUTER', `Unknown message type: ${type} from ${data.clientId || 'unknown'}`);
    return undefined;
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
