# Analisi Prossimi Step Refactoring

## 📊 File Grandi Identificati (> 500 righe)

### Priorità ALTA (> 800 righe)

1. **UpgradePanel.ts** - 1206 righe
   - **Tipo**: Presentation/UI Component
   - **Responsabilità**: Gestione pannello upgrade player, statistiche, tooltip
   - **Candidato per**: Estrazione in moduli (UpgradeStatsManager, UpgradeTooltipManager, UpgradeValidationManager)

2. **AuthScreen.ts** - 1080 righe
   - **Tipo**: Presentation/UI Component
   - **Responsabilità**: Autenticazione, login, registrazione, gestione sessioni
   - **Candidato per**: Estrazione in moduli (AuthFormManager, SessionManager, AuthStateManager)

3. **UiSystem.ts** - 872 righe
   - **Tipo**: System (ECS)
   - **Responsabilità**: Orchestrazione UI, coordinamento pannelli, HUD, chat
   - **Candidato per**: Estrazione in moduli (UIPanelManager, UIHUDManager, UIChatManager)

### Priorità MEDIA (500-800 righe)

4. **EconomySystem.ts** - 674 righe
   - **Tipo**: System (ECS)
   - **Responsabilità**: Gestione economia (credits, cosmos, experience, honor, skill points)
   - **Candidato per**: Estrazione in moduli (CurrencyManager, ProgressionManager, EconomyEventManager)

5. **PlayState.ts** - 646 righe
   - **Tipo**: Game State
   - **Responsabilità**: Stato di gioco principale, inizializzazione, lifecycle
   - **Candidato per**: Estrazione in moduli (PlayStateInitializer, PlayStateLifecycleManager)

6. **CombatSystem.ts** - 634 righe
   - **Tipo**: System (ECS)
   - **Responsabilità**: Logica combattimento, danni, proiettili
   - **Candidato per**: Estrazione in moduli (CombatDamageManager, CombatProjectileManager)

7. **PlayerControlSystem.ts** - 613 righe
   - **Tipo**: System (ECS)
   - **Responsabilità**: Controlli player, input, movimento
   - **Candidato per**: Estrazione in moduli (PlayerInputManager, PlayerMovementManager)

8. **ChatPanel.ts** - 577 righe
   - **Tipo**: Presentation/UI Component
   - **Responsabilità**: Pannello chat, messaggi, UI chat
   - **Candidato per**: Estrazione in moduli (ChatUIManager, ChatMessageRenderer)

9. **LeaderboardPanel.ts** - 558 righe
   - **Tipo**: Presentation/UI Component
   - **Responsabilità**: Pannello leaderboard, ranking, visualizzazione
   - **Candidato per**: Estrazione in moduli (LeaderboardDataManager, LeaderboardRenderer)

10. **QuestPanel.ts** - 539 righe
    - **Tipo**: Presentation/UI Component
    - **Responsabilità**: Pannello quest, gestione quest UI
    - **Candidato per**: Estrazione in moduli (QuestUIManager, QuestRenderer)

## 🎯 Raccomandazioni per Prossimi Step

### Opzione 1: Refactoring UI Components (Priorità ALTA)
**Target**: `UpgradePanel.ts`, `AuthScreen.ts`, `UiSystem.ts`

**Motivazione**:
- File molto grandi (> 800 righe)
- Responsabilità multiple chiare
- Impatto alto sulla manutenibilità UI
- Separazione logica UI da business logic

**Moduli proposti**:
- **UpgradePanel**: UpgradeStatsManager, UpgradeTooltipManager, UpgradeValidationManager
- **AuthScreen**: AuthFormManager, SessionManager, AuthStateManager
- **UiSystem**: UIPanelManager, UIHUDManager, UIChatManager

### Opzione 2: Refactoring Game Systems (Priorità MEDIA)
**Target**: `EconomySystem.ts`, `CombatSystem.ts`, `PlayerControlSystem.ts`

**Motivazione**:
- Sistemi core del gioco
- Logica complessa separabile
- Miglioramento testabilità

**Moduli proposti**:
- **EconomySystem**: CurrencyManager, ProgressionManager, EconomyEventManager
- **CombatSystem**: CombatDamageManager, CombatProjectileManager, CombatStateManager
- **PlayerControlSystem**: PlayerInputManager, PlayerMovementManager, PlayerActionManager

### Opzione 3: Refactoring Game State (Priorità MEDIA)
**Target**: `PlayState.ts`

**Motivazione**:
- Gestione lifecycle complessa
- Inizializzazione multi-step
- Separazione logica inizializzazione da gestione stato

**Moduli proposti**:
- **PlayState**: PlayStateInitializer, PlayStateLifecycleManager, PlayStateResourceManager

## 📋 Checklist Analisi

### UpgradePanel.ts (1206 righe)
- [ ] Identificare blocchi logici (statistiche, tooltip, validazione, rendering)
- [ ] Mappare dipendenze (ECS, PlayerSystem, ClientNetworkSystem)
- [ ] Identificare API pubblica da mantenere
- [ ] Proporre moduli con responsabilità singola

### AuthScreen.ts (1080 righe)
- [ ] Identificare blocchi logici (form login, form registrazione, gestione sessioni, UI state)
- [ ] Mappare dipendenze (GameContext, Supabase)
- [ ] Identificare API pubblica da mantenere
- [ ] Proporre moduli con responsabilità singola

### UiSystem.ts (872 righe)
- [ ] Identificare blocchi logici (orchestrazione pannelli, HUD, chat, nickname)
- [ ] Mappare dipendenze (UIManager, pannelli, sistemi)
- [ ] Identificare API pubblica da mantenere
- [ ] Proporre moduli con responsabilità singola

## 🔍 Analisi Dipendenze

### Dipendenze Circolari Potenziali
- Verificare se ci sono dipendenze circolari tra:
  - `UiSystem` ↔ `ClientNetworkSystem`
  - `EconomySystem` ↔ `UiSystem`
  - `PlayState` ↔ `UiSystem` ↔ `ClientNetworkSystem`

### TODO e Problemi Identificati
1. **NetworkEventSystem.ts**: `sendExplosionCreated()` - TODO: Move to higher level component
2. **NetworkConnectionManager.ts**: `clientId` hardcoded - TODO: Get from context
3. **NetworkPositionSyncManager.ts**: TODO: Consider disconnecting client after invalid messages
4. **RemoteEntityManager.ts**: TODO: Implement properly

## 📈 Metriche Target

### UpgradePanel.ts
- **Target**: < 500 righe
- **Moduli proposti**: 3-4 moduli
- **Riduzione stimata**: ~700 righe

### AuthScreen.ts
- **Target**: < 500 righe
- **Moduli proposti**: 3-4 moduli
- **Riduzione stimata**: ~580 righe

### UiSystem.ts
- **Target**: < 500 righe
- **Moduli proposti**: 3-4 moduli
- **Riduzione stimata**: ~372 righe

## 🎯 Prossimo Step Consigliato

**Raccomandazione**: Iniziare con **UpgradePanel.ts** (1206 righe)

**Motivi**:
1. File più grande del codebase
2. Responsabilità chiare e separabili
3. Impatto alto sulla manutenibilità
4. Pattern simile a ClientNetworkSystem (già refactorizzato)
5. Meno critico per gameplay (UI component)

**Piano Dettagliato**: 
📋 **Vedi**: `docs/refactor/UpgradePanel-Refactoring-Plan.md`

**Moduli Proposti**:
1. `UpgradeStatsManager` - Gestione rendering e aggiornamento statistiche
2. `UpgradeTooltipManager` - Gestione tooltip e popup
3. `UpgradeValidationManager` - Validazione upgrade e calcolo costi
4. `UpgradeRenderer` - Rendering UI componenti
5. `UpgradeInitializationManager` - Setup e lifecycle
6. `UpgradeActionManager` - Gestione azioni upgrade

**Target**: < 500 righe (riduzione ~706 righe, ~59%)
