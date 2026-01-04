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

        ws.send(JSON.stringify({
          type: 'welcome',
          clientId: data.clientId,
          message: `Welcome ${data.nickname}! Connected to server.`
        }));

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
