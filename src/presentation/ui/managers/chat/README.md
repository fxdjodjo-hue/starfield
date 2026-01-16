# ChatPanel Managers

Questo documento descrive l'architettura modulare del `ChatPanel`, refactorizzato da 577 righe a 173 righe.

## Architettura

Il `ChatPanel` è stato suddiviso in 4 manager specializzati, ognuno con una responsabilità specifica:

### 1. ChatUIRenderer
**Responsabilità**: Creazione e rendering UI del pannello chat.

**Metodi principali**:
- `createPanel()`: Crea il container principale, header, messages container, input container, toggle button
- `createMessageElement(message, context?)`: Crea elemento DOM per un messaggio
- `formatTime(date)`: Formatta l'ora del messaggio

**Dipendenze**:
- `dprCompensation`, `targetHeight`

### 2. ChatMessageManager
**Responsabilità**: Gestione array messaggi e aggiornamento display.

**Metodi principali**:
- `addMessage(message: ChatMessage)`: Aggiunge un messaggio alla chat
- `addSystemMessage(content: string)`: Aggiunge un messaggio di sistema
- `updateMessagesDisplay()`: Aggiorna la visualizzazione dei messaggi (ottimizzato con DocumentFragment)
- `scrollToBottom()`: Scrolla automaticamente in basso
- `getMessages()`: Ottiene tutti i messaggi
- `clear()`: Pulisce tutti i messaggi

**Dipendenze**:
- `messagesContainer` (HTMLElement)
- Callback `createMessageElement()` (da ChatUIRenderer via dependency injection)
- `context` (opzionale, per playerNickname)

### 3. ChatVisibilityManager
**Responsabilità**: Gestione visibilità e animazioni.

**Metodi principali**:
- `show()`: Mostra la chat con animazione di espansione
- `hide()`: Nasconde la chat (solo messaggi e input, mantiene header)
- `hideWithAnimation()`: Nasconde la chat con animazione di compressione
- `isVisible()`: Verifica se la chat è visibile

**Dipendenze**:
- `container`, `header`, `messagesContainer`, `inputContainer`, `inputElement`, `toggleButton`
- `targetHeight`

### 4. ChatInputManager
**Responsabilità**: Gestione input e event listeners.

**Metodi principali**:
- `setupEventListeners(toggleClick, sendButtonClick)`: Imposta tutti gli event listeners
- `sendMessage()`: Invia un messaggio (ritorna il messaggio o null se vuoto)
- `createChatTextAbovePlayer(message: string)`: Crea testo fluttuante sopra il player
- `destroy()`: Pulisce event listeners

**Dipendenze**:
- `inputElement`, `container`
- Getter callbacks: `isEnabled()`, `getIsVisible()`
- Callback per show/hide: `show()`, `hideWithAnimation()`
- `sendMessageCallback()` (per creare chat text)
- `ecs`, `playerSystem` (opzionali, per chat text)

## Pattern di Dependency Injection

Tutti i manager utilizzano **dependency injection** per evitare dipendenze circolari:

1. **Dipendenze dirette**: Passate come parametri del costruttore (es. `messagesContainer`, `inputElement`)
2. **Dipendenze opzionali/lazy**: Passate come getter callbacks (es. `() => this.isEnabled`)
3. **Dipendenze bidirezionali**: Passate come callback quando necessario (es. `createMessageElement` callback)

## Inizializzazione

I manager vengono inizializzati nel costruttore di `ChatPanel` tramite `initializeManagers()`. L'ordine di inizializzazione è:
1. `ChatUIRenderer` (crea UI)
2. `ChatVisibilityManager` (gestisce visibilità)
3. `ChatMessageManager` (gestisce messaggi, riceve callback da ChatUIRenderer)
4. `ChatInputManager` (gestisce input, riceve callback da ChatVisibilityManager)

## API Pubbliche Mantenute

Tutte le API pubbliche del `ChatPanel` sono state mantenute per backward compatibility:
- `constructor(ecs?, context?, playerSystem?)`: Mantenuto, inizializza manager
- `setPlayerSystem(playerSystem)`: Mantenuto, aggiorna riferimento
- `addMessage(message: ChatMessage)`: Delegato a `ChatMessageManager`
- `addSystemMessage(content: string)`: Delegato a `ChatMessageManager`
- `show()`: Delegato a `ChatVisibilityManager`
- `hide()`: Delegato a `ChatVisibilityManager`
- `isVisible()`: Delegato a `ChatVisibilityManager`
- `destroy()`: Chiama cleanup su `ChatInputManager`

## Note

- Il metodo `createPanel()` è stato completamente spostato in `ChatUIRenderer.createPanel()`
- La gestione dei messaggi è completamente estratta in `ChatMessageManager`
- Le animazioni show/hide sono gestite da `ChatVisibilityManager`
- Gli event listeners sono gestiti da `ChatInputManager`
- Il chat text sopra il player è creato da `ChatInputManager.createChatTextAbovePlayer()`
