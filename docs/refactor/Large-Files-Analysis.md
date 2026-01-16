# Analisi File Grandi Rimanenti

## 📊 File > 500 righe (dopo refactoring UpgradePanel, AuthScreen, UiSystem)

### ✅ Già Refactorizzati
1. ~~**UpgradePanel.ts**~~ - 1206 → 190 righe ✅
2. ~~**AuthScreen.ts**~~ - 1080 → 154 righe ✅
3. ~~**UiSystem.ts**~~ - 872 → 278 righe ✅

### 🔴 File Grandi Rimanenti

#### Priorità ALTA (600-700 righe)

1. **EconomySystem.ts** - 674 righe
   - **Tipo**: System (ECS)
   - **Responsabilità**: Gestione economia (credits, cosmos, experience, honor, skill points)
   - **Candidato per**: Estrazione in moduli
   - **Moduli proposti**: 
     - `CurrencyManager` (credits, cosmos)
     - `ProgressionManager` (experience, leveling)
     - `HonorManager` (honor, rank)
     - `SkillPointsManager` (skill points)
     - `EconomyEventManager` (callbacks, events)

2. **PlayState.ts** - 646 righe
   - **Tipo**: Game State
   - **Responsabilità**: Stato di gioco principale, inizializzazione, lifecycle
   - **Candidato per**: Estrazione in moduli
   - **Moduli proposti**:
     - `PlayStateInitializer` (inizializzazione sistemi)
     - `PlayStateLifecycleManager` (enter, exit, update)
     - `PlayStateResourceManager` (gestione risorse, cleanup)

3. **CombatSystem.ts** - 634 righe
   - **Tipo**: System (ECS)
   - **Responsabilità**: Logica combattimento, danni, proiettili
   - **Candidato per**: Estrazione in moduli
   - **Moduli proposti**:
     - `CombatDamageManager` (calcolo danni)
     - `CombatProjectileManager` (gestione proiettili)
     - `CombatStateManager` (stati combattimento)

#### Priorità MEDIA (500-600 righe)

4. **PlayerControlSystem.ts** - 613 righe
   - **Tipo**: System (ECS)
   - **Responsabilità**: Controlli player, input, movimento
   - **Candidato per**: Estrazione in moduli
   - **Moduli proposti**:
     - `PlayerInputManager` (gestione input)
     - `PlayerMovementManager` (movimento)
     - `PlayerActionManager` (azioni speciali)

5. **ChatPanel.ts** - 577 righe
   - **Tipo**: Presentation/UI Component
   - **Responsabilità**: Pannello chat, messaggi, UI chat
   - **Candidato per**: Estrazione in moduli
   - **Moduli proposti**:
     - `ChatUIManager` (rendering UI)
     - `ChatMessageRenderer` (rendering messaggi)
     - `ChatInputManager` (gestione input)

6. **LeaderboardPanel.ts** - 558 righe
   - **Tipo**: Presentation/UI Component
   - **Responsabilità**: Pannello leaderboard, ranking, visualizzazione
   - **Candidato per**: Estrazione in moduli
   - **Moduli proposti**:
     - `LeaderboardDataManager` (gestione dati)
     - `LeaderboardRenderer` (rendering UI)
     - `LeaderboardSortManager` (ordinamento)

7. **QuestPanel.ts** - 539 righe
   - **Tipo**: Presentation/UI Component
   - **Responsabilità**: Pannello quest, gestione quest UI
   - **Candidato per**: Estrazione in moduli
   - **Moduli proposti**:
     - `QuestUIManager` (gestione UI)
     - `QuestRenderer` (rendering quest)
     - `QuestProgressManager` (progresso quest)

8. **MinimapSystem.ts** - 532 righe
   - **Tipo**: System (ECS)
   - **Responsabilità**: Minimap, rendering mappa
   - **Candidato per**: Estrazione in moduli
   - **Moduli proposti**:
     - `MinimapRenderer` (rendering)
     - `MinimapDataManager` (gestione dati)

9. **UIManager.ts** - 523 righe
   - **Tipo**: Presentation/UI Manager
   - **Responsabilità**: Gestione pannelli UI base
   - **Candidato per**: Estrazione in moduli
   - **Moduli proposti**:
     - `PanelRegistry` (registrazione pannelli)
     - `PanelLayeringManager` (z-index, layering)

10. **NetworkConfig.ts** - 505 righe
    - **Tipo**: Config
    - **Responsabilità**: Configurazione network
    - **Nota**: File di configurazione, potrebbe essere accettabile così

## 🎯 Raccomandazioni

### Prossimi Target (in ordine di priorità)

1. **EconomySystem.ts** (674 righe) - Sistema core, logica complessa
2. **PlayState.ts** (646 righe) - Lifecycle complesso, inizializzazione multi-step
3. **CombatSystem.ts** (634 righe) - Sistema core, logica combattimento
4. **PlayerControlSystem.ts** (613 righe) - Sistema input/movimento
5. **ChatPanel.ts** (577 righe) - UI component, simile a UpgradePanel
6. **LeaderboardPanel.ts** (558 righe) - UI component
7. **QuestPanel.ts** (539 righe) - UI component
8. **MinimapSystem.ts** (532 righe) - Sistema rendering
9. **UIManager.ts** (523 righe) - Manager base UI

### Strategia

**Opzione A: Continuare con UI Components**
- ChatPanel, LeaderboardPanel, QuestPanel
- Pattern simile a UpgradePanel (già fatto)
- Impatto rapido sulla manutenibilità UI

**Opzione B: Refactoring Game Systems**
- EconomySystem, CombatSystem, PlayerControlSystem
- Sistemi core del gioco
- Maggiore complessità ma alto impatto

**Opzione C: Refactoring Game State**
- PlayState
- Lifecycle complesso
- Separazione inizializzazione da gestione stato

## 📈 Statistiche

- **File > 500 righe rimanenti**: 10 file
- **File già refactorizzati**: 3 file
- **Riduzione totale finora**: ~2000 righe
- **Target rimanente**: ~6000 righe da modularizzare
