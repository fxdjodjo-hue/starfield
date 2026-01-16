# Piano Refactoring UiSystem.ts

## 📊 Analisi File Originale

**File**: `src/systems/ui/UiSystem.ts`  
**Righe totali**: 872  
**Target**: < 500 righe  
**Riduzione necessaria**: ~372 righe (~43%)

## 🎯 Responsabilità Identificate

### 1. Orchestrazione Pannelli UI
- Apertura/chiusura pannelli
- Gestione z-index e layering
- Aggiornamento contenuti dinamici

### 2. HUD / Player Info
- Statistiche in tempo reale
- Aggiornamento health, shield, skill points
- Notifiche eventi di gioco

### 3. Chat UI
- Rendering messaggi
- Filtri e gestione input
- Scroll automatico / notifiche

### 4. Nickname / Player Tag
- Rendering nomi player sopra avatar
- Aggiornamento dinamico posizione

### 5. Utility
- Event listeners globali
- Coordinamento con ECS / ClientNetworkSystem

## 🎯 Moduli Proposti

| Modulo | Target righe | Responsabilità |
|--------|--------------|----------------|
| `UIPanelManager.ts` | ~250 | Gestione pannelli, apertura/chiusura, layering |
| `UIHUDManager.ts` | ~200 | Aggiornamento HUD e statistiche player |
| `UIChatManager.ts` | ~100 | Gestione chat, input, rendering messaggi |
| `UINicknameManager.ts` | ~50 | Rendering nickname sopra player |
| `UiSystem.ts` | ~100-120 | Orchestratore snello, coordina manager, API pubbliche |

## 📋 Piano Step-by-Step

### Fase 1: Preparazione

**Obiettivo**: Setup ambiente e struttura moduli

**Azioni**:
1. ✅ Creare branch `refactor/ui-system-modularization`
2. ✅ Creare cartella `src/systems/ui/managers/`
3. ✅ Creare skeleton dei moduli:
   - `UIPanelManager.ts`
   - `UIHUDManager.ts`
   - `UIChatManager.ts`
   - `UINicknameManager.ts`

**Verifica**:
- [ ] Branch creato
- [ ] Cartella creata
- [ ] Skeleton moduli con classi base e costruttori

---

### Fase 2: Estrazione Pannelli

**Obiettivo**: Estrarre gestione pannelli UI

**Azioni**:
1. **UIPanelManager**:
   - Estrarre `openPanel(panelId: string)`
   - Estrarre `closePanel(panelId: string)`
   - Estrarre `togglePanel(panelId: string)`
   - Estrarre `updatePanelContent(panelId: string, data: any)`
   - Estrarre `initializePanels()`
   - Aggiornare `UiSystem` per delegare gestione pannelli a `UIPanelManager`

**Test Incrementale**:
- [ ] Apertura/chiusura pannelli funzionante
- [ ] Aggiornamento contenuti corretto
- [ ] Z-index e layering coerente

---

### Fase 3: Estrazione HUD / Player Info

**Obiettivo**: Estrarre aggiornamento HUD e statistiche

**Azioni**:
1. **UIHUDManager**:
   - Estrarre `updatePlayerStats(playerId: string, stats: PlayerStats)`
   - Estrarre `updateHealth(playerId: string, health: number)`
   - Estrarre `updateShield(playerId: string, shield: number)`
   - Estrarre logica aggiornamento HUD
   - `UiSystem` delega aggiornamento statistiche a `UIHUDManager`

**Test Incrementale**:
- [ ] Aggiornamento health/shield in tempo reale
- [ ] Statistiche corrette dopo eventi di gioco

---

### Fase 4: Estrazione Chat

**Obiettivo**: Estrarre gestione chat

**Azioni**:
1. **UIChatManager**:
   - Estrarre `renderMessage(message: ChatMessage)`
   - Estrarre `sendMessage(input: string)`
   - Estrarre `scrollToBottom()`
   - Estrarre logica inizializzazione chat
   - `UiSystem` delega input/output chat a `UIChatManager`

**Test Incrementale**:
- [ ] Messaggi renderizzati correttamente
- [ ] Scroll automatico funzionante
- [ ] Invio messaggi al server funzionante

---

### Fase 5: Estrazione Nickname / Player Tag

**Obiettivo**: Estrarre rendering nickname

**Azioni**:
1. **UINicknameManager**:
   - Estrarre `renderNickname(playerId: string, name: string)`
   - Estrarre `updateNicknamePosition(playerId: string, x: number, y: number)`
   - Estrarre gestione nickname NPC e remote players
   - `UiSystem` delega rendering nickname a `UINicknameManager`

**Test Incrementale**:
- [ ] Nickname corretti sopra player
- [ ] Aggiornamento dinamico posizione durante movimento

---

### Fase 6: Pulizia e Ottimizzazione Orchestratore

**Obiettivo**: Ridurre `UiSystem.ts` a orchestratore snello

**Azioni**:
1. `UiSystem.ts` coordina tutti i manager
2. Mantiene solo API pubbliche:
   - `openPanel()`, `closePanel()`
   - `updatePlayerStats()`
   - `sendMessage()`
   - Altri metodi pubblici esistenti
3. Verifica backward compatibility con:
   - `UpgradePanel`
   - `ClientNetworkSystem`
   - `PlayState`

**Verifica**:
- [ ] File < 120 righe
- [ ] Nessuna dipendenza circolare
- [ ] Tutti i metodi pubblici funzionano

---

### Fase 7: Test Completo

**Obiettivo**: Verifica completa funzionalità e regressione

**Test Unitari** (opzionale):
- [ ] `UIPanelManager` gestisce pannelli correttamente
- [ ] `UIHUDManager` aggiorna statistiche correttamente
- [ ] `UIChatManager` gestisce messaggi correttamente
- [ ] `UINicknameManager` renderizza nickname correttamente

**Test Integrazione**:
- [ ] Tutti i pannelli UI funzionano insieme
- [ ] Aggiornamenti HUD corretti
- [ ] Chat operativa
- [ ] Nickname corretti

**Test Regressione**:
- [ ] `UpgradePanel` e `AuthScreen` funzionano senza modifiche
- [ ] Nessun breaking change per `PlayState` o `ECS`

---

### Fase 8: Documentazione

**Obiettivo**: Documentare architettura modulare

**Azioni**:
1. Creare `README.md` in `src/systems/ui/managers/`
2. Documentare:
   - Dipendenze tra moduli
   - Pattern Dependency Injection
   - Metodi pubblici
   - Eventuali metodi deprecati

**Checklist Documentazione**:
- [ ] README.md creato
- [ ] Dipendenze tra moduli documentate
- [ ] Pattern dependency injection spiegato
- [ ] Metodi pubblici elencati
- [ ] Esempi di utilizzo inclusi

---

## 📐 Struttura Finale

```
src/systems/ui/
├── UiSystem.ts (< 120 righe)
└── managers/
    ├── UIPanelManager.ts (~250 righe)
    ├── UIHUDManager.ts (~200 righe)
    ├── UIChatManager.ts (~100 righe)
    └── UINicknameManager.ts (~50 righe)
```

## 🔗 Dipendenze tra Moduli

```
UiSystem
├── UIPanelManager
│   └── UIManager, PanelConfig
├── UIHUDManager
│   └── PlayerHUD, PlayerSystem
├── UIChatManager
│   └── ChatPanel, ChatManager
└── UINicknameManager
    └── ECS, Transform
```

## ⚠️ Verifica Dipendenze Incrociate

**Soluzione - Dependency Injection**:
- `UIPanelManager` riceve `UIManager` e callback per aggiornamenti
- `UIHUDManager` riceve `PlayerHUD` e `PlayerSystem` via DI
- `UIChatManager` riceve `ChatPanel` e `ChatManager` via DI
- `UINicknameManager` riceve `ECS` e callback per rendering
- Solo `UiSystem` importa tutti i manager

## ✅ Checklist Finale

- [ ] Fase 1: Preparazione completata
- [ ] Fase 2: Estrazione Pannelli completata
- [ ] Fase 3: Estrazione HUD completata
- [ ] Fase 4: Estrazione Chat completata
- [ ] Fase 5: Estrazione Nickname completata
- [ ] Fase 6: Pulizia e Ottimizzazione completata
- [ ] Fase 7: Test Completo completato
- [ ] Fase 8: Documentazione completata
- [ ] File < 120 righe
- [ ] Nessun breaking change
- [ ] **Dipendenze incrociate verificate** (dependency injection)
- [ ] **Test incrementale eseguito dopo ogni fase**
- [ ] **Documentazione interna aggiornata** (README.md)
