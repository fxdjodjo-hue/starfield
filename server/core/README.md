# 🏗️ **Core Systems** - `server/core/`

Sistema core del server Starfield - orchestrazione principale e gestione connessioni.

## 📁 **Struttura**

```
core/
├── map-server.cjs         # 🗺️ Contesto principale della mappa
└── websocket-manager.cjs  # 🌐 Gestione connessioni WebSocket
```

## 🗺️ **Map Server** - `map-server.cjs`

### **Responsabilità**
Contesto principale per ogni istanza di mappa di gioco:
- **Container di Managers**: NPC, Combat, Projectile managers
- **Game Loop Orchestration**: Tick unificato 20Hz
- **Player Management**: Join/leave dalla mappa
- **Broadcasting System**: Comunicazione efficiente con interest radius
- **Position Queue**: Buffer aggiornamenti posizione per ridurre race conditions

### **API Principale**
```javascript
const mapServer = new MapServer('default_map', config);

// Inizializzazione
mapServer.initialize();

// Tick principale (chiamato ogni 50ms)
mapServer.tick();

// Gestione giocatori
mapServer.addPlayer(clientId, playerData);
mapServer.removePlayer(clientId);

// Broadcasting
mapServer.broadcastToMap(message, excludeClientId);
mapServer.broadcastNear(position, radius, message, excludeClientId);

// Accesso managers
const npcs = mapServer.npcManager.getAllNpcs();
mapServer.combatManager.startPlayerCombat(playerId, npcId);
```

### **Architettura Interna**

#### **Tick Orchestration**
```javascript
tick() {
  // 1. Movimento NPC
  this.updateNpcMovements();

  // 2. Logica combattimento
  if (this.combatManager) {
    this.combatManager.updateCombat();
  }

  // 3. Collisioni proiettili
  this.projectileManager.checkCollisions();

  // 4. Broadcast aggiornamenti NPC
  this.broadcastNpcUpdates();

  // 5. Processa queue posizioni
  this.processPositionUpdates();
}
```

#### **Interest Radius Broadcasting**
```javascript
broadcastNear(position, radius, message, excludeClientId) {
  const payload = JSON.stringify(message);
  const radiusSq = radius * radius;

  for (const [clientId, playerData] of this.players.entries()) {
    if (excludeClientId && clientId === excludeClientId) continue;
    if (!playerData.position || !playerData.ws.readyState === OPEN) continue;

    const dx = playerData.position.x - position.x;
    const dy = playerData.position.y - position.y;
    const distSq = dx * dx + dy * dy;

    if (distSq <= radiusSq) {
      playerData.ws.send(payload);
    }
  }
}
```

## 🌐 **WebSocket Manager** - `websocket-manager.cjs`

### **Responsabilità**
Gestione completa delle connessioni WebSocket client:
- **Connection Handling**: Setup connessioni WebSocket
- **Message Routing**: Instradamento messaggi client (join, position, combat, etc.)
- **Player State Management**: Manutenzione stato giocatori connessi
- **Broadcast Coordination**: Coordinamento con MapServer per eventi
- **Error Handling**: Gestione errori e disconnessioni
- **Graceful Shutdown**: Chiusura pulita connessioni

### **API Principale**
```javascript
const wsManager = new WebSocketConnectionManager(wss, mapServer, messageCount);

// Automaticamente:
// - Gestisce connessioni in entrata
// - Route messaggi ai sistemi appropriati
// - Gestisce disconnessioni
// - Coordina con MapServer per broadcasting
```

### **Message Routing**

#### **Join Flow**
```
Client → 'join' → WebSocketManager
  → mapServer.addPlayer()
  → Broadcast 'player_joined'
  → Send 'initial_npcs'
  → Send 'welcome'
```

#### **Combat Flow**
```
Client → 'start_combat' → WebSocketManager
  → mapServer.combatManager.startPlayerCombat()
  → mapServer.combatManager.processPlayerCombat()
  → Broadcast 'combat_update'
```

#### **Position Flow**
```
Client → 'position_update' → WebSocketManager
  → mapServer.positionUpdateQueue.push()
  → mapServer.processPositionUpdates() [tick]
  → Broadcast 'remote_player_update'
```

## 🔄 **Interazione Core Systems**

```
WebSocketManager
    ↓ (riceve messaggi)
MapServer
├── npcManager ← gestione NPC
├── combatManager ← logica combattimento  
└── projectileManager ← fisica proiettili
```

## 📊 **Performance & Scalability**

### **MapServer**
- **Memory**: Efficient Map() per players e positionQueue
- **CPU**: Tick 20Hz ottimizzato con early returns
- **Network**: Interest radius broadcasting (O(n) ottimizzato)

### **WebSocketManager**
- **Connections**: WebSocket nativo per alta concorrenza
- **Message Rate**: Monitoraggio throughput automatico
- **State Sync**: Sincronizzazione selettiva basata su prossimità
- **Error Recovery**: Isolamento errori per singola connessione

## 🧪 **Testing**

```javascript
// Test MapServer
const mapServer = new MapServer('test_map');
mapServer.initialize();
console.assert(mapServer.npcManager.getAllNpcs().length > 0);

// Test WebSocketManager (mock wss)
const mockWSS = { on: () => {} };
const wsManager = new WebSocketConnectionManager(mockWSS, mapServer, messageCount);
```

## 🎯 **Design Principles**

### **Separation of Concerns**
- **MapServer**: Stato e orchestrazione gioco
- **WebSocketManager**: Comunicazione rete isolata

### **Dependency Injection**
- MapServer riceve config
- WebSocketManager riceve wss, mapServer, messageCount

### **Error Boundaries**
- Errori WebSocket non crashano MapServer
- Errori tick isolati con logging

### **Scalability Ready**
- MapServer può essere istanziato multipli (future mappe)
- WebSocketManager può gestire migliaia connessioni

## 📈 **Metrics**

- **Tick Rate**: 20Hz (50ms intervals)
- **Broadcast Efficiency**: Interest radius optimization
- **Memory Usage**: Bounded queues and cleanup automatico
- **Connection Handling**: Error recovery e graceful disconnect

---

*Sistemi core per architettura server scalabile e maintainabile* 🏗️
