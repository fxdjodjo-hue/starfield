# 🖥️ **Starfield Server Architecture**

Modulo server principale per il gioco Starfield MMO, implementato con architettura modulare e server-authoritative.

## 📁 **Struttura Moduli**

```
server/
├── logger.cjs                 # Sistema di logging strutturato
├── config/
│   └── constants.cjs          # Costanti e configurazione di gioco
├── managers/
│   ├── npc-manager.cjs        # Gestione NPC e comportamenti AI
│   ├── combat-manager.cjs     # Sistema di combattimento server-side
│   └── projectile-manager.cjs # Fisica e gestione proiettili
└── core/
    ├── map-server.cjs         # Contesto principale della mappa
    └── websocket-manager.cjs  # Gestione connessioni WebSocket
```

## 🚀 **Entry Point**

Il file principale `server.cjs` (88 righe) orchestra tutti i moduli:

```javascript
// Import moduli
const MapServer = require('./server/core/map-server.cjs');
const WebSocketConnectionManager = require('./server/core/websocket-manager.cjs');

// Setup server HTTP/WebSocket
const server = http.createServer(/* health check */);
const wss = new WebSocket.Server({ server });

// Orchestrazione moduli
const mapServer = new MapServer('default_map');
mapServer.combatManager = new ServerCombatManager(mapServer);

const wsManager = new WebSocketConnectionManager(wss, mapServer, messageCount);
```

## 🎯 **Architettura**

### **Single Responsibility Principle**
- **Ogni modulo** ha una responsabilità specifica e isolata
- **Dipendenze esplicite** dichiarate nei require()
- **Interfacce chiare** documentate nei commenti

### **Server Authoritative**
- Tutto lo stato di gioco controllato dal server
- Client riceve solo aggiornamenti autorizzati
- Prevenzione cheat e sincronizzazione garantita

### **Modular Design**
- Facile sostituzione di componenti
- Testing isolato per ogni modulo
- Manutenibilità e scalabilità ottimali

## 📊 **Performance**

- **Tick Rate**: 20 Hz (50ms intervals)
- **Real-time**: WebSocket per aggiornamenti immediati
- **Interest Radius**: Broadcasting ottimizzato per prossimità
- **Monitoring**: Logging strutturato con metriche performance

## 🔧 **Configurazione**

### **Environment Variables**
```bash
NODE_ENV=production
LOG_LEVEL=INFO|WARN|ERROR|DEBUG
PORT=3000
```

### **Game Constants**
- Configurabili in `server/config/constants.cjs`
- NPC stats, damage, ranges, cooldowns
- Network settings e timeouts

## 🧪 **Testing**

```bash
# Test singolo modulo
node -e "require('./server/managers/npc-manager.cjs')"

# Health check
curl http://localhost:3000/health
```

## 📖 **Documentazione Moduli**

- [Logger System](./logger.cjs) - Sistema di logging strutturato
- [Constants](./config/constants.cjs) - Configurazione di gioco
- [NPC Manager](./managers/npc-manager.cjs) - Intelligenza artificiale
- [Combat Manager](./managers/combat-manager.cjs) - Sistema di combattimento
- [Projectile Manager](./managers/projectile-manager.cjs) - Fisica proiettili
- [Map Server](./core/map-server.cjs) - Contesto di gioco principale
- [WebSocket Manager](./core/websocket-manager.cjs) - Connessioni rete

---

*Architettura modulare completata - Server ridotto da 1700 a 88 righe di orchestrazione pura* 🎯
