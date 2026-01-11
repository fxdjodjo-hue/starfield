// WebSocketConnectionManager - Gestione connessioni e messaggi WebSocket
// Dipendenze consentite: logger.cjs, messageCount, mapServer, wss

const { logger } = require('../logger.cjs');
const { createClient } = require('@supabase/supabase-js');
const ServerInputValidator = require('./InputValidator.cjs');
const { BoundaryEnforcement } = require('../../shared/SecurityBoundary.cjs');

// Supabase client (usiamo la stessa istanza del server principale)
const supabaseUrl = process.env.SUPABASE_URL || 'https://euvlanwkqzhqnbwbvwis.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

class WebSocketConnectionManager {
  constructor(wss, mapServer, messageCount) {
    this.wss = wss;
    this.mapServer = mapServer;
    this.messageCount = messageCount;
    this.inputValidator = new ServerInputValidator();

    // Logging throttling per performance
    this.validationWarningCount = 0;
    this.lastValidationWarning = 0;
    this.securityWarningCount = 0;
    this.lastSecurityWarning = 0;

    this.setupConnectionHandling();
    this.setupShutdownHandling();
    this.setupPeriodicSave();
  }

  /**
   * Imposta il salvataggio periodico dei dati dei giocatori
   */
  setupPeriodicSave() {
    // Salva i dati di tutti i giocatori ogni 5 minuti
    setInterval(async () => {
      try {
        logger.info('DATABASE', 'Starting periodic save of all player data...');

        for (const [clientId, playerData] of this.mapServer.players) {
          if (playerData && playerData.playerId) {
            await this.savePlayerData(playerData);
          }
        }

        logger.info('DATABASE', 'Periodic save completed');
      } catch (error) {
        logger.error('DATABASE', `Error during periodic save: ${error.message}`);
      }
    }, 5 * 60 * 1000); // 5 minuti

    logger.info('DATABASE', 'Periodic save system initialized (every 5 minutes)');
  }

  /**
   * Carica i dati del giocatore dal database Supabase
   */
  async loadPlayerData(userId) {
    try {
      logger.info('DATABASE', `Loading player data for user: ${userId}`);

      // Carica TUTTO in una singola query ottimizzata
      logger.info('DATABASE', `🔍 Loading complete player data for user ${userId}`);
      const { data: completeData, error: dataError } = await supabase.rpc(
        'get_player_complete_data_secure',
        { auth_id_param: userId }
      );

      if (dataError) {
        logger.error('DATABASE', `❌ Complete data load error for user ${userId}:`, dataError);
        throw dataError;
      }

      // PostgreSQL RPC restituisce sempre un array, prendiamo il primo elemento
      const playerDataRaw = Array.isArray(completeData) && completeData.length > 0 ? completeData[0] : completeData;

      if (!playerDataRaw || !playerDataRaw.found) {
        // PROFILO NON TROVATO - BLOCCO TOTALE ACCESSO
        logger.error('SECURITY', `🚫 BLOCKED: User ${userId} attempted to play without profile`);
        throw new Error(`ACCESS DENIED: You must register and create a profile before playing. Please register first.`);
      }

      // Costruisci playerData con i dati reali del database
      const playerData = {
        playerId: playerDataRaw.player_id, // player_id NUMERICO per display/HUD
        userId: userId,     // auth_id per identificazione
        nickname: playerDataRaw.username || 'Unknown',
        position: { x: 0, y: 0, rotation: 0 }, // Posizione verrà impostata dal client
        inventory: (() => {
          const currencies = playerDataRaw.currencies_data ? JSON.parse(playerDataRaw.currencies_data) : this.getDefaultPlayerData().inventory;
          // Assicurati che skillPoints sia sempre definito e un numero valido (compatibilità con skill_points_current)
          currencies.skillPoints = Number(currencies.skillPoints || currencies.skill_points_current || 0);
          return currencies;
        })(),
        upgrades: playerDataRaw.upgrades_data ? JSON.parse(playerDataRaw.upgrades_data) : this.getDefaultPlayerData().upgrades,
        quests: playerDataRaw.quests_data ? JSON.parse(playerDataRaw.quests_data) : []
      };

      logger.info('DATABASE', `Complete player data loaded successfully for user ${userId} (player_id: ${playerData.playerId})`);
      logger.info('DATABASE', `Loaded currencies:`, playerData.inventory);
      console.log(`[DEBUG_LOAD] DATABASE: experience=${playerData.inventory.experience}, honor=${playerData.inventory.honor}, credits=${playerData.inventory.credits}`);
      return playerData;

    } catch (error) {
      logger.error('DATABASE', `Error loading player data: ${error.message}`);
      // In caso di errore, restituisci dati di default ma con playerId = 0
      const defaultData = this.getDefaultPlayerData();
      defaultData.playerId = 0; // Segnala che non c'è profilo valido
      defaultData.userId = userId; // Mantieni l'userId per la sicurezza
      return defaultData;
    }
  }

  /**
   * Crea i record iniziali per un nuovo giocatore
   */
  async createInitialPlayerRecords(playerId) {
    try {
      // Stats iniziali
      await supabase.from('player_stats').insert({
        auth_id: playerId,
        kills: 0,
        deaths: 0,
        missions_completed: 0,
        play_time: 0
      });

      // Upgrades iniziali
      await supabase.from('player_upgrades').insert({
        auth_id: playerId,
        hp_upgrades: 0,
        shield_upgrades: 0,
        speed_upgrades: 0,
        damage_upgrades: 0
      });

      // Currencies iniziali
      await supabase.from('player_currencies').insert({
        auth_id: playerId,
        credits: 1000,
        cosmos: 100,
        experience: 0,
        honor: 0,
        skill_points: 0,
        skill_points_total: 0
      });

      logger.info('DATABASE', `Created initial records for player ${playerId}`);
    } catch (error) {
      logger.error('DATABASE', `Error creating initial records: ${error.message}`);
    }
  }

  /**
   * Salva i dati del giocatore nel database
   */
  async savePlayerData(playerData) {
    try {
      if (!playerData || !playerData.playerId) {
        logger.warn('DATABASE', 'Cannot save player data: invalid player data');
        return;
      }

      const playerId = playerData.userId; // Usa auth_id invece del player_id numerico
      logger.info('DATABASE', `Saving player data for player ID: ${playerId}`);
      logger.info('DATABASE', `Player data to save:`, {
        stats: playerData.stats,
        upgrades: playerData.upgrades,
        inventory: playerData.inventory,
        quests: playerData.quests ? playerData.quests.length : 0
      });

      // Prepare data for secure RPC function
      const statsData = playerData.stats ? {
        kills: playerData.stats.kills || 0,
        deaths: playerData.stats.deaths || 0,
        missions_completed: playerData.stats.missions_completed || 0,
        play_time: playerData.stats.play_time || 0
      } : null;

      const upgradesData = playerData.upgrades ? {
        hp_upgrades: playerData.upgrades.hpUpgrades || 0,
        shield_upgrades: playerData.upgrades.shieldUpgrades || 0,
        speed_upgrades: playerData.upgrades.speedUpgrades || 0,
        damage_upgrades: playerData.upgrades.damageUpgrades || 0
      } : null;

      const currenciesData = playerData.inventory ? {
        credits: playerData.inventory.credits || 0,
        cosmos: playerData.inventory.cosmos || 0,
        experience: playerData.inventory.experience || 0,
        honor: playerData.inventory.honor || 0,
        skill_points: playerData.inventory.skillPoints || 0,
        skill_points_total: playerData.inventory.skill_points_total || playerData.inventory.skillPoints || 0,
        skill_points_current: playerData.inventory.skillPoints || 0 // Aggiunto per compatibilità
      } : null;

      console.log(`[DEBUG_EXP] SERVER SAVE: Experience being saved: ${currenciesData?.experience}`);

      // Use secure RPC function instead of direct table access
      logger.info('DATABASE', `Calling update_player_data_secure RPC for auth_id: ${playerId}`);
      const { data: updateResult, error: updateError } = await supabase.rpc(
        'update_player_data_secure',
        {
          auth_id_param: playerId,
          stats_data: statsData,
          upgrades_data: upgradesData,
          currencies_data: currenciesData,
          quests_data: null // Quests handled separately below
        }
      );

      if (updateError) {
        logger.error('DATABASE', `Error saving player data via RPC:`, updateError);
      } else {
        logger.info('DATABASE', `Successfully saved player data via RPC for player ID: ${playerId}`);
      }

      // Salva quest progress (quests need separate handling as noted in RPC function)
      if (playerData.quests && Array.isArray(playerData.quests)) {
        logger.info('DATABASE', `Saving quest progress for auth_id: ${playerId}`);
        for (const quest of playerData.quests) {
          const questResult = await supabase.from('quest_progress').upsert({
            auth_id: playerId,
            quest_id: quest.quest_id,
            objectives: quest.objectives || [],
            is_completed: quest.is_completed || false,
            started_at: quest.started_at || new Date().toISOString(),
            completed_at: quest.completed_at || null
          });
          if (questResult.error) {
            logger.error('DATABASE', `Error saving quest ${quest.quest_id}:`, questResult.error);
          }
        }
        logger.info('DATABASE', `Quest progress saved successfully`);
      }

      logger.info('DATABASE', `Player data saved successfully for player ID: ${playerId}`);
    } catch (error) {
      logger.error('DATABASE', `Error saving player data: ${error.message}`);
    }
  }

  /**
   * Restituisce i dati di default per un nuovo giocatore
   */
  getDefaultPlayerData() {
    return {
      playerId: 0,
      stats: {
        kills: 0,
        deaths: 0,
        missions_completed: 0,
        play_time: 0
      },
      upgrades: {
        hpUpgrades: 0,
        shieldUpgrades: 0,
        speedUpgrades: 0,
        damageUpgrades: 0
      },
      inventory: {
        credits: 1000,
        cosmos: 100,
        experience: 0,
        honor: 0,
        skillPoints: 0
      },
      quests: []
    };
  }

  /**
   * Configura la gestione delle connessioni WebSocket
   */
  setupConnectionHandling() {
    this.wss.on('connection', (ws) => {
      logger.info('SERVER', 'New client connected');
      let playerData = null;

      // Gestisce messaggi dal client
      ws.on('message', async (message) => {
        this.messageCount.increment();
        try {
          const data = JSON.parse(message.toString());

          // INPUT VALIDATION: valida struttura messaggio
          const structureValidation = this.inputValidator.validateMessageStructure(data);
          if (!structureValidation.isValid) {
            logger.warn('VALIDATION', `Invalid message structure from ${data.clientId || 'unknown'}: ${structureValidation.errors.join(', ')}`);
            return;
          }

          // INPUT VALIDATION: valida contenuto specifico
          const contentValidation = this.inputValidator.validate(data.type, data);
          if (!contentValidation.isValid) {
            // LOGGING THROTTLING: limita logging per performance ma permetti throughput
            this.validationWarningCount++;
            const now = Date.now();
            if (now - this.lastValidationWarning > 5000 || this.validationWarningCount % 50 === 0) {
              const clientInfo = data.clientId || 'unknown';
              const summary = `${this.validationWarningCount} invalid messages in last period`;
              logger.warn('VALIDATION', `Invalid content from ${clientInfo} (${data.type}): ${contentValidation.errors[0]}... (${summary})`);
              this.lastValidationWarning = now;
              this.validationWarningCount = 0; // Reset counter
            }
            return;
          }

          // SECURITY BOUNDARY: verifica intent del client
          const intentValidation = BoundaryEnforcement.validateClientIntent(data.type, data);
          if (!intentValidation.allowed) {
            // LOGGING THROTTLING: limita logging security per performance
            this.securityWarningCount++;
            const now = Date.now();
            if (now - this.lastSecurityWarning > 5000 || this.securityWarningCount % 5 === 0) {
              const clientInfo = data.clientId || 'unknown';
              const summary = `${this.securityWarningCount} security violations in last period`;
              logger.error('SECURITY', `Intent violation from ${clientInfo}: ${intentValidation.reason} (${summary})`);
              this.lastSecurityWarning = now;
              this.securityWarningCount = 0; // Reset counter
            }
            return;
          }

          // Usa dati sanitizzati per elaborazione successiva
          const sanitizedData = contentValidation.sanitizedData;

          // Risponde ai messaggi di join
          if (data.type === 'join') {
            // Carica i dati del giocatore dal database invece di usare valori hardcoded
            const loadedData = await this.loadPlayerData(data.userId);

            playerData = {
              clientId: data.clientId,
              nickname: data.nickname,
              playerId: loadedData.playerId, // Usa player_id numerico dal database
              userId: data.userId,
              connectedAt: new Date().toISOString(),
              lastInputAt: null,
              position: data.position, // Save initial position from join message
              ws: ws,
              // Player Upgrades (server authoritative) - da database
              upgrades: loadedData.upgrades,
              // Health and shield system (server authoritative)
              health: this.calculateMaxHealth(loadedData.upgrades.hpUpgrades),
              maxHealth: this.calculateMaxHealth(loadedData.upgrades.hpUpgrades),
              shield: this.calculateMaxShield(loadedData.upgrades.shieldUpgrades),
              maxShield: this.calculateMaxShield(loadedData.upgrades.shieldUpgrades),
              // Combat state
              lastDamage: null,
              isDead: false,
              respawnTime: null,
              // Inventory system (server authoritative) - da database
              inventory: loadedData.inventory,
              // Quest progress - da database
              quests: loadedData.quests || []
            };

            this.mapServer.addPlayer(data.clientId, playerData);

            logger.info('PLAYER', `Player joined: ${data.clientId}`);
            logger.info('PLAYER', `  Nickname: ${data.nickname}`);
            logger.info('PLAYER', `  Player ID: ${playerData.playerId}`);
            logger.info('PLAYER', `  User ID: ${data.userId}`);
            logger.info('SERVER', `Total connected players: ${this.mapServer.players.size}`);

            // Log di avviso se ci sono molti giocatori
            if (this.mapServer.players.size >= 10) {
              logger.warn('SERVER', `High player count: ${this.mapServer.players.size} players connected`);
            }

            this.mapServer.broadcastToMap({
              type: 'player_joined',
              clientId: data.clientId,
              nickname: data.nickname,
              playerId: playerData.playerId
            }, data.clientId);

            // Invia le posizioni di tutti i giocatori già connessi al nuovo giocatore
            this.mapServer.players.forEach((playerData, existingClientId) => {
              if (existingClientId !== data.clientId && playerData.position) {
                const existingPlayerBroadcast = {
                  type: 'remote_player_update',
                  clientId: existingClientId,
                  position: playerData.position,
                  rotation: playerData.position.rotation || 0,
                  tick: 0,
                  nickname: playerData.nickname,
                  playerId: playerData.playerId
                };
                ws.send(JSON.stringify(existingPlayerBroadcast));
              }
            });

            // Invia tutti gli NPC esistenti al nuovo giocatore
            const allNpcs = this.mapServer.npcManager.getAllNpcs();
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
              logger.info('SERVER', `Sent ${allNpcs.length} initial NPCs to new player ${data.clientId}`);
            }

            const welcomeMessage = {
              type: 'welcome',
              clientId: data.clientId,
              playerId: playerData.userId, // UUID dell'utente (auth_id)
              playerDbId: playerData.playerId, // Player ID numerico per display/HUD
              message: `Welcome ${data.nickname}! Connected to server.`,
              initialState: {
                // Solo dati critici per iniziare il gioco
                position: {
                  x: playerData.position?.x || 0,
                  y: playerData.position?.y || 0,
                  rotation: playerData.position?.rotation || 0
                },
                // I dati dettagliati verranno richiesti dal client dopo l'inizializzazione
                inventoryLazy: true,  // Flag per indicare lazy loading
                upgradesLazy: true,
                questsLazy: true,
                // Dati essenziali calcolati server-side
                health: this.calculateMaxHealth(playerData.upgrades.hpUpgrades),
                maxHealth: this.calculateMaxHealth(playerData.upgrades.hpUpgrades),
                shield: this.calculateMaxShield(playerData.upgrades.shieldUpgrades),
                maxShield: this.calculateMaxShield(playerData.upgrades.shieldUpgrades)
              }
            };

            try {
              ws.send(JSON.stringify(welcomeMessage));
            } catch (error) {
              console.error('❌ [SERVER] Failed to send welcome message:', error);
            }

            // Invia la posizione del nuovo giocatore a tutti gli altri giocatori
            if (data.position) {
              this.mapServer.broadcastToMap({
                type: 'remote_player_update',
                clientId: data.clientId,
                position: data.position,
                rotation: data.position.rotation || 0,
                tick: 0,
                nickname: data.nickname,
                playerId: playerData.playerId
              }, data.clientId);
            }
          }

          // Gestisce aggiornamenti posizione del player
          if (data.type === 'position_update') {
            if (playerData) {
              playerData.lastInputAt = new Date().toISOString();

              // Aggiorna posizione e velocità solo se i dati sono validi
              if (Number.isFinite(sanitizedData.x) && Number.isFinite(sanitizedData.y)) {
                playerData.position = {
                  x: sanitizedData.x,
                  y: sanitizedData.y,
                  rotation: sanitizedData.rotation,
                  velocityX: sanitizedData.velocityX || 0,
                  velocityY: sanitizedData.velocityY || 0
                };
              }

              // Posizione aggiornata (logging limitato per evitare spam)

              // Aggiungi alla queue invece di broadcastare immediatamente
              if (!this.mapServer.positionUpdateQueue.has(data.clientId)) {
                this.mapServer.positionUpdateQueue.set(data.clientId, []);
              }

              this.mapServer.positionUpdateQueue.get(data.clientId).push({
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

              // Limita la dimensione della queue per client (max 5 aggiornamenti recenti)
              const clientQueue = this.mapServer.positionUpdateQueue.get(data.clientId);
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

          // Gestisce aggiornamenti upgrade del player (Server Authoritative)
          if (data.type === 'player_upgrades_update') {
            const playerData = this.mapServer.players.get(data.clientId);
            if (!playerData) {
              logger.warn('PLAYER_UPGRADES', `Player data not found for clientId: ${data.clientId}`);
              return;
            }

            // 🔴 CRITICAL SECURITY: Verifica che il playerId corrisponda al client autenticato
            if (data.playerId !== playerData.userId) {
              logger.error('SECURITY', `🚫 BLOCKED: Upgrade update attempt with mismatched playerId from ${data.clientId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid player ID for upgrade action.',
                code: 'INVALID_PLAYER_ID'
              }));
              return;
            }

            // Aggiorna gli upgrade del player con quelli ricevuti dal client
            playerData.upgrades = { ...data.upgrades };
          }

          // Gestisce richieste di upgrade skill (Server Authoritative)
          if (data.type === 'skill_upgrade_request') {
            const playerData = this.mapServer.players.get(data.clientId);
            if (!playerData) {
              logger.warn('SKILL_UPGRADE', `Player data not found for clientId: ${data.clientId}`);
              return;
            }

            // 🔴 CRITICAL SECURITY: Verifica che il playerId corrisponda al client autenticato
            if (data.playerId !== playerData.userId) {
              logger.error('SECURITY', `🚫 BLOCKED: Skill upgrade attempt with mismatched playerId from ${data.clientId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid player ID for skill upgrade.',
                code: 'INVALID_PLAYER_ID'
              }));
              return;
            }

            // Verifica se il player ha abbastanza skill points
            const currentSkillPoints = Number(playerData.inventory.skillPoints || 0);
            if (currentSkillPoints < 1) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Not enough skill points for upgrade',
                code: 'INSUFFICIENT_SKILL_POINTS'
              }));
              return;
            }

            // Salva stato precedente per confronto
            const oldSkillPoints = currentSkillPoints;
            const oldUpgrades = JSON.parse(JSON.stringify(playerData.upgrades));

            // Sposta 1 skill point dall'inventory agli upgrade
            playerData.inventory.skillPoints = currentSkillPoints - 1;

            // Applica l'upgrade specifico
            switch (data.upgradeType) {
              case 'hp':
                playerData.upgrades.hpUpgrades += 1;
                // Aggiorna maxHealth con il nuovo upgrade
                playerData.maxHealth = this.calculateMaxHealth(playerData.upgrades.hpUpgrades);
                break;
              case 'shield':
                playerData.upgrades.shieldUpgrades += 1;
                // Aggiorna maxShield con il nuovo upgrade
                playerData.maxShield = this.calculateMaxShield(playerData.upgrades.shieldUpgrades);
                break;
              case 'speed':
                playerData.upgrades.speedUpgrades += 1;
                break;
              case 'damage':
                playerData.upgrades.damageUpgrades += 1;
                break;
              default:
                // Rollback skill points
                playerData.inventory.skillPoints = currentSkillPoints;
                return;
            }

            // Invia aggiornamento completo dello stato al client
            ws.send(JSON.stringify({
              type: 'player_state_update',
              inventory: { ...playerData.inventory },
              upgrades: { ...playerData.upgrades },
              health: playerData.health,
              maxHealth: playerData.maxHealth,
              shield: playerData.shield,
              maxShield: playerData.maxShield,
              source: `skill_upgrade_${data.upgradeType}`
            }));
          }

          // Gestisce spari di proiettili
          if (data.type === 'projectile_fired') {
            const playerData = this.mapServer.players.get(data.clientId);
            if (!playerData) {
              logger.warn('PROJECTILE', `Player data not found for clientId: ${data.clientId}`);
              return;
            }

            // 🔴 CRITICAL SECURITY: Verifica che il playerId corrisponda al client autenticato
            if (data.playerId !== playerData.userId) {
              logger.error('SECURITY', `🚫 BLOCKED: Projectile fire attempt with mismatched playerId from ${data.clientId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid player ID for projectile action.',
                code: 'INVALID_PLAYER_ID'
              }));
              return;
            }

            // Determina il target per i proiettili del player (NPC che sta attaccando)
            let targetId = data.targetId || null;
            if (!targetId) {
              // Controlla se il player sta combattendo contro un NPC
              const playerCombat = this.mapServer.combatManager.playerCombats.get(data.clientId);
              if (playerCombat) {
                targetId = playerCombat.npcId;
              }
            }

            // SERVER AUTHORITATIVE: Calcola il danno basato sugli upgrade del player
            let calculatedDamage = 500; // Danno base
            if (playerData && playerData.upgrades) {
              // Calcola bonus danno: 1.0 + (damageUpgrades * 0.01)
              const damageBonus = 1.0 + (playerData.upgrades.damageUpgrades * 0.01);
              calculatedDamage = Math.floor(500 * damageBonus);
            }

            // Registra il proiettile nel server con danno calcolato dal server
            this.mapServer.projectileManager.addProjectile(
              data.projectileId,
              data.playerId,
              data.position,
              data.velocity,
              calculatedDamage, // Danno calcolato dal server (Server Authoritative)
              data.projectileType || 'laser',
              targetId
            );

            // Broadcast il proiettile a tutti gli altri client con danno calcolato dal server
            const projectileMessage = {
              type: 'projectile_fired',
              projectileId: data.projectileId,
              playerId: data.playerId,
              position: data.position,
              velocity: data.velocity,
              damage: calculatedDamage, // Danno calcolato dal server (Server Authoritative)
              projectileType: data.projectileType || 'laser',
              targetId: targetId
            };

            // Invia a tutti i client, incluso quello che ha sparato (per coerenza con NPC)
            this.mapServer.players.forEach((client, clientId) => {
              if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify(projectileMessage));
              }
            });
          }

          // Gestisce richiesta di inizio combattimento
          if (data.type === 'start_combat') {
            // Verifica che il player sia connesso
            const playerData = this.mapServer.players.get(data.clientId);
            if (!playerData) {
              logger.warn('COMBAT', `Player data not found for clientId: ${data.clientId}`);
              return;
            }

            // 🔴 CRITICAL SECURITY: Verifica che il playerId corrisponda al client autenticato
            if (data.playerId !== playerData.userId) {
              logger.error('SECURITY', `🚫 BLOCKED: Combat start attempt with mismatched playerId from ${data.clientId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid player ID for combat action.',
                code: 'INVALID_PLAYER_ID'
              }));
              return;
            }

            // Valida che l'NPC esista
            const npc = this.mapServer.npcManager.getNpc(data.npcId);
            if (!npc) {
              logger.error('COMBAT', `START_COMBAT: NPC ${data.npcId} not found`);
              return;
            }

            // Inizia il combattimento server-side
            this.mapServer.combatManager.startPlayerCombat(data.clientId, data.npcId);

            // Spara immediatamente il primo proiettile per ridurre il delay percepito
            // Nota: rimuoviamo il setTimeout per evitare race conditions
            const combat = this.mapServer.combatManager.playerCombats.get(data.clientId);
            if (combat) {
              this.mapServer.combatManager.processPlayerCombat(data.clientId, combat, Date.now());
            } else {
              console.error(`❌ [SERVER] Combat not found after startPlayerCombat for ${data.clientId}`);
            }

            // Broadcast stato combattimento a tutti i client
            const combatUpdate = {
              type: 'combat_update',
              playerId: data.playerId,
              npcId: data.npcId,
              isAttacking: true,
              lastAttackTime: Date.now()
            };

            this.mapServer.broadcastToMap(combatUpdate);
          }

          // Gestisce richiesta di fine combattimento
          if (data.type === 'stop_combat') {
            // Ferma il combattimento server-side
            this.mapServer.combatManager.stopPlayerCombat(data.clientId);

            // Broadcast stato combattimento a tutti i client
            const combatUpdate = {
              type: 'combat_update',
              playerId: data.playerId,
              npcId: null,
              isAttacking: false,
              lastAttackTime: Date.now()
            };

            this.mapServer.broadcastToMap(combatUpdate);
          }

          // Gestisce creazione esplosioni
          if (data.type === 'explosion_created') {
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
            this.mapServer.broadcastNear(data.position, 2000, message);
          }

          // Gestisce richiesta dati completi del giocatore (dopo welcome)
          if (data.type === 'request_player_data') {
            // 🔴 CRITICAL SECURITY: Verifica che il playerId corrisponda al client autenticato
            if (data.playerId !== playerData?.userId) {
              logger.error('SECURITY', `🚫 BLOCKED: Player data request with mismatched playerId from ${data.clientId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid player ID for data request.',
                code: 'INVALID_PLAYER_ID'
              }));
              return;
            }

            // Invia dati completi del giocatore
            console.log(`[DEBUG_SEND] SERVER sending player_data_response - experience: ${playerData.inventory.experience}, honor: ${playerData.inventory.honor}`);
            const responseMessage = {
              type: 'player_data_response',
              playerId: data.playerId,
              inventory: playerData.inventory,
              upgrades: playerData.upgrades,
              quests: playerData.quests || [],
              timestamp: Date.now()
            };

            ws.send(JSON.stringify(responseMessage));
          }

          // Gestisce aggiornamenti economici dal client
          if (data.type === 'economy_update') {

            // 🔴 CRITICAL SECURITY: Verifica che il playerId corrisponda al client autenticato
            if (data.playerId !== playerData?.userId) {
              logger.error('SECURITY', `🚫 BLOCKED: Economy update attempt with mismatched playerId from ${data.clientId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid player ID for economy update.',
                code: 'INVALID_PLAYER_ID'
              }));
              return;
            }

            // Aggiorna i dati economici del giocatore (Server Authoritative)
            if (playerData) {
              // Supporta sia il vecchio formato (inventory) che il nuovo (field/value)
              if (data.inventory) {
                // Vecchio formato - ancora supportato per retrocompatibilità
                playerData.inventory.credits = Math.max(0, data.inventory.credits || 0);
                playerData.inventory.cosmos = Math.max(0, data.inventory.cosmos || 0);
                playerData.inventory.experience = Math.max(0, data.inventory.experience || 0);
                playerData.inventory.honor = Math.max(0, data.inventory.honor || 0);
                playerData.inventory.skillPoints = Math.max(0, data.inventory.skillPoints || 0);
              } else if (data.field && data.value !== undefined) {
                // Nuovo formato - aggiorna solo il campo specifico
                const field = data.field;
                const value = Math.max(0, data.value);
                if (playerData.inventory.hasOwnProperty(field)) {
                  playerData.inventory[field] = value;
                }
              }

              // I dati verranno salvati automaticamente dal periodic save o al disconnect
            }
          }

          // Gestisce messaggi chat
          if (data.type === 'chat_message') {
            // VALIDAZIONE CONTENUTO
            if (!data.content || typeof data.content !== 'string') {
              return;
            }

            // Verifica che il clientId corrisponda al mittente (previene spoofing nomi)
            if (data.clientId !== playerData?.clientId) {
              logger.warn('SECURITY', `🚫 BLOCKED: Chat message with mismatched clientId from ${data.clientId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid client ID for chat message.',
                code: 'INVALID_CLIENT_ID'
              }));
              return;
            }

            const content = data.content.trim();
            if (content.length === 0 || content.length > 200) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Chat message must be between 1 and 200 characters.'
              }));
              return;
            }

            // FILTRAGGIO BASICO (espandi con bad words list)
            const filteredContent = this.filterChatMessage(content);

            // BROADCAST A TUTTI I GIOCATORI CONNESSI
            const chatBroadcast = {
              type: 'chat_message',
              clientId: data.clientId,
              senderName: playerData.nickname || 'Unknown Player',
              content: filteredContent,
              timestamp: now
            };

            this.mapServer.broadcastToMap(chatBroadcast);
          }

          // Gestisce richiesta di salvataggio immediato dal client
          if (data.type === 'save_request') {
            // 🔴 CRITICAL SECURITY: Verifica che clientId e playerId (authId) siano validi
            if (data.clientId !== playerData?.clientId || data.playerId !== playerData?.userId) {
              logger.error('SECURITY', `🚫 BLOCKED: Save request with invalid client/player ID from ${data.clientId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid client or player ID for save request.',
                code: 'INVALID_IDS'
              }));
              return;
            }

            // Salva immediatamente i dati del giocatore
            try {
              await this.savePlayerData(playerData);

              // Rispondi al client che il salvataggio è avvenuto
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

        } catch (error) {
          logger.error('WEBSOCKET', 'Error parsing message', error.message);
        }
      });

      ws.on('close', async () => {
        if (playerData) {
          logger.info('PLAYER', `Player disconnected: ${playerData.clientId} (${playerData.nickname})`);

          // Salva i dati del giocatore prima della disconnessione
          await this.savePlayerData(playerData);

          this.mapServer.broadcastToMap({
            type: 'player_left',
            clientId: playerData.clientId
          });

          this.mapServer.removePlayer(playerData.clientId);

          // Rimuovi anche dalla queue degli aggiornamenti posizione
          this.mapServer.positionUpdateQueue.delete(playerData.clientId);

          logger.info('SERVER', `Remaining players: ${this.mapServer.players.size}`);
        } else {
          logger.warn('PLAYER', 'Unknown client disconnected');
        }
      });

      ws.on('error', (error) => {
        logger.error('WEBSOCKET', 'WebSocket error', error.message);
      });
    });
  }

  /**
   * Configura la gestione della chiusura del server
   */
  setupShutdownHandling() {
    process.on('SIGINT', () => {
      logger.info('SERVER', '🛑 Shutting down server...');

      // Cleanup risorse
      if (this.mapServer.npcManager) {
        this.mapServer.npcManager.destroy();
      }

      this.wss.close();
      // Nota: server.close() sarà chiamato dal chiamante (server.cjs)

      logger.info('SERVER', '✅ WebSocket connections closed gracefully');
    });
  }

  /**
   * Calcola maxHealth basato sugli upgrade HP
   * Formula: baseValue * (1.0 + hpUpgrades * 0.01)
   */
  calculateMaxHealth(hpUpgrades) {
    const baseHealth = 100000;
    const bonus = 1.0 + (hpUpgrades * 0.01);
    return Math.floor(baseHealth * bonus);
  }

  /**
   * Calcola maxShield basato sugli upgrade Shield
   * Formula: baseValue * (1.0 + shieldUpgrades * 0.01)
   */
  calculateMaxShield(shieldUpgrades) {
    const baseShield = 50000;
    const bonus = 1.0 + (shieldUpgrades * 0.01);
    return Math.floor(baseShield * bonus);
  }

  /**
   * Filtra i messaggi di chat per sicurezza e appropriatezza
   * Rimuove HTML, filtra parole inappropriate, ecc.
   */
  filterChatMessage(content) {
    // Rimuovi tag HTML per sicurezza
    let filtered = content.replace(/<[^>]*>/g, '');

    // Lista base di parole inappropriate (espandi secondo necessità)
    const badWords = [
      // Aggiungi parole inappropriate qui quando necessario
      // Esempio: 'badword1', 'badword2'
    ];

    // Filtraggio parole inappropriate (case insensitive)
    badWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      filtered = filtered.replace(regex, '***');
    });

    // Limita lunghezza massima per sicurezza
    if (filtered.length > 200) {
      filtered = filtered.substring(0, 200) + '...';
    }

    return filtered;
  }
}

module.exports = WebSocketConnectionManager;
