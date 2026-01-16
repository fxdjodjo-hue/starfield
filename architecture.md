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
// 1. I componenti multiplayer sono già implementati in src/multiplayer/
//    - ClientNetworkSystem: gestione connessione client
//    - ServerNetworkSystem: logica server (futuro)
//    - NetworkMessage: protocollo di comunicazione

// 2. Integrazione con ECS esistente
// Il sistema è progettato per integrarsi con l'ECS attuale,
// con supporto per sincronizzazione dello stato del mondo

// 3. Architettura Scalabile
// - Event-driven per aggiornamenti real-time
// - State synchronization con delta compression
// - Client-side prediction e rollback
// - Heartbeat e gestione disconnessioni
```

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

## ⚡ Ottimizzazioni Implementate

### Multiplayer-First Architecture

#### GameContext Multiplayer-Ready
- **Player Management**: Map di tutti i giocatori connessi invece di singolo player
- **Connection State**: Gestione stato connessione server (connecting, connected, error)
- **Room System**: Supporto per stanze/lobby di gioco
- **Authority Levels**: Sistema di autorità (server/client predictive/client local)

#### Authority System (ECS)
- **Authority Levels**: SERVER_AUTHORITATIVE, CLIENT_PREDICTIVE, CLIENT_LOCAL
- **Owner Tracking**: Ogni entity traccia il suo "proprietario"
- **Prediction State**: Tracking di stati predetti vs confermati
- **Synchronization Control**: Controllo se entity necessita sincronizzazione

#### Network Architecture
- **Client Prediction**: Input smoothing con correzione server
- **Server Reconciliation**: Correzione stato quando necessario
- **State Synchronization**: Sincronizzazione selettiva basata su autorità
- **Connection Management**: Gestione connessioni/disconnessioni giocatori
- **Player ID Sequential**: ID numerici sequenziali da 1 invece di UUID
- **Schema Optimization**: Tabelle separate per stats, upgrades, currencies, quests

### Performance
- **Selective Updates**: Aggiornamenti solo quando necessario
- **Resource Pooling**: Preparato per object pooling
- **Efficient ECS**: Sistema entity-component ottimizzato
- **Lazy Loading**: Caricamento dati on-demand

### Architettura Scalabile
- **Plugin Systems**: Sistemi indipendenti e sostituibili
- **Clean Separation**: Layer ben definiti e isolati
- **Modular Design**: Facile estensione senza breaking changes
- **Multiplayer Ready**: Componenti rete già implementati
- **Adaptive Saving**: Salvataggi automatici disabilitabili per multiplayer
- **State Synchronization**: Supporto per sincronizzazione multiplayer
- **Performance Logging**: Logging condizionale per produzione

## 🧪 Testing Strategy

### Unit Tests (Ottimizzati)
- **Core Systems**: ECS, Game Loop, Database integration
- **Critical Entities**: Player, NPC, Combat systems
- **Essential Utils**: Config, validation, utilities

### Integration Tests
- **Scene + Systems**: Test orchestrazione completa
- **Input + Entities**: Test interazioni utente
- **Database Flow**: Caricamento/salvataggio end-to-end

### E2E Tests
- **Full Game**: Test flusso completo utente
- **Database Persistence**: Verifica salvataggio effettivo

## 🧹 Manutenzione e Pulizia

### Code Organization
- **Multiplayer Components**: Spostati in `src/multiplayer/` per isolamento
- **Test Cleanup**: Rimossi test ridondanti e UI non critici
- **File Removal**: Eliminati script temporanei di testing
- **Import Optimization**: Dipendenze minime e organizzate

### Database Optimization
- **Schema Normalization**: Tabelle separate per stats, upgrades, currencies
- **Efficient Queries**: Upsert operations con conflict resolution
- **Recovery Logic**: Gestione automatica dati mancanti
- **Security**: RLS policies per isolamento dati utente

## 📈 Metriche di Qualità

- **Cyclomatic Complexity**: < 10 per funzione
- **Code Coverage**: > 70% (core systems)
- **Dependencies**: Max 5 dipendenze per modulo
- **Lines per File**: < 200 righe
- **Database Calls**: Minime e ottimizzate

## 🔧 Best Practices Implementate

- **Error Handling**: Try/catch negli event handlers
- **Resource Management**: Cleanup esplicito in destroy()
- **Performance**: Update selettivo, object pooling ready
- **Documentation**: README per ogni cartella, JSDoc
- **Naming**: Convenzioni coerenti (PascalCase classi, camelCase metodi)
- **Database Safety**: Transazioni e recovery automatica

## 🚀 Status Attuale: Multiplayer-First Architecture + Phase 1 Refactor

### ✅ Rifattorizzato per Multiplayer-Only
- **GameContext Multiplayer**: Gestione giocatori multipli e stanze
- **Authority System**: Implementato sistema di autorità ECS
- **Single-Player Legacy Removed**: Tutto il salvataggio individuale rimosso
- **Network Architecture**: Base per sincronizzazione e prediction

### 🎯 Multiplayer Components Ready
- **Authority Levels**: SERVER_AUTHORITATIVE, CLIENT_PREDICTIVE, CLIENT_LOCAL
- **Player State Management**: Tracking completo di tutti i giocatori connessi
- **Connection Management**: Stati connessione e gestione stanze
- **ECS Networking**: Foundation per entity sincronizzate

### 🔄 Phase 1 Refactor (Completato)

#### FASE 1.1 - WebSocket & Messaging
**Obiettivo**: Separare gestione connessioni dal routing messaggi.

**Risultato**:
- `WebSocketConnectionManager.cjs`: 245 righe (connessioni + validazione)
- `MessageRouter.cjs`: Routing centralizzato con handler puri
- Handler isolati e testabili
- Context esplicito per dipendenze

**Moduli creati**:
- `connection/WebSocketConnectionManager.cjs` - Gestione connessioni WebSocket
- `connection/MessageRouter.cjs` - Routing e dispatch messaggi
- `database/PlayerDataManager.cjs` - Operazioni database Supabase
- `auth/AuthenticationManager.cjs` - Security validation
- `messaging/MessageBroadcaster.cjs` - Formattazione e broadcast

#### FASE 1.2 - Projectile System
**Obiettivo**: Modularizzare sistema proiettili (819 → 316 righe orchestratore).

**Risultato**:
- `projectile-manager.cjs`: 316 righe (orchestratore)
- 6 moduli specializzati con responsabilità singola
- API pubblica invariata (backward compatible)
- Dependency injection per testabilità

**Moduli creati**:
- `projectile/ProjectileSpawner.cjs` - Creazione e setup iniziale
- `projectile/ProjectilePhysics.cjs` - Movimento e fisica
- `projectile/ProjectileCollision.cjs` - Rilevamento collisioni
- `projectile/ProjectileHoming.cjs` - Logica homing avanzata
- `projectile/ProjectileBroadcaster.cjs` - Eventi di rete
- `projectile/ProjectileDamageHandler.cjs` - Danno e ricompense

#### FASE 1.3 - Game Initialization
**Obiettivo**: Separare creazione, configurazione e inizializzazione (631 → 153 righe).

**Risultato**:
- `GameInitializationSystem.ts`: 153 righe (orchestratore)
- 3 moduli factory con responsabilità chiare
- Zero logica di business nell'orchestratore

**Moduli creati**:
- `game/SystemFactory.ts` - Creazione sistemi e caricamento asset
- `game/SystemConfigurator.ts` - Configurazione interazioni tra sistemi
- `game/EntityFactory.ts` - Creazione entità iniziali (player, teleport)

### 🔄 Prossimi Passi Multiplayer
- **Client-Side Prediction**: Implementare input smoothing
- **Server Reconciliation**: Sistema correzione stato
- **Room/Lobby System**: Matchmaking e gestione stanze
- **State Synchronization**: Sincronizzazione entity basata su autorità

### 📊 Metriche di Qualità
- **Build Size**: ~360KB gzipped (ottimizzato)
- **Database Calls**: Minime e ottimizzate
- **Error Handling**: Robusto con recovery automatico
- **Code Coverage**: >70% sui sistemi core
- **Performance**: Logging condizionale per produzione
- **File Size**: Orchestratori < 400 righe, moduli < 300 righe
- **Single Responsibility**: Ogni modulo con responsabilità unica

Questa architettura garantisce un progetto **maintainibile, estensibile e scalabile** per lo sviluppo di giochi complessi, ora **pronto per la produzione e l'espansione multiplayer** con codebase modulare e testabile.
