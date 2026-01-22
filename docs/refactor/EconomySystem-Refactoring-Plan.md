# Piano Refactoring EconomySystem.ts

## 📊 Analisi File Originale

**File**: `src/systems/economy/EconomySystem.ts`  
**Righe totali**: 674  
**Target**: < 500 righe  
**Riduzione necessaria**: ~174 righe (~26%)

## 🎯 Moduli Proposti e Responsabilità

### 1. **CurrencyManager** (~180 righe)
**Responsabilità**: Gestione Credits e Cosmos (valute base)

**Metodi da estrarre**:
- `addCredits(amount, reason)` (linee 466-479)
- `removeCredits(amount, reason)` (linee 484-496)
- `canAffordCredits(cost)` (linee 501-504)
- `setCredits(amount, reason)` (linee 509-529)
- `addCosmos(amount, reason)` (linee 536-549)
- `removeCosmos(amount, reason)` (linee 554-566)
- `canAffordCosmos(cost)` (linee 571-574)
- `setCosmos(amount, reason)` (linee 579-596)
- `getPlayerCredits()` (linee 441-444)
- `getPlayerCosmos()` (linee 446-449)

**Dipendenze**:
- `ECS`, `playerEntity`
- `Credits`, `Cosmos` entities
- Callbacks: `onCreditsChanged`, `onCosmosChanged` (via DI)

### 2. **ProgressionManager** (~120 righe)
**Responsabilità**: Gestione Experience e Level

**Metodi da estrarre**:
- `addExperience(amount, reason)` (linee 603-616)
- `getPlayerLevel()` (linee 621-624)
- `setExperience(totalExp, reason)` (linee 629-656)
- `getPlayerExperience()` (linee 451-454)

**Dipendenze**:
- `ECS`, `playerEntity`
- `Experience` entity
- Callback: `onExperienceChanged` (via DI)

### 3. **HonorManager** (~150 righe)
**Responsabilità**: Gestione Honor, Rank e Skill Points

**Metodi da estrarre**:
- `setPlayerAdministrator(isAdmin)` (linee 664-669)
- `addHonor(amount, reason)` (linee 674-688)
- `addLocalHonor(amount, reason)` (linee 693-698)
- `removeLocalHonor(amount, reason)` (linee 766-771)
- `setHonor(amount, reason)` (linee 703-721)
- `addSkillPoints(amount, reason)` (linee 727-742)
- `setSkillPoints(amount, reason)` (linee 748-761)
- `setRecentHonor(recentHonor)` (linee 44-56)
- `getPlayerHonor()` (linee 456-459)

**Dipendenze**:
- `ECS`, `playerEntity`
- `Honor`, `SkillPoints` entities
- `rankSystem` (via DI)
- Callbacks: `onHonorChanged`, `onSkillPointsChanged` (via DI)

### 4. **EconomyEventManager** (~80 righe)
**Responsabilità**: Gestione callbacks e eventi economici

**Metodi da estrarre**:
- `setCreditsChangedCallback(callback)` (linee 61-63)
- `setCosmosChangedCallback(callback)` (linee 65-67)
- `setExperienceChangedCallback(callback)` (linee 69-71)
- `setHonorChangedCallback(callback)` (linee 73-75)
- Gestione interna dei callbacks

**Dipendenze**:
- Nessuna dipendenza diretta (solo callbacks)

### 5. **EconomyUIDisplayManager** (~100 righe) - **DEPRECATO**
**Responsabilità**: Gestione UI displays deprecati (mantenuti per backward compatibility)

**Metodi da estrarre** (tutti deprecati):
- `createEconomyDisplays()` (linee 80-82)
- `createCreditsDisplay()` (linee 88-121)
- `createCosmosDisplay()` (linee 126-159)
- `createExperienceDisplay()` (linee 164-230)
- `createHonorDisplay()` (linee 235-268)
- `removeEconomyDisplays()` (linee 273-278)
- `removeCreditsDisplay()` (linee 280-285)
- `removeCosmosDisplay()` (linee 287-292)
- `removeExperienceDisplay()` (linee 294-299)
- `removeHonorDisplay()` (linee 301-306)
- `showEconomyDisplays()` (linee 311-313)
- `showCreditsDisplay()` (linee 315-320)
- `showCosmosDisplay()` (linee 322-327)
- `showExperienceDisplay()` (linee 329-334)
- `showHonorDisplay()` (linee 336-341)
- `hideEconomyDisplays()` (linee 346-351)
- `hideCreditsDisplay()` (linee 353-357)
- `hideCosmosDisplay()` (linee 359-363)
- `hideExperienceDisplay()` (linee 365-369)
- `hideHonorDisplay()` (linee 371-375)
- `updateEconomyDisplays()` (linee 380-382)
- `updateCreditsDisplay()` (linee 384-394)
- `updateCosmosDisplay()` (linee 396-406)
- `updateExperienceDisplay()` (linee 408-423)
- `updateHonorDisplay()` (linee 425-436)

**Dipendenze**:
- Nessuna (metodi vuoti o deprecati)

### 6. **EconomyStatusManager** (~50 righe)
**Responsabilità**: Metodi di utilità per ottenere stato economico completo

**Metodi da estrarre**:
- `getPlayerEconomyStatus()` (linee 780-807)

**Dipendenze**:
- `CurrencyManager`, `ProgressionManager`, `HonorManager` (via DI)
- `rankSystem` (via DI)

## 🔗 Dipendenze tra Moduli

```
EconomySystem (Orchestrator)
├── CurrencyManager
│   ├── ECS, playerEntity
│   └── Callbacks (via DI)
├── ProgressionManager
│   ├── ECS, playerEntity
│   └── Callbacks (via DI)
├── HonorManager
│   ├── ECS, playerEntity
│   ├── rankSystem (via DI)
│   └── Callbacks (via DI)
├── EconomyEventManager
│   └── Nessuna dipendenza
├── EconomyUIDisplayManager (DEPRECATO)
│   └── Nessuna dipendenza
└── EconomyStatusManager
    ├── CurrencyManager (via DI)
    ├── ProgressionManager (via DI)
    ├── HonorManager (via DI)
    └── rankSystem (via DI)
```

## 📋 Step-by-Step Plan

### Fase 1: Preparazione
- [ ] Creare branch `refactor/economy-system-modularization`
- [ ] Creare cartella `src/systems/economy/managers/`
- [ ] Creare skeleton dei moduli sopra elencati

### Fase 2: Estrazione Currency Management
- [ ] Creare `CurrencyManager.ts`
- [ ] Estrarre metodi Credits e Cosmos
- [ ] Implementare dependency injection per callbacks
- [ ] Aggiornare `EconomySystem.ts` per delegare
- [ ] **Test**: Verificare add/remove/set Credits e Cosmos

### Fase 3: Estrazione Progression Management
- [ ] Creare `ProgressionManager.ts`
- [ ] Estrarre metodi Experience e Level
- [ ] Implementare dependency injection per callbacks
- [ ] Aggiornare `EconomySystem.ts` per delegare
- [ ] **Test**: Verificare add/set Experience e leveling

### Fase 4: Estrazione Honor Management
- [ ] Creare `HonorManager.ts`
- [ ] Estrarre metodi Honor e Skill Points
- [ ] Implementare dependency injection per rankSystem e callbacks
- [ ] Aggiornare `EconomySystem.ts` per delegare
- [ ] **Test**: Verificare add/set Honor, rank calculation

### Fase 5: Estrazione Event Management
- [ ] Creare `EconomyEventManager.ts`
- [ ] Estrarre gestione callbacks
- [ ] Aggiornare `EconomySystem.ts` per delegare
- [ ] **Test**: Verificare callbacks funzionanti

### Fase 6: Estrazione Status Manager
- [ ] Creare `EconomyStatusManager.ts`
- [ ] Estrarre `getPlayerEconomyStatus()`
- [ ] Implementare dependency injection per altri manager
- [ ] Aggiornare `EconomySystem.ts` per delegare
- [ ] **Test**: Verificare status completo

### Fase 7: Estrazione UI Display Manager (DEPRECATO)
- [ ] Creare `EconomyUIDisplayManager.ts`
- [ ] Estrarre tutti i metodi UI deprecati
- [ ] Marcare tutti i metodi con `@deprecated`
- [ ] Aggiornare `EconomySystem.ts` per delegare
- [ ] **Test**: Verificare che metodi deprecati non rompano nulla

### Fase 8: Verifica API Pubblica
- [ ] Controllare tutti i metodi pubblici di `EconomySystem`
- [ ] Assicurarsi che chiamate esterne funzionino senza modifiche
- [ ] Verificare `UIHUDManager` usa correttamente i callbacks
- [ ] Verificare `PlayState` e `SystemConfigurator` non rompano

### Fase 9: Pulizia
- [ ] Rimuovere commenti JSDoc ridondanti
- [ ] Ottimizzare import
- [ ] Ridurre righe complessive < 500
- [ ] Verificare che `EconomySystem.ts` sia orchestratore snello

### Fase 10: Test Completo
- [ ] Test unitari su moduli
- [ ] Test integrazione sistema nella UI
- [ ] Test regressione: funzionalità e API pubbliche
- [ ] Test callbacks con `UIHUDManager`

## ✅ Checklist Test e Verifiche di Regressione

### Test Funzionalità Base
- [ ] `addCredits()` aggiunge correttamente credits
- [ ] `removeCredits()` rimuove correttamente credits
- [ ] `canAffordCredits()` verifica correttamente disponibilità
- [ ] `setCredits()` imposta correttamente (server authoritative)
- [ ] `addCosmos()` aggiunge correttamente cosmos
- [ ] `removeCosmos()` rimuove correttamente cosmos
- [ ] `canAffordCosmos()` verifica correttamente disponibilità
- [ ] `setCosmos()` imposta correttamente (server authoritative)

### Test Progression
- [ ] `addExperience()` aggiunge correttamente experience
- [ ] `addExperience()` triggera level up quando necessario
- [ ] `getPlayerLevel()` restituisce livello corretto
- [ ] `setExperience()` imposta correttamente (server authoritative)

### Test Honor
- [ ] `addHonor()` aggiunge correttamente honor
- [ ] `setHonor()` imposta correttamente (server authoritative)
- [ ] `setRecentHonor()` aggiorna rank correttamente
- [ ] `addSkillPoints()` aggiunge correttamente skill points
- [ ] `setSkillPoints()` imposta correttamente (server authoritative)

### Test Callbacks
- [ ] `onCreditsChanged` viene chiamato correttamente
- [ ] `onCosmosChanged` viene chiamato correttamente
- [ ] `onExperienceChanged` viene chiamato correttamente (con leveledUp)
- [ ] `onHonorChanged` viene chiamato correttamente (con newRank)
- [ ] `onSkillPointsChanged` viene chiamato correttamente
- [ ] Callbacks non vengono chiamati per `reason === 'server_update'` (tranne set*)

### Test Integrazione
- [ ] `UIHUDManager` riceve correttamente aggiornamenti via callbacks
- [ ] `getPlayerEconomyStatus()` restituisce dati completi
- [ ] `PlayState` può accedere a `EconomySystem` senza modifiche
- [ ] `SystemConfigurator` configura correttamente `EconomySystem`

### Test Regressione
- [ ] Nessun breaking change per sistemi esterni
- [ ] API pubblica mantenuta identica
- [ ] Comportamento identico a prima del refactoring
- [ ] Performance non degradata

## 🏷️ Metodi Deprecati da Mantenere Temporaneamente

### Metodi UI Display (DEPRECATI)
Tutti i metodi in `EconomyUIDisplayManager` sono deprecati ma mantenuti per backward compatibility:

- `createEconomyDisplays()` - **DEPRECATO**: I valori sono ora nell'HUD
- `showEconomyDisplays()` - **DEPRECATO**: I valori sono ora nell'HUD
- `hideEconomyDisplays()` - **DEPRECATO**: I valori sono ora nell'HUD
- `updateEconomyDisplays()` - **DEPRECATO**: I valori sono ora nell'HUD
- `removeEconomyDisplays()` - Mantenuto per cleanup

**Nota**: Questi metodi sono vuoti o non utilizzati, ma mantenuti per evitare breaking changes.

## 📐 Target Finale

### EconomySystem.ts
- **Target**: < 500 righe
- **Struttura**: Orchestratore snello che delega a manager
- **API pubblica**: Identica a prima del refactoring

### Moduli Creati
- `CurrencyManager.ts`: ~180 righe
- `ProgressionManager.ts`: ~120 righe
- `HonorManager.ts`: ~150 righe
- `EconomyEventManager.ts`: ~80 righe
- `EconomyUIDisplayManager.ts`: ~100 righe (deprecato)
- `EconomyStatusManager.ts`: ~50 righe

**Totale moduli**: ~680 righe (distribuite in 6 moduli)

## 🔄 Pattern Dependency Injection

### Esempio: CurrencyManager
```typescript
export class CurrencyManager {
  constructor(
    private readonly ecs: ECS,
    private readonly getPlayerEntity: () => any,
    private readonly onCreditsChanged?: (newAmount: number, change: number) => void,
    private readonly onCosmosChanged?: (newAmount: number, change: number) => void
  ) {}
  
  addCredits(amount: number, reason: string = 'unknown'): number {
    // Implementation
  }
}
```

### Esempio: HonorManager
```typescript
export class HonorManager {
  constructor(
    private readonly ecs: ECS,
    private readonly getPlayerEntity: () => any,
    private readonly getRankSystem: () => any,
    private readonly onHonorChanged?: (newAmount: number, change: number, newRank?: string) => void,
    private readonly onSkillPointsChanged?: (newAmount: number, change: number) => void
  ) {}
  
  addHonor(amount: number, reason: string = 'unknown'): void {
    // Implementation
  }
}
```

## ⚠️ Note Tecniche

### Proprietà Private Mancanti
Il file originale usa `creditsDisplayElement`, `cosmosDisplayElement`, `experienceDisplayElement`, `honorDisplayElement`, e `economyPanelElement` ma non le dichiara esplicitamente. Durante il refactoring:
- Aggiungere dichiarazioni private in `EconomyUIDisplayManager`
- Oppure rimuovere completamente se non utilizzate

## ⚠️ Punti Chiave e Best Practices

### 🔄 Verifica Dipendenze Incrociate
- **Usare Dependency Injection** invece di import diretti tra manager
- `EconomyStatusManager` riceve altri manager via DI
- Solo `EconomySystem` importa tutti i manager

### 🏷️ Deprecazione Controllata
- Segnare metodi deprecati con `@deprecated` nei commenti
- Mantenere per backward compatibility
- Rimuovere solo dopo test completo se non usati

### 🧪 Testing Incrementale
- **Dopo ogni fase**: Verificare che operazioni economiche funzionino
- Test callbacks dopo ogni estrazione
- Riduce rischi di bug a fine refactor

### 📏 Controllo Righe
- Target moduli: < 200 righe ciascuno
- Se supera 200 righe, valutare split interno (solo se necessario)

### 📚 Documentazione Interna
- Creare `src/systems/economy/managers/README.md`
- Documentare dipendenze, pattern DI, metodi deprecati
- Utile per onboarding e futuri refactor

## 🎯 Ordine di Estrazione Consigliato

1. **CurrencyManager** (più semplice, meno dipendenze)
2. **ProgressionManager** (simile a CurrencyManager)
3. **EconomyEventManager** (indipendente)
4. **HonorManager** (più complesso, dipende da rankSystem)
5. **EconomyStatusManager** (dipende da altri manager)
6. **EconomyUIDisplayManager** (deprecato, può essere fatto per ultimo)
