# Upgrade Panel Managers

## Architettura Modulare

Questi moduli gestiscono la logica del pannello upgrade, separando responsabilità per migliorare manutenibilità e testabilità.

## Moduli

### UpgradeStatsManager
- **Responsabilità**: Aggiornamento e rendering statistiche player
- **Dipendenze**: ECS, PlayerSystem, componenti entità (Health, Shield, Damage, PlayerUpgrades, Credits, Cosmos)
- **Nessuna dipendenza da altri manager**
- **Metodi principali**: `updateStats()`, `getInitialStatValue()`, `updateButtons()`

### UpgradeTooltipManager
- **Responsabilità**: Tooltip e popup informativi
- **Dipendenze**: Container HTMLElement
- **Nessuna dipendenza da altri manager**
- **Metodi principali**: `showStatExplanation()`, `hideTooltip()`, `showInsufficientResourcesPopup()`, `hideInsufficientResourcesPopup()`, `getStatDescription()`

### UpgradeValidationManager
- **Responsabilità**: Validazione upgrade, calcolo costi, gestione stato
- **Dipendenze**: ECS, PlayerSystem
- **Nessuna dipendenza da altri manager**
- **Metodi principali**: `calculateUpgradeCost()`, `isUpgradeInProgress()`, `setUpgradeInProgress()`, `resetUpgradeProgress()`, `rollbackUpgrade()`

### UpgradeRenderer
- **Responsabilità**: Rendering UI componenti
- **Dipendenze**: ECS, PlayerSystem, `calculateCost` function (dependency injection), `getInitialStatValue` function, `getStatDescription` function, `onUpgradeClick` callback, `onShowExplanation` callback
- **Riceve funzioni come parametri, non importa altri manager** (evita dipendenze circolari)
- **Metodi principali**: `createUpgradeSection()`, `createUpgradeCard()`, `createStatsSection()`, `createStatUpgradeButton()` [deprecated]

### UpgradeActionManager
- **Responsabilità**: Gestione azioni upgrade (richieste server)
- **Dipendenze**: ECS, PlayerSystem, ClientNetworkSystem, validation callbacks (dependency injection)
- **Riceve metodi validazione come callback, non importa UpgradeValidationManager** (evita dipendenze circolari)
- **Metodi principali**: `requestUpgrade()`

### UpgradeInitializationManager
- **Responsabilità**: Setup iniziale e lifecycle
- **Dipendenze**: UpgradeRenderer, UpgradeStatsManager
- **Orchestra rendering e aggiornamenti**
- **Metodi principali**: `createPanelContent()`, `onShow()`, `onHide()`, `resetCards()`, `startUpdates()`, `stopUpdates()`, `update()`

## Pattern Dependency Injection

Per evitare dipendenze circolari:
- `UpgradeRenderer` riceve `calculateCost`, `getInitialStatValue`, `getStatDescription`, `onUpgradeClick`, `onShowExplanation` come funzioni/callback
- `UpgradeActionManager` riceve `isUpgradeInProgress` e `setUpgradeInProgress` come callback
- `UpgradeStatsManager` riceve `calculateCost` come funzione
- Solo `UpgradePanel` importa tutti i manager e coordina le dipendenze

## Metodi Deprecati

- `UpgradeStatsManager.updatePlayerPhysicalStats()` - @deprecated, non più utilizzato. Mantenuto solo per backward compatibility.
- `UpgradeRenderer.createStatUpgradeButton()` - @deprecated, sostituito da `createUpgradeCard()`. Mantenuto solo per compatibilità.

## Struttura Dipendenze

```
UpgradePanel
├── UpgradeValidationManager (indipendente)
├── UpgradeTooltipManager (indipendente)
├── UpgradeStatsManager (usa calculateCost via DI)
├── UpgradeRenderer (usa funzioni via DI)
├── UpgradeActionManager (usa callbacks via DI)
└── UpgradeInitializationManager (orchestra renderer e stats)
```

## Note

- Tutti i manager sono testabili in isolamento
- Le dipendenze tra manager sono gestite via dependency injection
- Nessuna dipendenza circolare tra manager
- `UpgradePanel` agisce come orchestratore e mantiene le API pubbliche
