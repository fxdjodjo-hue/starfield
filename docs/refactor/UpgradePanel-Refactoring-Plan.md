# Piano Refactoring UpgradePanel.ts

## 📊 Analisi File Originale

**File**: `src/presentation/ui/UpgradePanel.ts`  
**Righe totali**: 1206  
**Target**: < 500 righe  
**Riduzione necessaria**: ~706 righe (~59%)

## ⚠️ Punti Chiave e Best Practices

### 🔄 Verifica Dipendenze Incrociate
- **Usare Dependency Injection** invece di import diretti tra manager
- `UpgradeRenderer` riceve `calculateCost` come funzione
- `UpgradeActionManager` riceve metodi validazione come callback
- Solo `UpgradePanel` importa tutti i manager

### 🏷️ Deprecazione Controllata
- Segnare metodi deprecati con `@deprecated` nei commenti
- Mantenere per backward compatibility
- Rimuovere solo dopo test completo se non usati

### 🧪 Testing Incrementale
- **Dopo ogni fase**: Verificare che pannello si apra, statistiche funzionino, upgrade funzioni
- Riduce rischi di bug a fine refactor
- Test base: pannello si apre + upgrade funziona

### 📏 Controllo Righe
- Target moduli: < 300 righe ciascuno
- `UpgradeRenderer` stimato ~250 righe (vicino al limite)
- Se supera 300 righe, valutare split interno (solo se necessario)

### 📚 Documentazione Interna
- Creare `src/presentation/ui/managers/upgrade/README.md`
- Documentare dipendenze, pattern DI, metodi deprecati
- Utile per onboarding e futuri refactor

## 🎯 Moduli Proposti

### 1. **UpgradeStatsManager** (~200 righe)
**Responsabilità**: Gestione rendering e aggiornamento statistiche player

**Metodi da estrarre**:
- `updatePlayerStats()` (linee 723-823)
- `getInitialStatValue()` (linee 703-716)
- `updateUpgradeButtons()` (linee 1168-1252)
- `updatePlayerPhysicalStats()` (linee 917-953) - deprecato ma mantenere per compatibilità

**Dipendenze**:
- `ECS`, `PlayerSystem`, `Health`, `Shield`, `Damage`, `PlayerUpgrades`, `Credits`, `Cosmos`
- `getPlayerDefinition()`

### 2. **UpgradeTooltipManager** (~150 righe)
**Responsabilità**: Gestione tooltip e popup informativi

**Metodi da estrarre**:
- `showStatExplanation()` (linee 958-1071)
- `hideTooltip()` (linee 1076-1081)
- `showInsufficientResourcesPopup()` (linee 1257-1379)
- `hideInsufficientResourcesPopup()` (linee 1384-1390)
- `getStatDescription()` (linee 538-546)

**Dipendenze**:
- `container` (HTMLElement)
- Nessuna dipendenza esterna

### 3. **UpgradeValidationManager** (~100 righe)
**Responsabilità**: Validazione upgrade, calcolo costi, gestione stato upgrade

**Metodi da estrarre**:
- `calculateUpgradeCost()` (linee 275-302)
- `isUpgradeInProgress()` (linee 1114-1116)
- `setUpgradeInProgress()` (linee 1121-1126)
- `resetUpgradeProgress()` (linee 1131-1133)
- `rollbackUpgrade()` (linee 1138-1163)

**Dipendenze**:
- `PlayerSystem`, `ECS`, `PlayerUpgrades`
- `upgradeInProgress` state

### 4. **UpgradeRenderer** (~250 righe)
**Responsabilità**: Rendering UI componenti (card, sezioni, bottoni)

**Metodi da estrarre**:
- `createUpgradeSection()` (linee 307-360)
- `createUpgradeCard()` (linee 365-533)
- `createStatsSection()` (linee 182-270)
- `createStatUpgradeButton()` (linee 551-698) - deprecato ma mantenere per compatibilità

**Dipendenze**:
- `PlayerSystem`, `ECS`, `PlayerUpgrades`
- `calculateUpgradeCost()` (da UpgradeValidationManager)

### 5. **UpgradeInitializationManager** (~100 righe)
**Responsabilità**: Setup iniziale, gestione lifecycle, event listeners

**Metodi da estrarre**:
- `createPanelContent()` (linee 55-177) - delegare rendering a UpgradeRenderer
- `onShow()` (linee 828-837)
- `onHide()` (linee 861-866)
- `resetUpgradeCards()` (linee 842-856)
- `startRealtimeUpdates()` (linee 1090-1092)
- `stopRealtimeUpdates()` (linee 1097-1099)
- `updateECS()` (linee 1104-1109)

**Dipendenze**:
- `UpgradeRenderer`, `UpgradeStatsManager`
- `realtimeUpdateActive` state

### 6. **UpgradeActionManager** (~80 righe)
**Responsabilità**: Gestione azioni upgrade (richieste al server)

**Metodi da estrarre**:
- `upgradeStat()` (linee 872-912)

**Dipendenze**:
- `PlayerSystem`, `ECS`, `ClientNetworkSystem`
- `UpgradeValidationManager` (per isUpgradeInProgress, setUpgradeInProgress)

## 📋 Piano Step-by-Step

### Fase 1: Preparazione

**Obiettivo**: Setup ambiente e struttura moduli

**Azioni**:
1. ✅ Creare branch `refactor/upgrade-panel-modularization`
2. ✅ Creare cartella `src/presentation/ui/managers/upgrade/`
3. ✅ Creare skeleton dei moduli:
   - `UpgradeStatsManager.ts`
   - `UpgradeTooltipManager.ts`
   - `UpgradeValidationManager.ts`
   - `UpgradeRenderer.ts`
   - `UpgradeInitializationManager.ts`
   - `UpgradeActionManager.ts`

**Verifica**:
- [ ] Branch creato
- [ ] Cartella creata
- [ ] Skeleton moduli con classi base e costruttori

---

### Fase 2: Estrazione Statistiche & Rendering

**Obiettivo**: Estrarre logica rendering e aggiornamento statistiche

**Azioni**:
1. **UpgradeRenderer**:
   - Estrarre `createUpgradeSection()` → `UpgradeRenderer.createUpgradeSection()`
   - Estrarre `createUpgradeCard()` → `UpgradeRenderer.createUpgradeCard()`
   - Estrarre `createStatsSection()` → `UpgradeRenderer.createStatsSection()`
   - Aggiornare `createPanelContent()` per delegare a `UpgradeRenderer`

2. **UpgradeStatsManager**:
   - Estrarre `updatePlayerStats()` → `UpgradeStatsManager.updateStats()`
   - Estrarre `getInitialStatValue()` → `UpgradeStatsManager.getInitialValue()`
   - Estrarre `updateUpgradeButtons()` → `UpgradeStatsManager.updateButtons()`
   - Aggiornare `UpgradePanel.update()` per delegare a `UpgradeStatsManager`

**Test Incrementale** (dopo ogni fase):
- [ ] Pannello si apre correttamente
- [ ] Verifica rendering valori statistiche
- [ ] Verifica aggiornamento livelli upgrade
- [ ] Verifica aggiornamento costi
- [ ] Verifica stato bottoni (enabled/disabled)
- [ ] Upgrade funziona (richiesta al server)

**Nota**: Test incrementale riduce rischi di bug a fine refactor. Verificare funzionalità base dopo ogni fase.

---

### Fase 3: Estrazione Tooltip & Popup

**Obiettivo**: Estrarre gestione tooltip e popup

**Azioni**:
1. **UpgradeTooltipManager**:
   - Estrarre `showStatExplanation()` → `UpgradeTooltipManager.showExplanation()`
   - Estrarre `hideTooltip()` → `UpgradeTooltipManager.hide()`
   - Estrarre `showInsufficientResourcesPopup()` → `UpgradeTooltipManager.showInsufficientResources()`
   - Estrarre `hideInsufficientResourcesPopup()` → `UpgradeTooltipManager.hideInsufficientResources()`
   - Estrarre `getStatDescription()` → `UpgradeTooltipManager.getDescription()`
   - Aggiornare `UpgradePanel` per delegare a `UpgradeTooltipManager`

**Test Incrementale**:
- [ ] Pannello si apre correttamente
- [ ] Verifica tooltip su hover/click
- [ ] Verifica chiusura tooltip
- [ ] Verifica popup risorse insufficienti
- [ ] Verifica auto-hide tooltip/popup
- [ ] Upgrade funziona (richiesta al server)

---

### Fase 4: Estrazione Logica Upgrade

**Obiettivo**: Estrarre validazione e gestione stato upgrade

**Azioni**:
1. **UpgradeValidationManager**:
   - Estrarre `calculateUpgradeCost()` → `UpgradeValidationManager.calculateCost()`
   - Estrarre `isUpgradeInProgress()` → `UpgradeValidationManager.isInProgress()`
   - Estrarre `setUpgradeInProgress()` → `UpgradeValidationManager.setInProgress()`
   - Estrarre `resetUpgradeProgress()` → `UpgradeValidationManager.resetProgress()`
   - Estrarre `rollbackUpgrade()` → `UpgradeValidationManager.rollback()`
   - Aggiornare `UpgradeRenderer` per usare `UpgradeValidationManager.calculateCost()`

2. **UpgradeActionManager**:
   - Estrarre `upgradeStat()` → `UpgradeActionManager.requestUpgrade()`
   - Aggiornare `UpgradePanel` per delegare a `UpgradeActionManager`
   - `UpgradeActionManager` usa `UpgradeValidationManager` per validazione

**Test Incrementale**:
- [ ] Pannello si apre correttamente
- [ ] Verifica calcolo costi upgrade
- [ ] Verifica gestione stato "in progress"
- [ ] Verifica reset stato upgrade
- [ ] Verifica richiesta upgrade al server
- [ ] Verifica timeout sicurezza (5 secondi)
- [ ] Upgrade funziona end-to-end

---

### Fase 5: Estrazione Setup & Lifecycle

**Obiettivo**: Estrarre inizializzazione e gestione lifecycle

**Azioni**:
1. **UpgradeInitializationManager**:
   - Estrarre `onShow()` → `UpgradeInitializationManager.onShow()`
   - Estrarre `onHide()` → `UpgradeInitializationManager.onHide()`
   - Estrarre `resetUpgradeCards()` → `UpgradeInitializationManager.resetCards()`
   - Estrarre `startRealtimeUpdates()` → `UpgradeInitializationManager.startUpdates()`
   - Estrarre `stopRealtimeUpdates()` → `UpgradeInitializationManager.stopUpdates()`
   - Estrarre `updateECS()` → `UpgradeInitializationManager.update()`
   - Aggiornare `UpgradePanel` per delegare lifecycle a `UpgradeInitializationManager`

**Test Incrementale**:
- [ ] Pannello si apre correttamente
- [ ] Verifica reset cards al show
- [ ] Verifica aggiornamento statistiche al show
- [ ] Verifica stop updates al hide
- [ ] Verifica update ECS frame-by-frame
- [ ] Upgrade funziona end-to-end

---

### Fase 6: Verifica API Pubblica

**Obiettivo**: Assicurare backward compatibility

**Metodi pubblici da mantenere**:
- ✅ `update(data: PanelData)` - delegare a `UpgradeStatsManager`
- ✅ `setPlayerSystem(playerSystem: PlayerSystem)` - mantenere, aggiornare manager
- ✅ `setClientNetworkSystem(clientNetworkSystem: ClientNetworkSystem)` - mantenere, aggiornare manager
- ✅ `updatePlayerStats()` - delegare a `UpgradeStatsManager`
- ✅ `resetUpgradeProgress()` - delegare a `UpgradeValidationManager`
- ✅ `showInsufficientResourcesPopup(message: string)` - delegare a `UpgradeTooltipManager`
- ✅ `hideInsufficientResourcesPopup()` - delegare a `UpgradeTooltipManager`

**Verifica**:
- [ ] Tutti i metodi pubblici funzionano senza modifiche
- [ ] `UiSystem` non richiede modifiche
- [ ] `PlayerDataResponseHandler` non richiede modifiche
- [ ] `ErrorMessageHandler` non richiede modifiche

---

### Fase 7: Pulizia

**Obiettivo**: Ridurre righe, ottimizzare, rimuovere codice morto

**Azioni**:
1. Rimuovere commenti JSDoc eccessivi
2. Rimuovere blocchi vuoti (`else {}`)
3. **Deprecazione Controllata** - Segnare metodi deprecati con `@deprecated`:
   ```typescript
   /**
    * @deprecated Questo metodo non è più utilizzato. 
    * Mantenuto solo per backward compatibility.
    * Da rimuovere in versione futura.
    */
   private updatePlayerPhysicalStats(): void { ... }
   
   /**
    * @deprecated Metodo legacy, sostituito da createUpgradeCard().
    * Mantenuto solo per compatibilità.
    */
   private createStatUpgradeButton(...): HTMLElement { ... }
   ```
4. Verificare se metodi deprecati sono usati:
   - `createStatUpgradeButton()` - cercare riferimenti nel codebase
   - `updatePlayerPhysicalStats()` - cercare riferimenti nel codebase
   - Se non usati, rimuovere dopo Fase 8 (test completo)
5. Ottimizzare import
6. Consolidare logica duplicata
7. Verificare righe totali < 500

**Test**:
- [ ] File < 500 righe
- [ ] Nessun errore di compilazione
- [ ] Nessun warning TypeScript

---

### Fase 8: Test Completo

**Obiettivo**: Verifica completa funzionalità e regressione

**Test Unitari** (opzionale, se framework disponibile):
- [ ] `UpgradeStatsManager.updateStats()` aggiorna correttamente valori
- [ ] `UpgradeValidationManager.calculateCost()` calcola costi corretti
- [ ] `UpgradeTooltipManager.showExplanation()` mostra tooltip

**Test Integrazione**:
- [ ] Pannello si apre correttamente
- [ ] Statistiche visualizzate correttamente
- [ ] Upgrade funziona (richiesta al server)
- [ ] Tooltip funziona
- [ ] Popup risorse insufficienti funziona
- [ ] Reset cards al show funziona
- [ ] Update real-time funziona

**Test Regressione**:
- [ ] Tutte le funzionalità esistenti funzionano
- [ ] API pubbliche invariate
- [ ] Nessun breaking change per `UiSystem`
- [ ] Nessun breaking change per handler network

---

## 📐 Struttura Finale

```
src/presentation/ui/
├── UpgradePanel.ts (< 500 righe)
└── managers/
    └── upgrade/
        ├── UpgradeStatsManager.ts (~200 righe)
        ├── UpgradeTooltipManager.ts (~150 righe)
        ├── UpgradeValidationManager.ts (~100 righe)
        ├── UpgradeRenderer.ts (~250 righe)
        ├── UpgradeInitializationManager.ts (~100 righe)
        └── UpgradeActionManager.ts (~80 righe)
```

## 🔗 Dipendenze tra Moduli

```
UpgradePanel
├── UpgradeInitializationManager
│   ├── UpgradeRenderer
│   │   └── UpgradeValidationManager (via dependency injection)
│   └── UpgradeStatsManager
├── UpgradeActionManager
│   └── UpgradeValidationManager (via dependency injection)
└── UpgradeTooltipManager
```

### ⚠️ Verifica Dipendenze Incrociate

**Problema Potenziale**:
- `UpgradeRenderer` ha bisogno di `calculateUpgradeCost()` da `UpgradeValidationManager`
- `UpgradeActionManager` ha bisogno di `isUpgradeInProgress()` e `setUpgradeInProgress()` da `UpgradeValidationManager`

**Soluzione - Dependency Injection**:
```typescript
// ❌ EVITARE: Import diretto che crea dipendenza circolare
// UpgradeRenderer.ts
import { UpgradeValidationManager } from './UpgradeValidationManager';

// ✅ PREFERIRE: Dependency injection via costruttore
// UpgradeRenderer.ts
constructor(
  private ecs: ECS,
  private playerSystem: PlayerSystem | null,
  private calculateCost: (statType: string, currentLevel: number) => { credits: number, cosmos: number }
) {}

// UpgradePanel.ts - Inizializzazione
const validationManager = new UpgradeValidationManager(...);
const renderer = new UpgradeRenderer(
  this.ecs,
  this.playerSystem,
  (statType, level) => validationManager.calculateCost(statType, level)
);
```

**Checklist Dipendenze**:
- [ ] `UpgradeRenderer` riceve `calculateCost` come funzione, non importa `UpgradeValidationManager`
- [ ] `UpgradeActionManager` riceve metodi validazione come callback, non importa `UpgradeValidationManager`
- [ ] `UpgradePanel` è l'unico che importa tutti i manager
- [ ] Nessuna dipendenza circolare tra manager

## 📏 Controllo Righe Moduli

**Target**: Ogni modulo < 300 righe (se possibile)

**Moduli stimati**:
- `UpgradeRenderer` (~250 righe) - **⚠️ Vicino al limite**
- `UpgradeStatsManager` (~200 righe) - ✅ OK
- `UpgradeTooltipManager` (~150 righe) - ✅ OK
- Altri moduli < 100 righe - ✅ OK

**Se UpgradeRenderer supera 300 righe**:
- Considerare split interno:
  - `UpgradeCardRenderer` - solo `createUpgradeCard()`
  - `UpgradeSectionRenderer` - solo `createUpgradeSection()` e `createStatsSection()`
- **Solo se necessario** - evitare over-engineering

**Verifica dopo Fase 2**:
- [ ] Contare righe `UpgradeRenderer.ts`
- [ ] Se > 300 righe, valutare split interno
- [ ] Documentare decisione nel codice

---

## 📚 Documentazione Interna

**File da creare/aggiornare**:
- `src/presentation/ui/managers/upgrade/README.md` - Documentazione moduli

**Contenuto README.md**:
```markdown
# Upgrade Panel Managers

## Architettura Modulare

Questi moduli gestiscono la logica del pannello upgrade, separando responsabilità.

## Moduli

### UpgradeStatsManager
- **Responsabilità**: Aggiornamento e rendering statistiche player
- **Dipendenze**: ECS, PlayerSystem, componenti entità
- **Nessuna dipendenza da altri manager**

### UpgradeTooltipManager
- **Responsabilità**: Tooltip e popup informativi
- **Dipendenze**: Container HTMLElement
- **Nessuna dipendenza da altri manager**

### UpgradeValidationManager
- **Responsabilità**: Validazione upgrade, calcolo costi, gestione stato
- **Dipendenze**: ECS, PlayerSystem
- **Nessuna dipendenza da altri manager**

### UpgradeRenderer
- **Responsabilità**: Rendering UI componenti
- **Dipendenze**: ECS, PlayerSystem, `calculateCost` function (dependency injection)
- **Riceve `calculateCost` come parametro, non importa UpgradeValidationManager**

### UpgradeActionManager
- **Responsabilità**: Gestione azioni upgrade (richieste server)
- **Dipendenze**: ECS, PlayerSystem, ClientNetworkSystem, validation callbacks
- **Riceve metodi validazione come callback, non importa UpgradeValidationManager**

### UpgradeInitializationManager
- **Responsabilità**: Setup iniziale e lifecycle
- **Dipendenze**: UpgradeRenderer, UpgradeStatsManager
- **Orchestra rendering e aggiornamenti**

## Pattern Dependency Injection

Per evitare dipendenze circolari:
- `UpgradeRenderer` riceve `calculateCost` come funzione
- `UpgradeActionManager` riceve metodi validazione come callback
- Solo `UpgradePanel` importa tutti i manager

## Metodi Deprecati

- `updatePlayerPhysicalStats()` - @deprecated, non più utilizzato
- `createStatUpgradeButton()` - @deprecated, sostituito da `createUpgradeCard()`
```

**Checklist Documentazione**:
- [ ] README.md creato in `src/presentation/ui/managers/upgrade/`
- [ ] Dipendenze tra moduli documentate
- [ ] Pattern dependency injection spiegato
- [ ] Metodi deprecati elencati
- [ ] Esempi di utilizzo inclusi

---

## ✅ Checklist Finale

- [ ] Fase 1: Preparazione completata
- [ ] Fase 2: Estrazione Statistiche & Rendering completata
- [ ] Fase 3: Estrazione Tooltip & Popup completata
- [ ] Fase 4: Estrazione Logica Upgrade completata
- [ ] Fase 5: Estrazione Setup & Lifecycle completata
- [ ] Fase 6: Verifica API Pubblica completata
- [ ] Fase 7: Pulizia completata
- [ ] Fase 8: Test Completo completato
- [ ] File < 500 righe
- [ ] Nessun breaking change
- [ ] **Dipendenze incrociate verificate** (dependency injection)
- [ ] **Metodi deprecati segnati con @deprecated**
- [ ] **Test incrementale eseguito dopo ogni fase**
- [ ] **Controllo righe moduli** (UpgradeRenderer < 300 se possibile)
- [ ] **Documentazione interna aggiornata** (README.md)
