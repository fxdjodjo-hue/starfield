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
        this.messageCount.increment();
        try {
          const data = JSON.parse(message.toString());
          logger.debug('WEBSOCKET', `Received ${data.type} from ${data.clientId || 'unknown'}`);

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
              // Health and shield system (server authoritative)
              health: 100000,
              maxHealth: 100000,
              shield: 50000,
              maxShield: 50000,
              // Combat state
              lastDamage: null,
              isDead: false,
              respawnTime: null,
              // Inventory system (server authoritative)
              inventory: {
                credits: 0,
                cosmos: 0,
                experience: 0,
                honor: 0
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
              message: `Welcome ${data.nickname}! Connected to server.`
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

            // Registra il proiettile nel server
            this.mapServer.projectileManager.addProjectile(
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
}

module.exports = WebSocketConnectionManager;
