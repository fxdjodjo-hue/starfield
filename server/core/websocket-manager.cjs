// WebSocketConnectionManager - Gestione connessioni e messaggi WebSocket
// Dipendenze consentite: logger.cjs, messageCount, mapServer, wss

const { logger } = require('../logger.cjs');
const { createClient } = require('@supabase/supabase-js');

// Supabase client (usiamo la stessa istanza del server principale)
const supabaseUrl = process.env.SUPABASE_URL || 'https://euvlanwkqzhqnbwbvwis.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

class WebSocketConnectionManager {
  constructor(wss, mapServer, messageCount) {
    this.wss = wss;
    this.mapServer = mapServer;
    this.messageCount = messageCount;
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

      // Prima cerca se esiste già un profilo per questo userId
      const { data: existingProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, username')
        .eq('id', userId)  // L'id della tabella user_profiles corrisponde all'userId di Supabase Auth
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error('DATABASE', `Error loading profile: ${profileError.message}`);
        return this.getDefaultPlayerData();
      }

      let playerId = userId; // Il playerId è l'userId stesso
      let playerData = this.getDefaultPlayerData();

      if (existingProfile) {
        // Giocatore esistente - carica i suoi dati
        playerId = existingProfile.id;
        logger.info('DATABASE', `Found existing player: ${existingProfile.username} (ID: ${playerId})`);

        // Carica stats
        const { data: stats } = await supabase
          .from('player_stats')
          .select('*')
          .eq('player_id', playerId)
          .maybeSingle();

        if (stats) {
          playerData.stats = stats;
        }

        // Carica upgrades
        const { data: upgrades } = await supabase
          .from('player_upgrades')
          .select('*')
          .eq('player_id', playerId)
          .maybeSingle();

        if (upgrades) {
          playerData.upgrades = {
            hpUpgrades: upgrades.hp_points,
            shieldUpgrades: upgrades.shield_points,
            speedUpgrades: upgrades.speed_points,
            damageUpgrades: upgrades.damage_points
          };
        }

        // Carica currencies
        const { data: currencies } = await supabase
          .from('player_currencies')
          .select('*')
          .eq('player_id', playerId)
          .maybeSingle();

        if (currencies) {
          logger.info('DATABASE', `Loaded currencies: credits=${currencies.credits}, cosmos=${currencies.cosmos}, exp=${currencies.experience}, honor=${currencies.honor}, sp=${currencies.skill_points_current}`);
          playerData.inventory = {
            credits: currencies.credits,
            cosmos: currencies.cosmos,
            experience: currencies.experience,
            honor: currencies.honor,
            skillPoints: currencies.skill_points_current
          };
        } else {
          logger.warn('DATABASE', `No currencies found for player ${playerId}`);
        }

        // Carica quest progress
        const { data: quests } = await supabase
          .from('quest_progress')
          .select('*')
          .eq('player_id', playerId);

        if (quests) {
          playerData.quests = quests;
        }

      } else {
        // Nuovo giocatore - il profilo dovrebbe già esistere da Supabase Auth Triggers
        // Se non esiste, c'è un problema con i trigger
        logger.warn('DATABASE', `Profile not found for user: ${userId} - Supabase Auth triggers may not be working`);

        // Per ora, creiamo un profilo minimo (normalmente fatto dai trigger)
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,  // L'id corrisponde all'userId di Supabase Auth
            email: `${userId}@temp.local`,  // Email temporanea
            username: `Player_${userId.substring(0, 8)}`  // Username basato sull'UUID
          });

        if (insertError) {
          logger.error('DATABASE', `Error creating profile: ${insertError.message}`);
        } else {
          logger.info('DATABASE', `Created profile for user: ${userId}`);
        }

        // Crea record iniziali per le altre tabelle
        await this.createInitialPlayerRecords(userId);
      }

      playerData.playerId = playerId;
      logger.info('DATABASE', `Player data loaded successfully for user ${userId}`);
      return playerData;

    } catch (error) {
      logger.error('DATABASE', `Error loading player data: ${error.message}`);
      return this.getDefaultPlayerData();
    }
  }

  /**
   * Crea i record iniziali per un nuovo giocatore
   */
  async createInitialPlayerRecords(playerId) {
    try {
      // Stats iniziali
      await supabase.from('player_stats').insert({
        player_id: playerId,
        kills: 0,
        deaths: 0,
        missions_completed: 0,
        play_time: 0
      });

      // Upgrades iniziali
      await supabase.from('player_upgrades').insert({
        player_id: playerId,
        hp_points: 0,
        shield_points: 0,
        speed_points: 0,
        damage_points: 0
      });

      // Currencies iniziali
      await supabase.from('player_currencies').insert({
        player_id: playerId,
        credits: 1000,
        cosmos: 100,
        experience: 0,
        honor: 0,
        skill_points_current: 0,
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

      const playerId = playerData.playerId;
      logger.info('DATABASE', `Saving player data for player ID: ${playerId}`);

      // Salva stats
      if (playerData.stats) {
        await supabase.from('player_stats').upsert({
          player_id: playerId,
          kills: playerData.stats.kills || 0,
          deaths: playerData.stats.deaths || 0,
          missions_completed: playerData.stats.missions_completed || 0,
          play_time: playerData.stats.play_time || 0,
          updated_at: new Date().toISOString()
        });
      }

      // Salva upgrades
      if (playerData.upgrades) {
        await supabase.from('player_upgrades').upsert({
          player_id: playerId,
          hp_points: playerData.upgrades.hpUpgrades || 0,
          shield_points: playerData.upgrades.shieldUpgrades || 0,
          speed_points: playerData.upgrades.speedUpgrades || 0,
          damage_points: playerData.upgrades.damageUpgrades || 0,
          updated_at: new Date().toISOString()
        });
      }

      // Salva currencies
      if (playerData.inventory) {
        await supabase.from('player_currencies').upsert({
          player_id: playerId,
          credits: playerData.inventory.credits || 0,
          cosmos: playerData.inventory.cosmos || 0,
          experience: playerData.inventory.experience || 0,
          honor: playerData.inventory.honor || 0,
          skill_points_current: playerData.inventory.skillPoints || 0,
          skill_points_total: playerData.inventory.skillPoints || 0,
          updated_at: new Date().toISOString()
        });
      }

      // Salva quest progress
      if (playerData.quests && Array.isArray(playerData.quests)) {
        for (const quest of playerData.quests) {
          await supabase.from('quest_progress').upsert({
            player_id: playerId,
            quest_id: quest.quest_id,
            objectives: quest.objectives || [],
            is_completed: quest.is_completed || false,
            started_at: quest.started_at || new Date().toISOString(),
            completed_at: quest.completed_at || null
          });
        }
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

          logger.debug('WEBSOCKET', `Received ${data.type} from ${data.clientId || 'unknown'}`);

          // Debug specifico per messaggi di combattimento
          if (data.type === 'start_combat' || data.type.includes('combat')) {
            console.log(`⚔️ [SERVER] COMBAT MESSAGE RECEIVED: ${data.type}`, data);
          }

          // Risponde ai messaggi di join
          if (data.type === 'join') {
            // Carica i dati del giocatore dal database invece di usare valori hardcoded
            const loadedData = await this.loadPlayerData(data.userId);

            playerData = {
              clientId: data.clientId,
              nickname: data.nickname,
              playerId: data.userId, // Usa direttamente userId come playerId
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
            logger.info('PLAYER', `  Player ID: ${data.playerId}`);
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
              playerId: data.playerId
            }, data.clientId);

            // Invia le posizioni di tutti i giocatori già connessi al nuovo giocatore
            this.mapServer.players.forEach((playerData, existingClientId) => {
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
                logger.debug('PLAYER', `Sent position of existing player ${existingClientId} to new player ${data.clientId}`);
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

            ws.send(JSON.stringify({
              type: 'welcome',
              clientId: data.clientId,
              playerId: playerData.userId, // Usa userId come playerId (è l'UUID dell'utente)
              message: `Welcome ${data.nickname}! Connected to server.`,
              initialState: {
                inventory: { ...playerData.inventory },
                upgrades: { ...playerData.upgrades },
                health: playerData.health,
                maxHealth: playerData.maxHealth,
                shield: playerData.shield,
                maxShield: playerData.maxShield
              }
            }));

            // Invia la posizione del nuovo giocatore a tutti gli altri giocatori
            if (data.position) {
              this.mapServer.broadcastToMap({
                type: 'remote_player_update',
                clientId: data.clientId,
                position: data.position,
                rotation: data.position.rotation || 0,
                tick: 0,
                nickname: data.nickname,
                playerId: data.playerId
              }, data.clientId);
            }

            logger.debug('SERVER', `Sent welcome to ${data.clientId}`);
          }

          // Gestisce aggiornamenti posizione del player
          if (data.type === 'position_update') {
            if (playerData) {
              playerData.lastInputAt = new Date().toISOString();
              playerData.position = data.position;

              // Posizione aggiornata (logging limitato per evitare spam)

              // Aggiungi alla queue invece di broadcastare immediatamente
              if (!this.mapServer.positionUpdateQueue.has(data.clientId)) {
                this.mapServer.positionUpdateQueue.set(data.clientId, []);
              }

              this.mapServer.positionUpdateQueue.get(data.clientId).push({
                position: data.position,
                rotation: data.rotation,
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
            const playerData = this.mapServer.players.get(data.playerId);
            if (playerData) {
              // Aggiorna gli upgrade del player con quelli ricevuti dal client
              playerData.upgrades = { ...data.upgrades };
            }
          }

          // Gestisce richieste di upgrade skill (Server Authoritative)
          if (data.type === 'skill_upgrade_request') {
            console.log(`🎯 [SERVER] Skill upgrade request RECEIVED: ${data.playerId} wants to upgrade ${data.upgradeType}`);

            const playerData = this.mapServer.players.get(data.playerId);
            if (!playerData) {
              console.log(`❌ [SERVER] Player ${data.playerId} not found for skill upgrade`);
              return;
            }

            // Verifica se il player ha abbastanza skill points
            if (playerData.inventory.skillPoints < 1) {
              console.log(`❌ [SERVER] Player ${data.playerId} doesn't have enough skill points (${playerData.inventory.skillPoints})`);
              // TODO: Invia messaggio di errore al client
              return;
            }

            // Salva stato precedente per confronto
            const oldSkillPoints = playerData.inventory.skillPoints;
            const oldUpgrades = JSON.parse(JSON.stringify(playerData.upgrades));

            // Sposta 1 skill point dall'inventory agli upgrade
            playerData.inventory.skillPoints -= 1;

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
                console.log(`❌ [SERVER] Unknown upgrade type: ${data.upgradeType}`);
                // Rollback skill points
                playerData.inventory.skillPoints += 1;
                return;
            }

            console.log(`✅ [SERVER] Skill upgrade applied: ${data.upgradeType}`);
            console.log(`   Skill Points: ${oldSkillPoints} → ${playerData.inventory.skillPoints}`);
            console.log(`   Upgrades: ${JSON.stringify(oldUpgrades)} → ${JSON.stringify(playerData.upgrades)}`);

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

            console.log(`📡 [SERVER] Player state update sent to ${data.playerId} after skill upgrade`);
          }

          // Gestisce spari di proiettili
          if (data.type === 'projectile_fired') {
            console.log(`🔫 [SERVER] Projectile fired: ${data.projectileId} by ${data.playerId} (RECEIVED FROM CLIENT)`);

            // Determina il target per i proiettili del player (NPC che sta attaccando)
            let targetId = data.targetId || null;
            if (!targetId) {
              // Controlla se il player sta combattendo contro un NPC
              const playerCombat = this.mapServer.combatManager.playerCombats.get(data.playerId);
              if (playerCombat) {
                targetId = playerCombat.npcId;
              }
            }

            // SERVER AUTHORITATIVE: Calcola il danno basato sugli upgrade del player
            const playerData = this.mapServer.players.get(data.playerId);
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
            // Valida che l'NPC esista
            const npc = this.mapServer.npcManager.getNpc(data.npcId);
            if (!npc) {
              logger.error('COMBAT', `START_COMBAT: NPC ${data.npcId} not found`);
              return;
            }

            // Verifica che il player sia connesso
            const playerData = this.mapServer.players.get(data.playerId);
            if (!playerData) {
              return;
            }

            // Inizia il combattimento server-side
            this.mapServer.combatManager.startPlayerCombat(data.playerId, data.npcId);

            // Spara immediatamente il primo proiettile per ridurre il delay percepito
            // Nota: rimuoviamo il setTimeout per evitare race conditions
            const combat = this.mapServer.combatManager.playerCombats.get(data.playerId);
            if (combat) {
              console.log(`📡 [SERVER] Processing initial combat for ${data.playerId} vs ${data.npcId}`);
              this.mapServer.combatManager.processPlayerCombat(data.playerId, combat, Date.now());
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

            this.mapServer.broadcastToMap(combatUpdate);
          }

          // Gestisce richiesta di fine combattimento
          if (data.type === 'stop_combat') {
            console.log(`🛑 [SERVER] Stop combat request: player ${data.playerId}`);

            // Ferma il combattimento server-side
            this.mapServer.combatManager.stopPlayerCombat(data.playerId);

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
            this.mapServer.broadcastNear(data.position, 2000, message);
          }

          // Gestisce messaggi chat
          if (data.type === 'chat_message') {
            console.log(`💬 [SERVER] Chat message from ${data.clientId}: ${data.content}`);

            // VALIDAZIONE CONTENUTO
            if (!data.content || typeof data.content !== 'string') {
              console.log(`🚫 [SERVER] Invalid chat content from ${data.clientId}`);
              return;
            }

            const content = data.content.trim();
            if (content.length === 0 || content.length > 200) {
              console.log(`🚫 [SERVER] Chat message length invalid from ${data.clientId}: ${content.length} chars`);
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

            console.log(`📡 [SERVER] Broadcasting chat message from ${playerData.nickname} to all players`);
            this.mapServer.broadcastToMap(chatBroadcast);
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
