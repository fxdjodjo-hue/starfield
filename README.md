# Starfield - Gioco Spaziale 2D

Un gioco spaziale 2D multiplayer realizzato con TypeScript, Canvas API e architettura ECS (Entity-Component-System).

## 🚀 Caratteristiche

- **Combattimento spaziale** in tempo reale
- **Sistema ECS modulare** per massima flessibilità
- **Architettura a layer** per manutenzione e scalabilità
- **Rendering ottimizzato** con camera dinamica
- **NPC intelligenti** con comportamento autonomo
- **Sistema di selezione** e controllo tattico
- **Pronto per multiplayer** (socket.io ready)

## 🏗️ Architettura

Il progetto segue un'architettura **a layer modulare** ispirata ai principi Clean Architecture:

```
src/
├── main.ts              # Entry point
├── states/              # 🎭 Scenes Layer - Orchestrazione
│   ├── GameState.ts     # Classe base per stati di gioco
│   ├── StartState.ts    # Schermata iniziale
│   └── PlayState.ts     # Gameplay attivo
├── systems/             # ⚙️ Systems Layer - Funzionalità trasversali
│   ├── RenderSystem.ts  # Rendering principale
│   ├── MovementSystem.ts# Movimento e fisica
│   ├── CombatSystem.ts  # Logica combattimento
│   ├── InputSystem.ts   # Gestione input
│   └── ... (altri sistemi)
├── entities/            # 🎯 Entities Layer - Componenti entità
│   ├── Transform.ts     # Posizione, rotazione, scala
│   ├── Velocity.ts      # Movimento
│   ├── Health.ts        # Vita e danni
│   ├── Damage.ts        # Sistema danno
│   └── ... (altri componenti)
├── core/                # 🏛️ Core Layer - Componenti base
│   ├── Game.ts          # Game orchestrator
│   ├── GameLoop.ts      # Main game loop
│   ├── World.ts         # Game world container
│   └── GameContext.ts   # Shared game context
├── ecs/                 # 🔧 ECS Framework
│   ├── Entity.ts        # Entity base class
│   ├── Component.ts     # Component interface
│   ├── System.ts        # System base class
│   └── ECS.ts           # ECS manager
├── ui/                  # 🖥️ UI Layer - Interfacce utente
│   └── StartScreen.ts   # Schermata iniziale UI
└── utils/               # 🛠️ Utils Layer - Utility & Config
    ├── Config.ts        # Configurazioni globali
    ├── CanvasRenderer.ts# Utility rendering Canvas
    └── MouseInput.ts    # Utility gestione mouse
```

### 📋 Principi Architetturali

1. **🎯 Single Responsibility** - Ogni modulo ha una responsabilità precisa
2. **🔄 Dependency Inversion** - Dipendenze verso l'interno (Scenes → Systems → Entities → Core → Utils)
3. **📦 Open/Closed** - Aperto all'estensione, chiuso alla modifica
4. **🔌 Plugin Architecture** - Sistemi indipendenti e sostituibili
5. **🎮 Game Loop Pulito** - Update → Render → Repeat

## 🎮 Come Giocare

### Controlli
- **Mouse sinistro**: Seleziona NPC nemici
- **Mouse sinistro + trascina**: Muovi la nave player
- **Barra spaziatrice**: Spara automaticamente ai nemici selezionati
- **Tasto H**: Mostra/nascondi HUD espanso

### Obiettivo
- Sopravvivi combattendo gli NPC spaziali
- Gestisci la tua salute e munizioni
- Usa tattiche di selezione per combattere strategicamente

## 🛠️ Sviluppo

### Prerequisiti
- Node.js 18+
- npm o yarn

### Installazione
```bash
# Clona il repository
git clone <repository-url>
cd starfield

# Installa dipendenze
npm install

# Avvia development server
npm run dev

# Build per produzione
npm run build
```

### 🧪 Testing
```bash
# Build con type checking
npm run build

# Preview build locale
npm run preview
```

## 🔧 Estensioni Future

### Multiplayer
Il codice è strutturato per aggiungere facilmente multiplayer:
```bash
npm install socket.io socket.io-client
```

### Nuovi Sistemi
Per aggiungere un nuovo sistema ECS:
1. Crea `NewSystem.ts` in `src/systems/`
2. Estendi `BaseSystem`
3. Registralo in `PlayState.initializeGame()`

### Nuove Entità
Per aggiungere nuovi tipi di NPC/entità:
1. Crea nuovi componenti in `src/entities/`
2. Crea sistemi specifici se necessario
3. Registra nell'ECS nel `PlayState`

## 📊 Metriche Qualità

- **Cyclomatic Complexity**: < 10 per funzione
- **Code Coverage**: Target 80%+
- **Dependencies**: Max 5 dipendenze per modulo
- **Lines per File**: < 200 righe
- **TypeScript Strict**: Abilitato

## 📝 Licenza

Questo progetto è distribuito sotto licenza MIT.

## 🤝 Contributi

Contributi benvenuti! Segui l'architettura documentata e assicurati che i test passino.

---

*Realizzato con TypeScript, Canvas 2D e passione per i giochi spaziali!* 🚀
