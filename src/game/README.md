# 🎮 Game Orchestration Layer

**Orchestrazione di alto livello del gioco Starfield - gestione stati e flusso**

Il layer game gestisce il flusso applicativo di Starfield, orchestrando stati di gioco e fornendo l'entry point dell'esperienza utente.

## 📋 Struttura Orchestrazione

### 🎭 **states/** - State Machine del Gioco
Implementazione degli stati di gioco con transizioni ordinate.

**Stati inclusi:**
- `GameState.ts` - Classe base astratta per tutti gli stati
- `StartState.ts` - Schermata iniziale e configurazione
- `PlayState.ts` - Gameplay attivo con mondo di gioco

**Responsabilità:** Gestire fasi distinte dell'esperienza di gioco.

### ⚙️ **core/** - Entry Point e Setup
Punto di ingresso principale e configurazione iniziale.

**File:**
- `main.ts` - Bootstrap applicazione e DOM setup

**Responsabilità:** Avvio pulito e configurazione dell'ambiente di gioco.

## 🎯 State Management Pattern

### State Machine Flow
```
Application Start
       ↓
   main.ts
       ↓
Game Instance ← StartState (default)
       ↓
User Action → PlayState (gameplay)
       ↓
Game Over → Back to StartState
```

### State Interface Contract
```typescript
abstract class GameState {
  abstract enter(context: GameContext): Promise<void>;
  abstract exit(): void;
  abstract update(deltaTime: number): void;
  abstract render(ctx: CanvasRenderingContext2D): void;
  handleInput?(event: Event): void; // Optional
}
```

## 🔄 Lifecycle degli Stati

### StartState - Introduzione
```typescript
class StartState extends GameState {
  async enter(context) {
    // Mostra UI iniziale
    // Carica risorse base
    // Setup event listeners
  }

  render(ctx) {
    // Disegna schermata titolo
    // Menu opzioni
    // Effetti background
  }

  handleInput(event) {
    // Click "Play" → transizione a PlayState
    if (event.type === 'click') {
      context.transitionTo(new PlayState());
    }
  }
}
```

### PlayState - Gameplay Core
```typescript
class PlayState extends GameState {
  async enter(context) {
    // Inizializza ECS world
    // Crea player entity
    // Setup sistemi di gioco
    // Genera NPC
  }

  update(deltaTime) {
    // Update ECS systems
    // Logica di gioco
    // AI e fisica
  }

  render(ctx) {
    // Render mondo di gioco
    // UI HUD
    // Effetti particellari
  }
}
```

## 🎮 Game Loop Integration

### Main Entry Point
```typescript
// main.ts
async function main() {
  // DOM setup
  const canvas = document.getElementById('game-canvas');

  // Game initialization
  const game = new Game(canvas);
  await game.init();

  // Start game loop
  game.start();
}
```

### State Transitions
```typescript
// In Game.ts
private async changeState(newState: GameState) {
  // Cleanup stato corrente
  if (this.currentState) {
    this.currentState.exit();
  }

  // Setup nuovo stato
  this.currentState = newState;
  await this.currentState.enter(this.context);
}
```

## 📊 Architettura Applicativa

### Clean Separation
```
User Interface (Browser)
       ↓
   Game Orchestration ← State management
       ↓
   ECS World ← Entity systems
       ↓
   Canvas Rendering ← Visual output
```

### Context Sharing
```typescript
interface GameContext {
  canvas: HTMLCanvasElement;
  playerNickname: string;
  currentScore: number;
  // Shared state across states
}
```

## 🎯 Design Patterns Utilizzati

### State Pattern
- **GameState**: Interfaccia comune per comportamenti di stato
- **Concrete States**: Implementazioni specifiche per fasi di gioco
- **Context**: Game instance mantiene stato corrente

### Template Method
```typescript
// GameState definisce skeleton method
abstract class GameState {
  async run() {
    await this.enter();
    while (this.isActive()) {
      this.update(this.getDeltaTime());
      this.render(this.getContext());
    }
    this.exit();
  }
}
```

### Observer Pattern (Optional Input)
```typescript
// Input handling come observer
gameState.onInput((event) => {
  // Handle input in state-specific way
});
```

## 🚀 Estensioni Future

### Nuovi Stati Possibili
- `PauseState` - Menu pausa con opzioni
- `LoadingState` - Schermata caricamento livelli
- `GameOverState` - Risultati e restart
- `SettingsState` - Configurazioni di gioco

### Advanced State Features
- **State Stack**: Stati sovrapposti (pause menu sopra gameplay)
- **State Parameters**: Passaggio dati tra stati
- **Async Transitions**: Caricamento risorse durante transizioni

Questa orchestrazione garantisce **flusso applicativo pulito** e **esperienza utente coerente**, mantenendo la **separazione tra presentazione e logica di gioco**.
