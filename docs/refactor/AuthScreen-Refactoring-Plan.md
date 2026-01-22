# Piano Refactoring AuthScreen.ts

## 📊 Analisi File Originale

**File**: `src/presentation/ui/AuthScreen.ts`  
**Righe totali**: 1080  
**Target**: < 500 righe  
**Riduzione necessaria**: ~580 righe (~54%)

## ⚠️ Punti Chiave e Best Practices

### 🔄 Verifica Dipendenze Incrociate
- **Usare Dependency Injection** invece di import diretti tra manager
- `AuthFormManager` riceve `handleLogin` e `handleRegister` come callback
- `AuthStateManager` riceve `renderAuthForm` come callback
- Solo `AuthScreen` importa tutti i manager

### 🏷️ Deprecazione Controllata
- Segnare metodi deprecati con `@deprecated` se necessario
- Mantenere per backward compatibility

### 🧪 Testing Incrementale
- **Dopo ogni fase**: Verificare che schermata si apra, login/register funzionino
- Test base: schermata si apre + login funziona + register funziona

### 📏 Controllo Righe
- Target moduli: < 300 righe ciascuno
- `AuthFormManager` stimato ~300 righe (vicino al limite)
- Se supera 300 righe, valutare split interno (solo se necessario)

### 📚 Documentazione Interna
- Creare `src/presentation/ui/managers/auth/README.md`
- Documentare dipendenze, pattern DI, flusso autenticazione

## 🎯 Moduli Proposti

### 1. **AuthStateManager** (~80 righe)
**Responsabilità**: Gestione stati autenticazione e transizioni UI

**Metodi da estrarre**:
- `setState(state: AuthState)` (linee 73-78)
- `updateUI()` (linee 83-111)

**Dipendenze**:
- Container DOM (loadingContainer, authContainer, container)
- `renderAuthForm` callback (dependency injection)

### 2. **AuthFormManager** (~300 righe)
**Responsabilità**: Creazione e rendering form (login, register)

**Metodi da estrarre**:
- `renderAuthForm()` (linee 238-349)
- `createLoginForm()` (linee 354-523)
- `createRegisterForm()` (linee 528-693)
- `showButtonLoading()` (linee 1004-1019)

**Dipendenze**:
- `authContainer` HTMLElement
- `getCurrentState()` callback (dependency injection)
- `handleLogin()` callback (dependency injection)
- `handleRegister()` callback (dependency injection)
- `setState()` callback (dependency injection)

### 3. **AuthSessionManager** (~200 righe)
**Responsabilità**: Gestione autenticazione Supabase (login, registrazione, sessioni)

**Metodi da estrarre**:
- `checkExistingSession()` (linee 66-68)
- `handleLogin()` (linee 698-755)
- `handleRegister()` (linee 760-886)
- `notifyAuthenticated()` (linee 1150-1173)

**Dipendenze**:
- `supabase` client
- `GameContext` (per authId, playerNickname)
- `getApiBaseUrl()`
- `gameAPI.createPlayerProfile()`
- `setState()` callback (dependency injection)
- `updateLoadingText()` callback (dependency injection)

### 4. **AuthValidationManager** (~100 righe)
**Responsabilità**: Validazione input e gestione errori

**Metodi da estrarre**:
- `isValidEmail()` (linee 916-919)
- `getFriendlyErrorMessage()` (linee 891-911)
- `showError()` (linee 924-959)
- `showSuccess()` (linee 964-999)

**Dipendenze**:
- `authContainer` HTMLElement
- Nessuna dipendenza da altri manager

### 5. **AuthUIRenderer** (~200 righe)
**Responsabilità**: Rendering UI (container, loading, stili, background)

**Metodi da estrarre**:
- `createUI()` (linee 116-233)
- `addGlobalStyles()` (linee 1024-1108)
- `createStarsBackground()` (linee 1113-1137)

**Dipendenze**:
- `getFormattedVersion()`
- Nessuna dipendenza da altri manager

### 6. **AuthInitializationManager** (~100 righe)
**Responsabilità**: Setup iniziale e lifecycle

**Metodi da estrarre**:
- `init()` (linee 51-61)
- `hide()` (linee 1192-1196)
- `destroy()` (linee 1201-1211)
- `updateLoadingText()` (linee 1178-1187)

**Dipendenze**:
- `AuthUIRenderer`, `AuthStateManager`, `AuthSessionManager`
- Container DOM

## 📋 Piano Step-by-Step

### Fase 1: Preparazione

**Obiettivo**: Setup ambiente e struttura moduli

**Azioni**:
1. ✅ Creare branch `refactor/auth-screen-modularization`
2. ✅ Creare cartella `src/presentation/ui/managers/auth/`
3. ✅ Creare skeleton dei moduli:
   - `AuthStateManager.ts`
   - `AuthFormManager.ts`
   - `AuthSessionManager.ts`
   - `AuthValidationManager.ts`
   - `AuthUIRenderer.ts`
   - `AuthInitializationManager.ts`

**Verifica**:
- [ ] Branch creato
- [ ] Cartella creata
- [ ] Skeleton moduli con classi base e costruttori

---

### Fase 2: Estrazione UI Rendering

**Obiettivo**: Estrarre logica rendering UI e stili

**Azioni**:
1. **AuthUIRenderer**:
   - Estrarre `createUI()` → `AuthUIRenderer.createUI()`
   - Estrarre `addGlobalStyles()` → `AuthUIRenderer.addGlobalStyles()`
   - Estrarre `createStarsBackground()` → `AuthUIRenderer.createStarsBackground()`
   - Aggiornare `AuthScreen` per delegare a `AuthUIRenderer`

2. **AuthValidationManager**:
   - Estrarre `isValidEmail()` → `AuthValidationManager.isValidEmail()`
   - Estrarre `getFriendlyErrorMessage()` → `AuthValidationManager.getFriendlyErrorMessage()`
   - Estrarre `showError()` → `AuthValidationManager.showError()`
   - Estrarre `showSuccess()` → `AuthValidationManager.showSuccess()`

**Test Incrementale**:
- [ ] Schermata si apre correttamente
- [ ] Loading container visibile
- [ ] Stelle background visibili
- [ ] Stili CSS applicati correttamente

---

### Fase 3: Estrazione State Management

**Obiettivo**: Estrarre gestione stati e transizioni

**Azioni**:
1. **AuthStateManager**:
   - Estrarre `setState()` → `AuthStateManager.setState()`
   - Estrarre `updateUI()` → `AuthStateManager.updateUI()`
   - Gestire `currentState`, `isProcessing`, `justLoggedIn`
   - Aggiornare `AuthScreen` per delegare a `AuthStateManager`

**Test Incrementale**:
- [ ] Schermata si apre correttamente
- [ ] Transizione tra stati funziona (LOADING → LOGIN)
- [ ] UI aggiornata correttamente in base allo stato

---

### Fase 4: Estrazione Form Management

**Obiettivo**: Estrarre creazione e rendering form

**Azioni**:
1. **AuthFormManager**:
   - Estrarre `renderAuthForm()` → `AuthFormManager.renderForm()`
   - Estrarre `createLoginForm()` → `AuthFormManager.createLoginForm()`
   - Estrarre `createRegisterForm()` → `AuthFormManager.createRegisterForm()`
   - Estrarre `showButtonLoading()` → `AuthFormManager.showButtonLoading()`
   - Usare dependency injection per `handleLogin`, `handleRegister`, `setState`

**Test Incrementale**:
- [ ] Form login renderizzato correttamente
- [ ] Form register renderizzato correttamente
- [ ] Switch tra login/register funziona
- [ ] Input fields funzionano
- [ ] Button loading funziona

---

### Fase 5: Estrazione Session Management

**Obiettivo**: Estrarre logica autenticazione Supabase

**Azioni**:
1. **AuthSessionManager**:
   - Estrarre `checkExistingSession()` → `AuthSessionManager.checkExistingSession()`
   - Estrarre `handleLogin()` → `AuthSessionManager.handleLogin()`
   - Estrarre `handleRegister()` → `AuthSessionManager.handleRegister()`
   - Estrarre `notifyAuthenticated()` → `AuthSessionManager.notifyAuthenticated()`
   - Usare dependency injection per `setState`, `updateLoadingText`, `showError`, `showSuccess`

**Test Incrementale**:
- [ ] Login funziona end-to-end
- [ ] Register funziona end-to-end
- [ ] Creazione profilo funziona
- [ ] Notifica autenticazione funziona
- [ ] Errori gestiti correttamente

---

### Fase 6: Estrazione Initialization & Lifecycle

**Obiettivo**: Estrarre setup iniziale e lifecycle

**Azioni**:
1. **AuthInitializationManager**:
   - Estrarre `init()` → `AuthInitializationManager.initialize()`
   - Estrarre `hide()` → `AuthInitializationManager.hide()`
   - Estrarre `destroy()` → `AuthInitializationManager.destroy()`
   - Estrarre `updateLoadingText()` → `AuthInitializationManager.updateLoadingText()`
   - Aggiornare `AuthScreen` per delegare lifecycle a `AuthInitializationManager`

**Test Incrementale**:
- [ ] Inizializzazione funziona
- [ ] Hide funziona
- [ ] Destroy funziona
- [ ] Update loading text funziona

---

### Fase 7: Verifica API Pubblica

**Obiettivo**: Assicurare backward compatibility

**Metodi pubblici da mantenere**:
- ✅ `setOnAuthenticated(callback: () => void)` - mantenere
- ✅ `updateLoadingText(text: string)` - delegare a `AuthInitializationManager`
- ✅ `hide()` - delegare a `AuthInitializationManager`
- ✅ `destroy()` - delegare a `AuthInitializationManager`
- ✅ `getNickname()` - mantenere (se usato)

**Verifica**:
- [ ] Tutti i metodi pubblici funzionano senza modifiche
- [ ] `StartState` non richiede modifiche
- [ ] `Game.ts` non richiede modifiche
- [ ] `PlayState` non richiede modifiche

---

### Fase 8: Pulizia

**Obiettivo**: Ridurre righe, ottimizzare, rimuovere codice morto

**Azioni**:
1. Rimuovere commenti eccessivi
2. Rimuovere blocchi vuoti
3. Ottimizzare import
4. Consolidare logica duplicata
5. Verificare righe totali < 500

**Test**:
- [ ] File < 500 righe
- [ ] Nessun errore di compilazione
- [ ] Nessun warning TypeScript

---

### Fase 9: Test Completo

**Obiettivo**: Verifica completa funzionalità e regressione

**Test Integrazione**:
- [ ] Schermata si apre correttamente
- [ ] Login funziona end-to-end
- [ ] Register funziona end-to-end
- [ ] Errori mostrati correttamente
- [ ] Success messages funzionano
- [ ] Transizioni stato funzionano
- [ ] Hide/destroy funzionano

**Test Regressione**:
- [ ] Tutte le funzionalità esistenti funzionano
- [ ] API pubbliche invariate
- [ ] Nessun breaking change per `StartState`
- [ ] Nessun breaking change per `Game.ts`
- [ ] Nessun breaking change per `PlayState`

---

## 📐 Struttura Finale

```
src/presentation/ui/
├── AuthScreen.ts (< 500 righe)
└── managers/
    └── auth/
        ├── AuthStateManager.ts (~80 righe)
        ├── AuthFormManager.ts (~300 righe)
        ├── AuthSessionManager.ts (~200 righe)
        ├── AuthValidationManager.ts (~100 righe)
        ├── AuthUIRenderer.ts (~200 righe)
        └── AuthInitializationManager.ts (~100 righe)
```

## 🔗 Dipendenze tra Moduli

```
AuthScreen
├── AuthInitializationManager
│   ├── AuthUIRenderer
│   ├── AuthStateManager
│   └── AuthSessionManager
├── AuthFormManager
│   ├── AuthStateManager (via DI - getCurrentState callback)
│   └── AuthSessionManager (via DI - handleLogin, handleRegister callbacks)
├── AuthValidationManager (indipendente)
└── AuthSessionManager
    └── AuthStateManager (via DI - setState, updateLoadingText callbacks)
```

### ⚠️ Verifica Dipendenze Incrociate

**Soluzione - Dependency Injection**:
```typescript
// AuthFormManager.ts
constructor(
  private readonly authContainer: HTMLElement,
  private readonly getCurrentState: () => AuthState,
  private readonly handleLogin: (email: string, password: string, button: HTMLButtonElement) => Promise<void>,
  private readonly handleRegister: (email: string, password: string, confirmPassword: string, nickname: string, button: HTMLButtonElement) => Promise<void>,
  private readonly setState: (state: AuthState) => void
) {}

// AuthSessionManager.ts
constructor(
  private readonly context: GameContext,
  private readonly setState: (state: AuthState) => void,
  private readonly updateLoadingText: (text: string) => void,
  private readonly showError: (message: string) => void,
  private readonly showSuccess: (message: string) => void
) {}
```

---

## ✅ Checklist Finale

- [ ] Fase 1: Preparazione completata
- [ ] Fase 2: Estrazione UI Rendering completata
- [ ] Fase 3: Estrazione State Management completata
- [ ] Fase 4: Estrazione Form Management completata
- [ ] Fase 5: Estrazione Session Management completata
- [ ] Fase 6: Estrazione Initialization & Lifecycle completata
- [ ] Fase 7: Verifica API Pubblica completata
- [ ] Fase 8: Pulizia completata
- [ ] Fase 9: Test Completo completato
- [ ] File < 500 righe
- [ ] Nessun breaking change
- [ ] **Dipendenze incrociate verificate** (dependency injection)
- [ ] **Test incrementale eseguito dopo ogni fase**
- [ ] **Documentazione interna aggiornata** (README.md)
