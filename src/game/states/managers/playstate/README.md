# PlayState Managers

## 📋 Overview

Modular architecture for `PlayState.ts` (reduced from 646 to 215 lines). The managers handle distinct responsibilities using dependency injection to avoid circular dependencies.

## 🏗️ Architecture

```
PlayState (Orchestrator - 215 lines)
├── PlayStateInitializer
│   ├── enter() - Main initialization entry point
│   ├── initializeGame() - Game world setup
│   ├── initializeMultiplayerSystems() - Multiplayer setup
│   ├── waitForPlayerDataReady() - Wait for player data
│   ├── hideLoadingScreen() - Hide loading UI
│   ├── initializeNetworkSystem() - Network system setup
│   └── setupClientNetworkSystem() - Configure network
├── PlayStateLifecycleManager
│   ├── update() - Game loop update
│   ├── render() - Game rendering
│   ├── handleInput() - Input handling
│   └── exit() - Cleanup and exit
└── PlayStateResourceManager
    ├── updateNicknamePosition() - Player nickname updates
    ├── updateNpcNicknames() - NPC nickname management
    ├── updateRemotePlayerNicknames() - Remote player nicknames
    ├── updateRemotePlayerSpriteImage() - Sprite synchronization
    └── getPlayerRank() - Rank calculation
```

## 📦 Modules

### 1. **PlayStateInitializer** (~400 righe)
**Responsabilità**: Setup iniziale, caricamento risorse, inizializzazione sistemi

**Metodi principali**:
- `enter()` - Entry point principale per inizializzazione
- `initializeGame()` - Inizializza mondo di gioco e entità
- `initializeMultiplayerSystems()` - Setup sistemi multiplayer
- `waitForPlayerDataReady()` - Attende dati player (RecentHonor)
- `hideLoadingScreen()` - Nasconde schermata di loading
- `initializeNetworkSystem()` - Inizializza sistema di rete
- `setupClientNetworkSystem()` - Configura ClientNetworkSystem

**Dipendenze**:
- `GameContext`, `World`, `GameInitializationSystem`
- Getter/Setter per tutti i sistemi (UiSystem, ClientNetworkSystem, etc.)
- Callbacks per aggiornamento loading text

### 2. **PlayStateLifecycleManager** (~75 righe)
**Responsabilità**: Gestione lifecycle (update, render, exit)

**Metodi principali**:
- `update(deltaTime)` - Aggiornamento gameplay
- `render(ctx)` - Rendering gioco
- `handleInput(event)` - Gestione input
- `exit()` - Cleanup e uscita

**Dipendenze**:
- `World`
- Getter per `ClientNetworkSystem`, `UiSystem`, `playerEntity`
- Callbacks per aggiornamento nickname (delegati a ResourceManager)

### 3. **PlayStateResourceManager** (~230 righe)
**Responsabilità**: Gestione risorse, nickname, entità ECS

**Metodi principali**:
- `updateNicknamePosition()` - Aggiorna posizione nickname player
- `updateNpcNicknames()` - Gestisce nickname NPC
- `updateRemotePlayerNicknames()` - Gestisce nickname remote player
- `updateRemotePlayerSpriteImage()` - Sincronizza sprite remote player
- `getPlayerRank()` - Calcola rank corrente player

**Dipendenze**:
- `World`, `GameContext`, `GameInitializationSystem`
- Getter per `UiSystem`, `playerEntity`, `remotePlayerSystem`, `cameraSystem`, `movementSystem`, `economySystem`

## 🔗 Dependency Injection Pattern

All managers use dependency injection via getter/setter functions to avoid circular dependencies:

```typescript
// Example: PlayStateInitializer
constructor(
  private readonly context: GameContext,
  private readonly world: World,
  private readonly gameInitSystem: GameInitializationSystem,
  private readonly getUiSystem: () => UiSystem | null,
  private readonly setUiSystem: (uiSystem: UiSystem) => void,
  // ... more getters/setters
) {}
```

## ✅ Public API Maintained

All public methods of `PlayState` are maintained for backward compatibility:
- `enter(context)` - Delegated to `PlayStateInitializer.enter()`
- `update(deltaTime)` - Delegated to `PlayStateLifecycleManager.update()`
- `render(ctx)` - Delegated to `PlayStateLifecycleManager.render()`
- `exit()` - Delegated to `PlayStateLifecycleManager.exit()`
- `handleInput(event)` - Delegated to `PlayStateLifecycleManager.handleInput()`
- `markAsChanged()` - Maintained in `PlayState` (uses `ClientNetworkSystem.sendSaveRequest()`)
- `getWorld()` - Maintained in `PlayState`

## 🎯 Benefits

1. **Separation of Concerns**: Each manager has a single, clear responsibility
2. **Testability**: Managers can be tested independently
3. **Maintainability**: Easier to locate and modify specific functionality
4. **Type Safety**: Full TypeScript type checking maintained
5. **Backward Compatibility**: All public APIs preserved

## 📊 Metrics

- **Original file**: 646 righe
- **Refactored file**: 215 righe
- **Reduction**: 431 righe (67%)
- **Target achieved**: ✅ < 500 righe

## 🔄 Lazy Initialization

Managers are initialized lazily on first use to handle base class constructor call order:

```typescript
private initializeManagers(): void {
  if (this.managersInitialized) return;
  // Initialize managers...
  this.managersInitialized = true;
}
```

All public methods call `initializeManagers()` before delegating to managers.
