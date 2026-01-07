# 📝 **Logger System** - `server/logger.cjs`

Sistema di logging strutturato per il server Starfield con livelli di severità, colori ANSI e monitoraggio performance.

## 🎯 **Scopo**

Centralizzare tutto il logging del server con:
- **Livelli di severità** configurabili
- **Colori ANSI** per leggibilità console
- **Timestamp** per ogni log entry
- **Monitoraggio performance** messaggi al secondo
- **Moduli identificati** per tracciamento origine

## 🔧 **API**

```javascript
const { logger, messageCount } = require('./server/logger.cjs');

// Logging con livelli
logger.error('MODULE', 'Messaggio errore', datiOpzionali);
logger.warn('MODULE', 'Messaggio warning', datiOpzionali);
logger.info('MODULE', 'Messaggio info', datiOpzionali);
logger.debug('MODULE', 'Messaggio debug', datiOpzionali);

// Monitoraggio messaggi
messageCount.increment(); // Incrementa contatore
const total = messageCount.get(); // Leggi contatore
```

## ⚙️ **Configurazione**

### **Livello Log**
```bash
# Environment variable
LOG_LEVEL=INFO    # ERROR, WARN, INFO, DEBUG
```

### **Livelli Disponibili**
- `ERROR` (0) - Errori critici
- `WARN` (1) - Warning non bloccanti
- `INFO` (2) - Informazioni operative
- `DEBUG` (3) - Dettagli di debug

## 📊 **Monitoraggio Performance**

Automaticamente ogni 30 secondi logga:
```
INFO [PERF] Message throughput: 150 messages in 30.0s (5.0 msg/s)
```

## 🎨 **Output Formattato**

```
[2024-01-07T15:30:45.123Z] INFO  [SERVER] Server started on 0.0.0.0:3000
[2024-01-07T15:30:45.124Z] ERROR [COMBAT] NPC not found: npc_123
[2024-01-07T15:30:45.125Z] DEBUG [PROJECTILE] Created projectile p_456
```

## 🔗 **Dipendenze**

- **Nessuna** dipendenza esterna
- Utilizza solo Node.js built-in (`process.env`)

## 🧪 **Testing**

```javascript
// Test livelli log
logger.info('TEST', 'Logger inizializzato');
logger.debug('TEST', 'Questo non appare se livello < DEBUG');

// Test performance
messageCount.increment();
messageCount.increment();
console.log('Messaggi processati:', messageCount.get());
```

## 📋 **Best Practices**

### **Convenzioni Nomi Moduli**
```javascript
logger.info('SERVER', 'Server avviato');
logger.info('PLAYER', 'Giocatore connesso');
logger.info('COMBAT', 'Combattimento iniziato');
logger.info('NPC', 'NPC spawnato');
```

### **Dati Strutturati**
```javascript
logger.info('PLAYER', `Player ${playerId} joined`, {
  playerId,
  nickname,
  position: { x, y }
});
```

### **Error Handling**
```javascript
try {
  // codice rischioso
} catch (error) {
  logger.error('MODULE', 'Operazione fallita', error.message);
}
```

## 🚀 **Performance**

- **Zero allocazione** per logging disabilitato
- **Buffer circolare** per monitoraggio messaggi
- **ANSI colors** solo se supporto console
- **Lazy evaluation** dei parametri dati

---

*Sistema di logging enterprise-grade per architettura server modulare* 🎯
