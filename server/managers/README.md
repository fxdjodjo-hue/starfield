# 🎯 **Game Managers** - `server/managers/`

Suite di manager specializzati per la logica di gioco server-side.

## 📁 **Struttura**

```
managers/
├── npc-manager.cjs        # 👾 Gestione NPC e AI
├── combat-manager.cjs     # ⚔️ Sistema di combattimento
└── projectile-manager.cjs # 🚀 Fisica e gestione proiettili
```

## 👾 **NPC Manager** - `npc-manager.cjs`

### **Responsabilità**
- Creazione e gestione entità NPC
- Spawn iniziale del mondo
- Respawn automatico post-morte
- Aggiornamento stati vitali (HP, Shield)
- Calcolo ricompense uccisione

### **API Principale**
```javascript
const npcManager = new ServerNpcManager(mapServer);

// Gestione NPC
npcManager.createNpc('Scouter', x, y);
npcManager.damageNpc(npcId, damage, attackerId);
npcManager.getNpc(npcId);
npcManager.getAllNpcs();

// Sistema mondo
npcManager.initializeWorldNpcs(scouterCount, frigateCount);
npcManager.destroy(); // Cleanup
```

### **Architettura AI**
- **Behavior System**: NPC con comportamenti configurabili
- **Respawn Logic**: Timer automatici per rigenerazione
- **Reward Calculation**: Sistema ricompense basato su tipo NPC

## ⚔️ **Combat Manager** - `combat-manager.cjs`

### **Responsabilità**
- Orchestrazione combattimenti player vs NPC
- Gestione stati combattimento attivi
- Logica attacco player (cooldown, range)
- Intelligenza difensiva NPC

### **API Principale**
```javascript
const combatManager = new ServerCombatManager(mapServer);

// Gestione combattimenti
combatManager.startPlayerCombat(playerId, npcId);
combatManager.stopPlayerCombat(playerId);
combatManager.updateCombat(); // Tick combattimento

// Stati interni
combatManager.playerCombats; // Map<playerId, combatState>
combatManager.npcAttackCooldowns; // Map<npcId, lastAttackTime>
```

### **Logica Combattimento**
- **Range Checking**: Verifica distanza player-NPC
- **Cooldown System**: Previeni spam attacchi
- **Target Locking**: Proiettili homing specifici
- **Grace Period**: Periodo di grazia iniziale

## 🚀 **Projectile Manager** - `projectile-manager.cjs`

### **Responsabilità**
- Creazione e tracking proiettili
- Simulazione fisica (movimento, collisioni)
- Gestione lifetime e cleanup
- Broadcasting eventi esplosioni
- Calcolo danni e morte entità

### **API Principale**
```javascript
const projectileManager = new ServerProjectileManager(mapServer);

// Gestione proiettili
projectileManager.addProjectile(id, playerId, position, velocity, damage, type, targetId);
projectileManager.updateProjectile(id, position);
projectileManager.removeProjectile(id, reason);
projectileManager.checkCollisions(); // Tick fisica

// Utilità
projectileManager.getStats(); // Metriche proiettili attivi
```

### **Sistema Fisica**
- **Movement Simulation**: Aggiornamento posizione in tempo reale
- **Collision Detection**: Rilevamento collisioni con NPC/player
- **Target-Specific Hits**: Logica homing per bersagli designati
- **Bounds Checking**: Rimozione proiettili fuori mondo

## 🔗 **Interdipendenze**

```
MapServer
├── npcManager (NPC Manager)
├── combatManager (Combat Manager)
└── projectileManager (Projectile Manager)
    └── npcManager (per danni/ricompense)
    └── combatManager (per stati combattimento)
```

## 📊 **Performance**

- **Tick Rate**: Tutti i manager aggiornati a 20Hz
- **Memory Management**: Cleanup automatico proiettili scaduti
- **Collision Optimization**: Algoritmi efficienti per detection
- **State Tracking**: Mappe ottimizzate per lookup O(1)

## 🧪 **Testing**

```javascript
// Test NPC Manager
const npcManager = new ServerNpcManager(mockMapServer);
npcManager.initializeWorldNpcs(5, 5);
console.assert(npcManager.getAllNpcs().length === 10);

// Test Combat Manager
const combatManager = new ServerCombatManager(mockMapServer);
combatManager.startPlayerCombat('player1', 'npc1');
console.assert(combatManager.playerCombats.has('player1'));

// Test Projectile Manager
const projectileManager = new ServerProjectileManager(mockMapServer);
projectileManager.addProjectile('p1', 'player1', {x:0,y:0}, {x:1,y:0}, 100);
console.assert(projectileManager.projectiles.size === 1);
```

## 🎯 **Design Principles**

- **Single Responsibility**: Ogni manager una sola responsabilità
- **Dependency Injection**: MapServer passato come dipendenza
- **State Isolation**: Stati interni protetti e incapsulati
- **Error Resilience**: Gestione errori senza crash sistema

---

*Manager specializzati per logica di gioco complessa e scalabile* 🎮
