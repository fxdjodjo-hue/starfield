# Piano Refactoring ChatPanel.ts

## 📊 Analisi File Originale

**File**: `src/presentation/ui/ChatPanel.ts`  
**Righe totali**: 577  
**Target**: < 500 righe  
**Riduzione necessaria**: ~77 righe (~13%)

## 🎯 Moduli Proposti

### 1. **ChatUIRenderer** (~200 righe)
**Responsabilità**: Creazione e rendering UI del pannello chat

**Metodi da estrarre**:
- `createPanel()` (linee 56-300)
- `createMessageElement(message: ChatMessage)` (linee 489-533)
- `formatTime(date: Date)` (linee 538-543)

**Dipendenze**:
- `container`, `header`, `messagesContainer`, `inputContainer`, `inputElement`, `toggleButton`
- `dprCompensation`, `targetHeight`

### 2. **ChatInputManager** (~120 righe)
**Responsabilità**: Gestione input e invio messaggi

**Metodi da estrarre**:
- `setupEventListeners()` (linee 305-356)
- `sendMessage()` (linee 422-439)
- `createChatTextAbovePlayer(message: string)` (linee 583-604)

**Dipendenze**:
- `inputElement`, `isEnabled`, `ecs`, `playerSystem`
- Callback per show/hide: `show()`, `hideWithAnimation()`

### 3. **ChatVisibilityManager** (~100 righe)
**Responsabilità**: Gestione visibilità e animazioni

**Metodi da estrarre**:
- `show()` (linee 361-401)
- `hide()` (linee 406-417)
- `hideWithAnimation()` (linee 548-578)

**Dipendenze**:
- `container`, `messagesContainer`, `inputContainer`, `inputElement`, `toggleButton`
- `_isVisible`, `targetHeight`, `header`

### 4. **ChatMessageManager** (~80 righe)
**Responsabilità**: Gestione array messaggi e aggiornamento display

**Metodi da estrarre**:
- `addMessage(message: ChatMessage)` (linee 444-454)
- `addSystemMessage(content: string)` (linee 459-467)
- `updateMessagesDisplay()` (linee 472-484)
- `scrollToBottom()` (linee 609-613)

**Dipendenze**:
- `messages`, `maxMessages`, `messagesContainer`
- `createMessageElement()` (da ChatUIRenderer via callback)

## 📋 Piano Step-by-Step

### Fase 1: Preparazione

**Obiettivo**: Setup ambiente e struttura moduli

**Azioni**:
1. Creare branch `refactor/chat-panel-modularization`
2. Creare cartella `src/presentation/ui/managers/chat/`
3. Creare skeleton dei moduli:
   - `ChatUIRenderer.ts`
   - `ChatInputManager.ts`
   - `ChatVisibilityManager.ts`
   - `ChatMessageManager.ts`

**Verifica**:
- [ ] Branch creato
- [ ] Cartella creata
- [ ] Skeleton moduli con classi base e costruttori

---

### Fase 2: Estrazione UI Renderer

**Obiettivo**: Estrarre creazione e rendering UI

**Azioni**:
1. **ChatUIRenderer**:
   - Estrarre `createPanel()` → `ChatUIRenderer.createPanel()`
   - Estrarre `createMessageElement()` → `ChatUIRenderer.createMessageElement()`
   - Estrarre `formatTime()` → `ChatUIRenderer.formatTime()`
   - Aggiornare `ChatPanel` per delegare a `ChatUIRenderer`

**Test Incrementale**:
- [ ] Pannello chat si crea correttamente
- [ ] Messaggi vengono renderizzati
- [ ] Stili e animazioni funzionano

---

### Fase 3: Estrazione Message Manager

**Obiettivo**: Estrarre gestione messaggi

**Azioni**:
1. **ChatMessageManager**:
   - Estrarre `addMessage()` → `ChatMessageManager.addMessage()`
   - Estrarre `addSystemMessage()` → `ChatMessageManager.addSystemMessage()`
   - Estrarre `updateMessagesDisplay()` → `ChatMessageManager.updateDisplay()`
   - Estrarre `scrollToBottom()` → `ChatMessageManager.scrollToBottom()`
   - Passare callback `createMessageElement()` da `ChatUIRenderer`

**Test Incrementale**:
- [ ] Aggiunta messaggi funziona
- [ ] Messaggi di sistema funzionano
- [ ] Scroll automatico funziona
- [ ] Limite messaggi funziona

---

### Fase 4: Estrazione Visibility Manager

**Obiettivo**: Estrarre gestione visibilità e animazioni

**Azioni**:
1. **ChatVisibilityManager**:
   - Estrarre `show()` → `ChatVisibilityManager.show()`
   - Estrarre `hide()` → `ChatVisibilityManager.hide()`
   - Estrarre `hideWithAnimation()` → `ChatVisibilityManager.hideWithAnimation()`
   - Aggiornare `ChatPanel` per delegare a `ChatVisibilityManager`

**Test Incrementale**:
- [ ] Show/hide funziona
- [ ] Animazioni funzionano
- [ ] Toggle button funziona
- [ ] Focus input funziona

---

### Fase 5: Estrazione Input Manager

**Obiettivo**: Estrarre gestione input e event listeners

**Azioni**:
1. **ChatInputManager**:
   - Estrarre `setupEventListeners()` → `ChatInputManager.setupListeners()`
   - Estrarre `sendMessage()` → `ChatInputManager.sendMessage()`
   - Estrarre `createChatTextAbovePlayer()` → `ChatInputManager.createChatText()`
   - Passare callback per show/hide da `ChatVisibilityManager`

**Test Incrementale**:
- [ ] Input funziona
- [ ] Invio messaggi funziona
- [ ] Event listeners funzionano (ESC, Enter)
- [ ] Chat text sopra player funziona

---

### Fase 6: Verifica API Pubblica

**Obiettivo**: Assicurare backward compatibility

**Metodi pubblici da mantenere**:
- ✅ `constructor(ecs?, context?, playerSystem?)` - mantenere, inizializzare manager
- ✅ `setPlayerSystem(playerSystem)` - mantenere, aggiornare manager
- ✅ `addMessage(message: ChatMessage)` - delegare a `ChatMessageManager`
- ✅ `addSystemMessage(content: string)` - delegare a `ChatMessageManager`
- ✅ `show()` - delegare a `ChatVisibilityManager`
- ✅ `hide()` - delegare a `ChatVisibilityManager`
- ✅ `isVisible()` - delegare a `ChatVisibilityManager`
- ✅ `destroy()` - chiamare cleanup su tutti i manager

**Verifica**:
- [ ] Tutti i metodi pubblici funzionano senza modifiche
- [ ] Nessun breaking change per sistemi che usano `ChatPanel`

---

### Fase 7: Pulizia

**Obiettivo**: Ridurre righe, ottimizzare, rimuovere codice morto

**Azioni**:
1. Rimuovere commenti eccessivi
2. Ottimizzare import
3. Consolidare logica duplicata
4. Verificare righe totali < 500

**Test**:
- [ ] File < 500 righe
- [ ] Nessun errore di compilazione
- [ ] Nessun warning TypeScript

---

### Fase 8: Test Completo

**Obiettivo**: Verifica completa funzionalità e regressione

**Test Integrazione**:
- [ ] Pannello chat si crea correttamente
- [ ] Aggiunta messaggi funziona
- [ ] Invio messaggi funziona
- [ ] Show/hide funziona
- [ ] Animazioni funzionano
- [ ] Event listeners funzionano
- [ ] Chat text sopra player funziona

**Test Regressione**:
- [ ] Tutte le funzionalità esistenti funzionano
- [ ] API pubbliche invariate
- [ ] Nessun breaking change

---

## 📐 Struttura Finale

```
src/presentation/ui/
├── ChatPanel.ts (< 500 righe)
└── managers/
    └── chat/
        ├── ChatUIRenderer.ts (~200 righe)
        ├── ChatInputManager.ts (~120 righe)
        ├── ChatVisibilityManager.ts (~100 righe)
        └── ChatMessageManager.ts (~80 righe)
```

## 🔗 Dipendenze tra Moduli

```
ChatPanel
├── ChatUIRenderer
│   └── Callback createMessageElement → ChatMessageManager
├── ChatInputManager
│   └── Callback show/hide → ChatVisibilityManager
├── ChatVisibilityManager
└── ChatMessageManager
    └── Callback createMessageElement → ChatUIRenderer
```

### ⚠️ Pattern Dependency Injection

**Soluzione - Dependency Injection**:
```typescript
// ChatMessageManager.ts
constructor(
  private readonly messagesContainer: HTMLElement,
  private readonly createMessageElement: (message: ChatMessage) => HTMLElement
) {}

// ChatPanel.ts - Inizializzazione
const uiRenderer = new ChatUIRenderer(...);
const messageManager = new ChatMessageManager(
  this.messagesContainer,
  (msg) => uiRenderer.createMessageElement(msg)
);
```

---

## ✅ Checklist Finale

- [ ] Fase 1: Preparazione completata
- [ ] Fase 2: Estrazione UI Renderer completata
- [ ] Fase 3: Estrazione Message Manager completata
- [ ] Fase 4: Estrazione Visibility Manager completata
- [ ] Fase 5: Estrazione Input Manager completata
- [ ] Fase 6: Verifica API Pubblica completata
- [ ] Fase 7: Pulizia completata
- [ ] Fase 8: Test Completo completato
- [ ] File < 500 righe
- [ ] Nessun breaking change
- [ ] Dependency injection implementata
- [ ] Documentazione README.md creata
