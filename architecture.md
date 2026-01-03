# Architettura del Progetto

## 🏛️ Principi Architetturali

Questo progetto segue un'architettura **modulare e orientata ai sistemi** ispirata ai principi del Clean Architecture e dell'Entity-Component-System pattern.

### Core Principles

1. **🎯 Single Responsibility**: Ogni modulo ha una responsabilità precisa e ben definita
2. **🔄 Dependency Inversion**: Le dipendenze puntano sempre verso l'interno (dalla scena ai sistemi, dai sistemi alle entità)
3. **📦 Open/Closed**: Aperto all'estensione ma chiuso alla modifica
4. **🔌 Plugin Architecture**: Sistemi indipendenti e sostituibili
5. **🎮 Game Loop Pulito**: Logica → Rendering → Repeat

## 🏗️ Struttura a Layer

```
┌─────────────────────────────────────┐
│           Scenes Layer              │ ← Orchestrazione
├─────────────────────────────────────┤
│          Systems Layer              │ ← Funzionalità trasversali
├─────────────────────────────────────┤
│         Entities Layer              │ ← Logica di business
├─────────────────────────────────────┤
│           Core Layer                │ ← Componenti base
├─────────────────────────────────────┤
│          Utils Layer                │ ← Utility & Config
└─────────────────────────────────────┘
```

### Scenes Layer
- **Scopo**: Orchestrazione e gestione del ciclo di vita
- **Contiene**: Phaser Scenes, game loop, routing eventi
- **NON contiene**: Logica di business, rendering diretto

### Systems Layer
- **Scopo**: Funzionalità trasversali indipendenti
- **Contiene**: Input, Rendering, Physics, Audio, Network
- **Caratteristiche**: Plugin-like, testabili isolatamente

### Entities Layer
- **Scopo**: Logica specifica delle entità di gioco
- **Contiene**: Player, NPC, Projectile, Enemy
- **Caratteristiche**: Solo logica, zero rendering

### Core Layer
- **Scopo**: Componenti base riutilizzabili
- **Contiene**: Entity base, interfacce comuni
- **Caratteristiche**: Astratto, estensibile

### Utils Layer
- **Scopo**: Supporto e configurazione
- **Contiene**: Config, utility functions, costanti
- **Caratteristiche**: Statici, puri

## 🔄 Flusso dei Dati

```
Input Event → InputManager → GameScene → Entity Logic → RenderSystem → Display
     ↑              ↓             ↓            ↓              ↓
  User        Event Callbacks  Coordination  State Update  Visual Update
```

## 📊 Vantaggi dell'Architettura

### Manutenibilità
- **Modularità**: Cambiamenti isolati a singoli moduli
- **Testabilità**: Ogni componente testabile indipendentemente
- **Leggibilità**: Codice auto-documentante

### Estensibilità
- **Nuove entità**: Basta estendere `Entity` e registrare
- **Nuovi sistemi**: Implementare interfaccia e collegare
- **Nuove scene**: Creare classe e aggiungere route

### Scalabilità
- **Performance**: Sistemi ottimizzabili singolarmente
- **Team development**: Sviluppatori possono lavorare in parallelo
- **Code reuse**: Componenti riutilizzabili tra progetti

## 🚀 Esempi di Estensione

### Aggiungere un Sistema Audio
```javascript
// 1. Creare AudioSystem.js in systems/
export default class AudioSystem {
    playSound(name) { /* ... */ }
    playMusic(track) { /* ... */ }
}

// 2. Inizializzare in GameScene.js
this.audioSystem = new AudioSystem();

// 3. Usare quando necessario
this.audioSystem.playSound('jump');
```

### Aggiungere Multiplayer
```javascript
// 1. Creare NetworkSystem.js in systems/
export default class NetworkSystem {
    constructor(serverUrl) {
        this.socket = io(serverUrl);
        this.entities = new Map();
        this.localPlayerId = null;
    }

    connect() {
        this.socket.on('connect', () => {
            this.localPlayerId = this.socket.id;
        });

        this.socket.on('entityUpdate', (data) => {
            this.updateRemoteEntity(data);
        });
    }

    syncEntity(entity) {
        this.socket.emit('entityUpdate', {
            id: entity.id,
            x: entity.x,
            y: entity.y,
            state: entity.getState()
        });
    }
}

// 2. Creare RemotePlayer.js in entities/
export default class RemotePlayer extends Entity {
    constructor(id, x, y) {
        super(x, y, 32, 32);
        this.networkId = id;
        this.lastUpdate = Date.now();
    }

    // Sincronizzazione da rete
    syncFromNetwork(data) {
        this.x = data.x;
        this.y = data.y;
        this.lastUpdate = Date.now();
    }
}

// 3. Modificare GameScene.js
initializeSystems() {
    // Sistemi esistenti...
    this.networkSystem = new NetworkSystem('ws://localhost:3000');
    this.networkSystem.connect();
}

createEntities() {
    // Player locale
    this.player = new Player(centerX, centerY);
    this.renderSystem.registerEntity(this.player, 'player');

    // Ascolta nuovi giocatori remoti
    this.networkSystem.onPlayerJoin((playerData) => {
        const remotePlayer = new RemotePlayer(playerData.id, playerData.x, playerData.y);
        this.renderSystem.registerEntity(remotePlayer, 'remotePlayer');
    });
}
```

### Aggiungere un Tipo di NPC
```javascript
// 1. Creare MerchantNpc.js in entities/
export default class MerchantNpc extends Npc {
    constructor(x, y) {
        super(x, y, 'merchant');
        this.inventory = [];
    }

    interact(player) {
        // Logica interazione mercante
    }
}

// 2. Registrare nel RenderSystem
this.renderSystem.registerEntity(merchant, 'merchant');

// 3. Gestire nella GameScene
this.merchant = new MerchantNpc(200, 300);
```

## 🧪 Testing Strategy

### Unit Tests
- **Entities**: Testare logica isolata senza Phaser
- **Systems**: Mock delle dipendenze esterne
- **Utils**: Test funzioni pure

### Integration Tests
- **Scene + Systems**: Test orchestrazione completa
- **Input + Entities**: Test interazioni utente

### E2E Tests
- **Full Game**: Test flusso completo utente

## 📈 Metriche di Qualità

- **Cyclomatic Complexity**: < 10 per funzione
- **Code Coverage**: > 80%
- **Dependencies**: Max 5 dipendenze per modulo
- **Lines per File**: < 200 righe

## 🔧 Best Practices Implementate

- **Error Handling**: Try/catch negli event handlers
- **Resource Management**: Cleanup esplicito in destroy()
- **Performance**: Update selettivo, object pooling ready
- **Documentation**: README per ogni cartella, JSDoc
- **Naming**: Convenzioni coerenti (PascalCase classi, camelCase metodi)

Questa architettura garantisce un progetto **maintainibile, estensibile e scalabile** per lo sviluppo di giochi complessi.
