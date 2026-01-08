// WebSocketConnectionManager - Gestione connessioni e messaggi WebSocket
// Dipendenze consentite: logger.cjs, messageCount, mapServer, wss

const { logger } = require('../logger.cjs');

class WebSocketConnectionManager {
  constructor(wss, mapServer, messageCount) {
    this.wss = wss;
    this.mapServer = mapServer;
    this.messageCount = messageCount;
    this.setupConnectionHandling();
    this.setupShutdownHandling();
  }

  /**
   * Configura la gestione delle connessioni WebSocket
   */
  setupConnectionHandling() {
    this.wss.on('connection', (ws) => {
      logger.info('SERVER', 'New client connected');
      let playerData = null;

      // Gestisce messaggi dal client
      ws.on('message', (message) => {
        console.log(`🔥 [WEBSOCKET] RAW MESSAGE from client:`, message.toString());
        this.messageCount.increment();
        try {
          const data = JSON.parse(message.toString());

          // Log speciale per player_upgrades_update
          if (data.type === 'player_upgrades_update') {
            console.log('🎯 [SERVER] PLAYER UPGRADES MESSAGE RECEIVED!');
            console.log('🎯 [SERVER] Full message:', JSON.stringify(data, null, 2));
          }

          console.log(`📡 [SERVER] Received ${data.type} from ${data.clientId || 'unknown'}:`, JSON.stringify(data));
          logger.debug('WEBSOCKET', `Received ${data.type} from ${data.clientId || 'unknown'}`);

          // Debug per TUTTI i messaggi dal client specifico
          if (data.clientId === 'client_z3q8xbv6a') {
            console.log(`📨 [SERVER] MESSAGE from ${data.clientId}: ${data.type}`, JSON.stringify(data));
          }

          // Debug specifico per messaggi di combattimento
          if (data.type === 'start_combat' || data.type.includes('combat')) {
            console.log(`⚔️ [SERVER] COMBAT MESSAGE RECEIVED: ${data.type}`, data);
          }

          // Risponde ai messaggi di join
          if (data.type === 'join') {
            playerData = {
              clientId: data.clientId,
              nickname: data.nickname,
              playerId: data.playerId,
              userId: data.userId,
              connectedAt: new Date().toISOString(),
              lastInputAt: null,
              position: data.position, // Save initial position from join message
              ws: ws,
              // Player Upgrades (server authoritative)
              upgrades: {
                hpUpgrades: 0,
                shieldUpgrades: 0,
                speedUpgrades: 0,
                damageUpgrades: 0
              },
              // Health and shield system (server authoritative)
              health: this.calculateMaxHealth(0), // Inizialmente 0 upgrade
              maxHealth: this.calculateMaxHealth(0),
              shield: this.calculateMaxShield(0),
              maxShield: this.calculateMaxShield(0),
              // Combat state
              lastDamage: null,
              isDead: false,
              respawnTime: null,
              // Inventory system (server authoritative) - risorse iniziali generose
              inventory: {
                credits: 100000,      // 100k credits iniziali
                cosmos: 10000,        // 10k cosmos iniziali
                experience: 0,        // esperienza inizia da 0
                honor: 0,             // onore inizia da 0
                skillPoints: 10        // 10 skill points iniziali per testing
              },
              // Upgrades system (server authoritative) - per calcolo danno sicuro
              upgrades: {
                hpUpgrades: 0,
                shieldUpgrades: 0,
                speedUpgrades: 0,
                damageUpgrades: 0
              }
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
              message: `Welcome ${data.nickname}! Connected to server.`,
              initialState: {
                inventory: { ...playerData.inventory },
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

              // Log posizione aggiornata (limitato per evitare spam)
              if (Math.random() < 0.1) { // Log solo il 10% degli aggiornamenti
                console.log(`📍 [SERVER] Position from ${data.clientId}: (${data.position.x.toFixed(1)}, ${data.position.y.toFixed(1)})`);
              }

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
            console.log(`🔧 [SERVER] Player upgrades update RECEIVED: ${data.playerId}`, JSON.stringify(data.upgrades));

            console.log(`🔍 [SERVER] Looking for player: ${data.playerId}`);
            const playerData = this.mapServer.players.get(data.playerId);
            if (playerData) {
              // Salva upgrade precedenti per confronto
              const oldUpgrades = JSON.parse(JSON.stringify(playerData.upgrades));
              // Aggiorna gli upgrade del player con quelli ricevuti dal client
              playerData.upgrades = { ...data.upgrades };
              console.log(`✅ [SERVER] Player ${data.playerId} upgrades synchronized:`, JSON.stringify(oldUpgrades), '→', JSON.stringify(playerData.upgrades));
            } else {
              console.log(`❌ [SERVER] Player ${data.playerId} not found for upgrades update`);
              console.log('Available players:', Array.from(this.mapServer.players.keys()));
              // Prova anche con il clientId dalla connessione WebSocket
              const wsClientId = Array.from(this.mapServer.players.entries()).find(([_, pd]) => pd.ws === ws)?.[0];
              console.log(`🔍 [SERVER] WebSocket client ID: ${wsClientId}`);
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
              console.log(`🎯 [SERVER] Player ${data.playerId} damage calculated: ${calculatedDamage} (base: 500, bonus: ${damageBonus.toFixed(3)}, upgrades: ${JSON.stringify(playerData.upgrades)})`);
            } else {
              console.log(`⚠️ [SERVER] Player ${data.playerId} damage calculated with defaults: ${calculatedDamage} (no player data or upgrades found)`);
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
            console.log(`📡 [SERVER] Received START_COMBAT message:`, JSON.stringify(data));

            // Valida che l'NPC esista
            const npc = this.mapServer.npcManager.getNpc(data.npcId);
            if (!npc) {
              logger.error('COMBAT', `START_COMBAT: NPC ${data.npcId} not found`);
              return;
            }

            console.log(`✅ [SERVER] START_COMBAT: NPC ${data.npcId} found, starting combat for player=${data.playerId}`);

            // Debug: lista tutti i player connessi
            console.log(`👥 [SERVER] Connected players:`, Array.from(this.mapServer.players.keys()));

            // Verifica che il player sia connesso
            const playerData = this.mapServer.players.get(data.playerId);
            if (!playerData) {
              console.log(`❌ [SERVER] START_COMBAT: Player ${data.playerId} not found in connected players`);
              console.log(`❌ [SERVER] Available players:`, Array.from(this.mapServer.players.keys()));
              return;
            }

            console.log(`✅ [SERVER] START_COMBAT: Player ${data.playerId} is connected, starting combat`);

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

      ws.on('close', () => {
        if (playerData) {
          logger.info('PLAYER', `Player disconnected: ${playerData.clientId} (${playerData.nickname})`);

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
