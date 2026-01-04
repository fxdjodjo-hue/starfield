const WebSocket = require('ws');

// Crea server WebSocket sulla porta 3000
const wss = new WebSocket.Server({ port: 3000 });

// Stato dei giocatori connessi
const connectedPlayers = new Map();

console.log('🚀 WebSocket server started on ws://localhost:3000');

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
          lastInputAt: null
        };

        connectedPlayers.set(data.clientId, playerData);

        console.log(`🎮 [SERVER] Player joined: ${data.clientId}`);
        console.log(`   📝 Nickname: ${data.nickname}`);
        console.log(`   🔢 Player ID: ${data.playerId}`);
        console.log(`   👤 User ID: ${data.userId}`);
        console.log(`👥 [SERVER] Total connected players: ${connectedPlayers.size}`);

        // Notifica a tutti gli altri giocatori che è arrivato un nuovo player
        const newPlayerBroadcast = {
          type: 'player_joined',
          clientId: data.clientId,
          nickname: data.nickname,
          playerId: data.playerId
        };

        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(newPlayerBroadcast));
          }
        });

        // Invia le posizioni di tutti i giocatori già connessi al nuovo giocatore
        connectedPlayers.forEach((playerData, existingClientId) => {
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

        ws.send(JSON.stringify({
          type: 'welcome',
          clientId: data.clientId,
          message: `Welcome ${data.nickname}! Connected to server.`
        }));

        // Invia la posizione del nuovo giocatore a tutti gli altri giocatori
        if (data.position) {
          const newPlayerPositionBroadcast = {
            type: 'remote_player_update',
            clientId: data.clientId,
            position: data.position,
            rotation: data.position.rotation || 0,
            tick: 0,
            nickname: data.nickname,
            playerId: data.playerId
          };

          wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(newPlayerPositionBroadcast));
              console.log(`📍 [SERVER] Sent initial position of ${data.clientId} to existing player`);
            }
          });
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

          // Broadcasting: inoltra la posizione a tutti gli altri client connessi
          const positionBroadcast = {
            type: 'remote_player_update',
            clientId: data.clientId,
            position: data.position,
            rotation: data.rotation,
            tick: data.tick,
            nickname: playerData.nickname,
            playerId: playerData.playerId
          };

          // Invia a tutti i client connessi tranne quello che ha inviato l'aggiornamento
          wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(positionBroadcast));
            }
          });

          console.log(`📡 [SERVER] Broadcasted position to ${wss.clients.size - 1} clients`);
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

    } catch (error) {
      console.error('❌ [SERVER] Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    if (playerData) {
      console.log(`❌ [SERVER] Player disconnected: ${playerData.clientId} (${playerData.nickname})`);

      // Notifica a tutti gli altri giocatori che questo player se n'è andato
      const playerLeftBroadcast = {
        type: 'player_left',
        clientId: playerData.clientId
      };

      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(playerLeftBroadcast));
        }
      });

      connectedPlayers.delete(playerData.clientId);
      console.log(`👥 [SERVER] Remaining players: ${connectedPlayers.size}`);
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
