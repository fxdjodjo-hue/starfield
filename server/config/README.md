# ⚙️ **Constants & Configuration** - `server/config/constants.cjs`

Configurazione centralizzata di tutte le costanti di gioco per Starfield server.

## 🎯 **Scopo**

Centralizzare tutte le costanti di gioco per:
- **Manutenibilità** - Un solo posto per modifiche
- **Consistenza** - Valori uniformi in tutto il server
- **Configurabilità** - Environment-specific settings
- **Documentazione** - Tutte le costanti documentate

## 📊 **Struttura**

```javascript
module.exports = {
  SERVER_CONSTANTS: {
    PROJECTILE: { /* velocità, danno */ },
    COMBAT: { /* range, cooldown, damage */ },
    NETWORK: { /* interest radius, timeouts */ }
  },
  NPC_CONFIG: {
    Scouter: {
      stats: { /* HP, shield, speed, damage, range, cooldown */ },
      rewards: { /* credits, experience, honor */ }
    },
    Frigate: { /* stessa struttura */ }
  }
};
```

## 🎮 **Costanti Gioco**

### **Projectile System**
```javascript
PROJECTILE: {
  SPEED: 800,           // pixel/secondo
  // Proiettili spawnano dal centro esatto delle navi
  MAX_LIFETIME: 10000   // millisecondi
}
```

### **Combat System**
```javascript
COMBAT: {
  PLAYER_RANGE: 300,    // raggio attacco player
  PLAYER_COOLDOWN: 1000 // millisecondi tra spari
}
```

### **Network System**
```javascript
NETWORK: {
  INTEREST_RADIUS: 1500, // raggio broadcasting
  WORLD_RADIUS: 10000,   // dimensione mondo
  TIMEOUTS: {
    CONNECTION: 30000,   // timeout connessione
    HEARTBEAT: 5000      // intervallo heartbeat
  }
}
```

## 👾 **NPC Configuration**

### **Scouter Stats**
```javascript
Scouter: {
  stats: {
    maxHealth: 800,
    maxShield: 400,
    speed: 150,
    damage: 100,
    range: 400,
    cooldown: 1500
  },
  rewards: {
    credits: 400,
    experience: 400,
    honor: 2
  }
}
```

### **Frigate Stats**
```javascript
Frigate: {
  stats: {
    maxHealth: 1600,
    maxShield: 800,
    speed: 100,
    damage: 200,
    range: 600,
    cooldown: 2000
  },
  rewards: {
    credits: 800,
    experience: 800,
    honor: 4
  }
}
```

## 🔧 **Utilizzo**

```javascript
const { SERVER_CONSTANTS, NPC_CONFIG } = require('./server/config/constants.cjs');

// Accedere a costanti
const playerRange = SERVER_CONSTANTS.COMBAT.PLAYER_RANGE;
const scouterSpeed = NPC_CONFIG.Scouter.stats.speed;

// Calcolo danno
const damage = SERVER_CONSTANTS.PROJECTILE.DAMAGE_BASE * multiplier;
```

## 🎛️ **Configurazione Environment**

```bash
# Environment variables per override
NODE_ENV=production
LOG_LEVEL=INFO
PORT=3000

# Costanti hardcoded per ora, future versioni avranno env override
```

## 📈 **Manutenzione**

### **Aggiungere Nuovo NPC**
```javascript
NPC_CONFIG: {
  // ... esistenti
  Destroyer: {
    stats: {
      maxHealth: 3200,
      maxShield: 1600,
      speed: 80,
      damage: 400,
      range: 800,
      cooldown: 2500
    },
    rewards: {
      credits: 1600,
      experience: 1600,
      honor: 8
    }
  }
}
```

### **Modificare Balance**
```javascript
// Incremento globale danni
Object.keys(NPC_CONFIG).forEach(npcType => {
  NPC_CONFIG[npcType].stats.damage *= 1.1;
});
```

## 🔗 **Dipendenze**

- **Nessuna** dipendenza esterna
- Utilizza solo Node.js built-in

## 🧪 **Testing**

```javascript
const { SERVER_CONSTANTS, NPC_CONFIG } = require('./constants.cjs');

// Test validità costanti
console.assert(SERVER_CONSTANTS.PROJECTILE.SPEED > 0, 'Speed deve essere positiva');
console.assert(NPC_CONFIG.Scouter.stats.maxHealth > 0, 'HP deve essere positiva');

// Test bilanciamento
const scouterDPS = NPC_CONFIG.Scouter.stats.damage / (NPC_CONFIG.Scouter.stats.cooldown / 1000);
console.log(`Scouter DPS: ${scouterDPS}`);
```

## ⚠️ **Best Practices**

- **Non modificare** costanti a runtime
- **Documentare** nuove costanti aggiunte
- **Testare** modifiche di balance
- **Versionare** cambiamenti significativi
- **Backup** prima di modifiche massive

## 📊 **Statistiche**

- **NPC Types**: 2 (Scouter, Frigate)
- **Constants Groups**: 3 (Projectile, Combat, Network)
- **Total Values**: ~25 costanti configurabili
- **Maintainability**: ⭐⭐⭐⭐⭐ (Single source of truth)

---

*Configurazione centralizzata per game design e bilanciamento* 🎮
