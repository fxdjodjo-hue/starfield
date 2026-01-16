# UI System Managers

## Architettura Modulare

Questi moduli gestiscono la logica del sistema UI, separando responsabilità per migliorare manutenibilità e testabilità.

## Moduli

### UIPanelManager
- **Responsabilità**: Gestione pannelli UI (apertura, chiusura, layering, aggiornamenti)
- **Dipendenze**: `UIManager`, `LeaderboardPanel`, `QuestPanel`, `UpgradePanel`, `PanelConfig`, `QuestSystem`
- **Metodi principali**: `initializePanels()`, `setupQuestPanelIntegration()`, `updatePanels()`, `updateRealtimePanels()`, `setPlayerSystem()`, `setClientNetworkSystem()`, `resetAllUpgradeProgress()`, `getUpgradePanel()`, `getUIManager()`

### UIHUDManager
- **Responsabilità**: Aggiornamento HUD e statistiche player
- **Dipendenze**: `PlayerHUD`, `EconomySystem` (via callback)
- **Metodi principali**: `setEconomySystem()`, `setPlayerId()`, `setContext()`, `showPlayerInfo()`, `updatePlayerData()`, `hidePlayerInfo()`, `showExpandedHud()`, `hideExpandedHud()`, `toggleHud()`, `setupHudToggle()`, `getPlayerHUD()`

### UIChatManager
- **Responsabilità**: Gestione chat UI, input, rendering messaggi
- **Dipendenze**: `ChatPanel`, `ChatManager`, `ClientNetworkSystem` (via DI)
- **Metodi principali**: `initialize()`, `show()`, `setClientNetworkSystem()`, `setPlayerSystem()`, `addSystemMessage()`, `setMultiplayerMode()`, `onMessageSent()`, `receiveMessage()`, `simulateMessage()`, `getStatus()`, `getChatManager()`, `destroy()`

### UINicknameManager
- **Responsabilità**: Rendering nickname sopra player, NPC, remote players
- **Dipendenze**: Nessuna (gestisce solo DOM)
- **Metodi principali**: 
  - Player: `createPlayerNicknameElement()`, `updatePlayerNicknameContent()`, `updatePlayerNicknamePosition()`, `removePlayerNicknameElement()`
  - NPC: `ensureNpcNicknameElement()`, `updateNpcNicknameContent()`, `updateNpcNicknamePosition()`, `removeNpcNicknameElement()`, `removeAllNpcNicknameElements()`, `getNpcNicknameEntityIds()`
  - Remote Player: `ensureRemotePlayerNicknameElement()`, `updateRemotePlayerNicknamePosition()`, `removeRemotePlayerNicknameElement()`, `removeAllRemotePlayerNicknameElements()`, `getRemotePlayerNicknameClientIds()`

### UIAudioManager
- **Responsabilità**: Gestione suoni click UI e audio feedback
- **Dipendenze**: `AudioSystem` (via DI)
- **Metodi principali**: `setAudioSystem()`, `destroy()`

## Pattern Dependency Injection

Per evitare dipendenze circolari:
- `UIHUDManager` riceve `updatePlayerDataCallback` come funzione
- `UIPanelManager` riceve `updatePanelsCallback` come funzione
- `UIChatManager` riceve `ClientNetworkSystem` e `PlayerSystem` via DI
- Solo `UiSystem` importa tutti i manager e coordina le dipendenze

## Struttura Dipendenze

```
UiSystem
├── UIPanelManager
│   └── UIManager, PanelConfig, QuestSystem
├── UIHUDManager
│   └── PlayerHUD, EconomySystem (via callback)
├── UIChatManager
│   └── ChatPanel, ChatManager, ClientNetworkSystem (via DI)
├── UINicknameManager (indipendente)
└── UIAudioManager
    └── AudioSystem (via DI)
```

## Flusso Operativo

1. **Inizializzazione**: `UiSystem.initialize()` → `UIPanelManager.initializePanels()` + `UIChatManager.initialize()`
2. **Aggiornamento HUD**: `UiSystem.updatePlayerData()` → `UIHUDManager.updatePlayerData()` → `PlayerHUD.updateData()`
3. **Gestione Pannelli**: `UiSystem.updatePanels()` → `UIPanelManager.updatePanels()`
4. **Chat**: `UiSystem.receiveChatMessage()` → `UIChatManager.receiveMessage()` → `ChatManager.receiveNetworkMessage()`
5. **Nickname**: `UiSystem.updatePlayerNicknamePosition()` → `UINicknameManager.updatePlayerNicknamePosition()`

## Esempi di Utilizzo

### UiSystem (Orchestratore)
```typescript
const uiSystem = new UiSystem(ecs, questSystem, context);
uiSystem.initialize();
uiSystem.setPlayerSystem(playerSystem);
uiSystem.setClientNetworkSystem(clientNetworkSystem);
uiSystem.showPlayerInfo();
uiSystem.updatePlayerData({ inventory: {...} });
```

### Manager Individuali (per testing)
```typescript
// Test isolato di UINicknameManager
const nicknameManager = new UINicknameManager();
nicknameManager.createPlayerNicknameElement('Player1\n[Commander]');
nicknameManager.updatePlayerNicknamePosition(100, 200, camera, canvasSize);

// Test isolato di UIHUDManager
const hudManager = new UIHUDManager(new PlayerHUD());
hudManager.setContext(context);
hudManager.showPlayerInfo();
```

## Note

- Tutti i manager sono testabili in isolamento
- Le dipendenze tra manager sono gestite via dependency injection
- Nessuna dipendenza circolare tra manager
- `UiSystem` agisce come orchestratore e mantiene le API pubbliche
- L'inizializzazione è lazy per gestire dipendenze che arrivano dopo il costruttore

## Changelog

- **v2.0** (Refactoring): Modularizzazione completa, riduzione da 872 a 278 righe
- **v1.0**: Implementazione monolitica originale
