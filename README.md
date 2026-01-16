# Starfield - Gioco Spaziale 2D

Un gioco spaziale 2D realizzato con TypeScript, Canvas API e architettura ECS (Entity-Component-System) completamente modulare.

## 🚀 Caratteristiche

- **Combattimento spaziale** in tempo reale con NPC intelligenti
- **Sistema ECS modulare** per massima flessibilità e performance
- **Architettura a layer** per manutenzione e scalabilità ottimali
- **Rendering ottimizzato** con camera dinamica e parallasse
- **Sistema di selezione tattica** per controllo strategico
- **Game states** per transizioni fluide (Start → Play)
- **Pronto per estensioni** (multiplayer, nuovi sistemi, etc.)

## 🏗️ Architettura Attuale

Il progetto segue un'architettura **modulare e scalabile** con separazione chiara delle responsabilità:

### Client-Side (TypeScript/ECS)

```
src/
├── game/                          # 🎮 Logica di gioco
│   ├── core/
│   │   └── main.ts                # Entry point applicazione
│   └── states/                    # Stati del gioco
│       ├── GameState.ts           # Classe base per stati
│       ├── StartState.ts          # Schermata iniziale
│       └── PlayState.ts           # Gameplay principale
├── infrastructure/                # 🏗️ Framework infrastrutturale
│   ├── ecs/                       # Entity-Component-System
│   │   ├── Component.ts           # Classe base componenti
│   │   ├── ECS.ts                 # Motore ECS principale
│   │   ├── Entity.ts              # Classe base entità
│   │   └── System.ts              # Classe base sistemi
│   └── engine/                    # Game engine core
│       ├── Game.ts                # Orchestratore principale
│       ├── GameLoop.ts            # Loop di gioco con fixed timestep
│       ├── World.ts               # Contenitore ECS e sistemi
│       └── GameContext.ts         # Contesto globale condiviso
├── entities/                      # 🎯 Componenti ECS
│   ├── ai/                        # Intelligenza artificiale
│   │   ├── Destination.ts         # Target di movimento NPC
│   │   └── Npc.ts                 # Componente NPC con comportamenti
│   ├── combat/                    # Sistemi di combattimento
│   │   ├── Damage.ts              # Capacità di danno
│   │   ├── DamageText.ts          # Testi danno fluttuanti
│   │   ├── Health.ts              # Salute e sopravvivenza
│   │   ├── Projectile.ts          # Proiettili e armi
│   │   └── SelectedNpc.ts         # Stato selezione NPC
│   └── spatial/                   # Sistemi spaziali
│       ├── Camera.ts              # Gestione camera/viewport
│       ├── ParallaxLayer.ts       # Layer parallasse sfondo
│       ├── Transform.ts           # Posizione e trasformazioni
│       └── Velocity.ts            # Velocità e movimento
├── systems/                       # ⚙️ Sistemi di gioco
│   ├── game/                      # Inizializzazione gioco (FASE 1.3)
│   │   ├── GameInitializationSystem.ts  # Orchestratore (153 righe)
│   │   ├── SystemFactory.ts       # Creazione sistemi e asset
│   │   ├── SystemConfigurator.ts  # Configurazione interazioni
│   │   └── EntityFactory.ts       # Creazione entità iniziali
│   ├── ai/                        # Sistemi AI
│   │   ├── NpcBehaviorSystem.ts   # Comportamenti NPC
│   │   └── NpcSelectionSystem.ts  # Sistema selezione NPC
│   ├── combat/                    # Sistemi combattimento
│   │   ├── CombatSystem.ts        # Logica danno e collisioni
│   │   └── ProjectileSystem.ts    # Gestione proiettili
│   ├── input/                     # Sistemi input
│   │   ├── InputSystem.ts         # Input mouse/tastiera
│   │   └── PlayerControlSystem.ts # Controllo player
│   ├── physics/                   # Sistemi fisici
│   │   └── MovementSystem.ts      # Movimento e collisioni
│   └── rendering/                 # Sistemi rendering
│       ├── DamageTextSystem.ts    # Rendering testi danno
│       ├── ParallaxSystem.ts      # Rendering parallasse
│       └── RenderSystem.ts        # Rendering principale
├── ui/                            # 🖥️ User Interface
│   └── StartScreen.ts             # Schermata iniziale interattiva
└── utils/                         # 🛠️ Utility e configurazione
    ├── config/
    │   └── Config.ts              # Configurazioni globali
    └── rendering/                 # Future: utility rendering
```

### Server-Side (Node.js/CommonJS)

```
server/
├── core/                          # 🏗️ Core server infrastructure
│   ├── connection/                # WebSocket & Messaging (FASE 1.1)
│   │   ├── WebSocketConnectionManager.cjs  # Gestione connessioni (245 righe)
│   │   └── MessageRouter.cjs      # Routing messaggi (delegazione handler)
│   ├── database/                 # Database operations
│   │   └── PlayerDataManager.cjs  # Load/save player data
│   ├── auth/                      # Authentication
│   │   └── AuthenticationManager.cjs  # Security validation
│   └── messaging/                 # Messaging
│       └── MessageBroadcaster.cjs # Formattazione e broadcast
├── managers/                      # 🎮 Game managers
│   ├── projectile/                # Projectile system (FASE 1.2)
│   │   ├── ProjectileSpawner.cjs  # Creazione proiettili
│   │   ├── ProjectilePhysics.cjs  # Movimento e fisica
│   │   ├── ProjectileCollision.cjs # Rilevamento collisioni
│   │   ├── ProjectileHoming.cjs   # Logica homing avanzata
│   │   ├── ProjectileBroadcaster.cjs # Eventi di rete
│   │   └── ProjectileDamageHandler.cjs # Danno e ricompense
│   ├── projectile-manager.cjs     # Orchestratore (316 righe)
│   ├── npc/                       # NPC system (FASE 1.4)
│   │   ├── NpcSpawner.cjs         # Creazione e inizializzazione
│   │   ├── NpcRespawnSystem.cjs   # Gestione respawn
│   │   ├── NpcDamageHandler.cjs   # Danni NPC/player
│   │   ├── NpcRewardSystem.cjs    # Ricompense e notifiche
│   │   └── NpcBroadcaster.cjs     # Broadcasting spawn
│   └── npc-manager.cjs            # Orchestratore (154 righe)
└── core/
    ├── map/                       # Map system (FASE 1.5)
    │   ├── NpcMovementSystem.cjs  # Movimento e comportamenti NPC
    │   ├── MapBroadcaster.cjs     # Broadcasting messaggi
    │   └── PositionUpdateProcessor.cjs # Processamento queue posizioni
    └── map-server.cjs             # Orchestratore (111 righe)
└── ...
```

### 📋 Principi Architetturali

1. **🎯 Single Responsibility** - Ogni modulo ha una responsabilità precisa
2. **🔄 Dependency Inversion** - Dipendenze verso l'interno (UI → Game → Systems → Entities → Infrastructure → Utils)
3. **📦 Open/Closed** - Aperto all'estensione, chiuso alla modifica
4. **🔌 Plugin Architecture** - Sistemi indipendenti e sostituibili
5. **🎮 Game Loop Pulito** - Update → Render → Repeat con fixed timestep
6. **📚 Documentazione Granulare** - README per ogni cartella con esempi pratici

### 🔄 Refactoring Phase 1 (Completato)

**Obiettivo**: Modularizzazione e riduzione complessità dei file core.

#### FASE 1.1 - WebSocket & Messaging
- **WebSocketConnectionManager.cjs**: 245 righe (gestione connessioni)
- **MessageRouter.cjs**: Routing centralizzato con handler puri
- **Separazione**: Connection ≠ Routing ≠ Business Logic

#### FASE 1.2 - Projectile System
- **projectile-manager.cjs**: 316 righe (orchestratore)
- **Moduli specializzati**: Spawner, Physics, Collision, Homing, Broadcaster, DamageHandler
- **API invariata**: Nessun cambiamento di gameplay

#### FASE 1.3 - Game Initialization
- **GameInitializationSystem.ts**: 153 righe (orchestratore)
- **SystemFactory.ts**: Creazione sistemi e caricamento asset
- **SystemConfigurator.ts**: Configurazione interazioni tra sistemi
- **EntityFactory.ts**: Creazione entità iniziali (player, teleport)

#### FASE 1.4 - NPC Manager
- **npc-manager.cjs**: 154 righe (orchestratore)
- **Moduli specializzati**: Spawner, RespawnSystem, DamageHandler, RewardSystem, Broadcaster
- **API invariata**: Nessun cambiamento di gameplay

#### FASE 1.5 - Map Server
- **map-server.cjs**: 111 righe (orchestratore)
- **Moduli specializzati**: NpcMovementSystem, MapBroadcaster, PositionUpdateProcessor
- **API invariata**: Nessun cambiamento di gameplay

## 🎮 Come Giocare

### Controlli
- **Mouse sinistro**: Seleziona NPC nemici (clicca su un NPC per selezionarlo)
- **Mouse sinistro + trascina**: Muovi la nave player verso la posizione desiderata
- **Barra spaziatrice**: Spara automaticamente ai nemici selezionati
- **Tasto H**: Mostra/nascondi informazioni HUD (quando implementato)

### Obiettivo
- Sopravvivi combattendo gli NPC spaziali che si muovono autonomamente
- Gestisci la tua salute (barra verde) e munizioni
- Usa tattiche di selezione per combattere strategicamente più nemici
- Raccogli punti distruggendo NPC nemici

### Stati del Gioco
1. **StartState**: Schermata iniziale con input nickname
2. **PlayState**: Gameplay principale con combattimento spaziale

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

### 🧪 Testing e Qualità
```bash
# Build con type checking completo
npm run build

# Preview build locale
npm run preview

# Type checking standalone
npx tsc --noEmit
```

## 🔧 Estensioni e Modifiche

### Aggiungere un Nuovo Sistema ECS
```typescript
// 1. Crea il sistema in src/systems/
export class NewSystem extends BaseSystem {
  update(deltaTime: number): void {
    // Logica del sistema
  }

  render?(ctx: CanvasRenderingContext2D): void {
    // Rendering opzionale
  }
}

// 2. Registralo in PlayState
private initializeGame(): void {
  // ... altri sistemi ...
  this.ecs.addSystem(new NewSystem(this.ecs));
}
```

### Aggiungere un Nuovo Componente
```typescript
// 1. Crea il componente in src/entities/
export class NewComponent extends Component {
  public property: type = defaultValue;
}

// 2. Usalo nei sistemi
const entities = this.ecs.getEntitiesWithComponents(NewComponent);
// ... logica del componente
```

### Modificare la Configurazione
Tutte le configurazioni sono centralizzate in `src/utils/config/Config.ts`:
- Dimensioni canvas e mondo
- Parametri di gioco (FPS, timing)
- Colori e temi visuali
- Debug flags

### 🎮 Multiplayer Online
Gioca con amici da qualsiasi parte del mondo!

**Per l'host (tu):**
```bash
# Avvia il server locale
npm run server
```

**Per gli amici:**
Apri il link del gioco web: `https://starfield-3sdm.vercel.app`

**Caratteristiche:**
- ✅ Server WebSocket completo
- ✅ Client web accessibile da tutti
- ✅ Multiplayer in tempo reale
- ✅ NPC condivisi tra giocatori
- ✅ Combattimento sincronizzato

**Come giocare:**
1. Tu avvii il server con `npm run server`
2. Gli amici aprono il link Vercel e giocano insieme!

📖 **Guida completa:** `tools/README-online.md`

## 📊 Metriche e Qualità

- **TypeScript Strict Mode**: Abilitato per massima type safety
- **Architettura ECS**: Massima flessibilità e performance
- **Fixed Timestep**: Game loop stabile a 60 FPS
- **Modularità**: Ogni sistema è indipendente e testabile
- **Documentazione**: README per ogni cartella con esempi pratici

## 🔍 Debug e Sviluppo

### Console Logs
Il gioco fornisce logging dettagliato per:
- Inizializzazione sistemi
- Transizioni di stato
- Errori di caricamento
- Performance metrics

### Configurazione Debug
In `Config.ts` sono disponibili flag per:
- Debug mode generale
- Visualizzazione FPS
- Box collisioni
- Logging esteso

## 📝 Licenza

Questo progetto è distribuito sotto licenza MIT.

## 🤝 Contributi

Contributi benvenuti! L'architettura modulare facilita l'aggiunta di nuove funzionalità:

1. Segui la struttura esistente
2. Aggiungi documentazione per nuovi componenti
3. Mantieni la separazione delle responsabilità
4. Testa le modifiche thoroughly

---

*Realizzato con TypeScript, Canvas 2D e architettura ECS per un'esperienza di gioco moderna e scalabile!* 🚀✨
