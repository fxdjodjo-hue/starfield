# Auth Screen Managers

## Architettura Modulare

Questi moduli gestiscono la logica della schermata di autenticazione, separando responsabilità per migliorare manutenibilità e testabilità.

## Moduli

### AuthStateManager
- **Responsabilità**: Gestione stati autenticazione e transizioni UI
- **Dipendenze**: Container DOM (container, loadingContainer, authContainer), `renderAuthForm` callback
- **Riceve `renderAuthForm` come callback, non importa AuthFormManager** (evita dipendenze circolari)
- **Metodi principali**: `setState()`, `updateUI()`, `getCurrentState()`, `isProcessingRequest()`, `setProcessing()`, `hasJustLoggedIn()`, `setJustLoggedIn()`

### AuthFormManager
- **Responsabilità**: Creazione e rendering form (login, register)
- **Dipendenze**: `authContainer` HTMLElement, callbacks via dependency injection
- **Riceve funzioni come parametri, non importa altri manager** (evita dipendenze circolari)
- **Metodi principali**: `renderForm()`, `createLoginForm()`, `createRegisterForm()`, `showButtonLoading()`

### AuthSessionManager
- **Responsabilità**: Gestione autenticazione Supabase (login, registrazione, sessioni)
- **Dipendenze**: `supabase` client, `GameContext`, callbacks via dependency injection
- **Riceve metodi come callback, non importa altri manager** (evita dipendenze circolari)
- **Metodi principali**: `checkExistingSession()`, `handleLogin()`, `handleRegister()`, `notifyAuthenticated()`

### AuthValidationManager
- **Responsabilità**: Validazione input e gestione errori
- **Dipendenze**: `authContainer` HTMLElement
- **Nessuna dipendenza da altri manager**
- **Metodi principali**: `isValidEmail()`, `getFriendlyErrorMessage()`, `showError()`, `showSuccess()`

### AuthUIRenderer
- **Responsabilità**: Rendering UI (container, loading, stili, background)
- **Dipendenze**: `getFormattedVersion()`
- **Nessuna dipendenza da altri manager**
- **Metodi principali**: `createUI()`, `addGlobalStyles()`, `createStarsBackground()`, `updateLoadingText()`

### AuthInitializationManager
- **Responsabilità**: Setup iniziale e lifecycle
- **Dipendenze**: `AuthUIRenderer`, `AuthSessionManager`
- **Orchestra rendering e inizializzazione**
- **Metodi principali**: `initialize()`, `updateLoadingText()`, `hide()`, `destroy()`

## Pattern Dependency Injection

Per evitare dipendenze circolari:
- `AuthStateManager` riceve `renderAuthForm` come callback
- `AuthFormManager` riceve `getCurrentState`, `isProcessing`, `handleLogin`, `handleRegister`, `setState`, `showButtonLoading` come callback/funzioni
- `AuthSessionManager` riceve tutti i metodi necessari come callback
- Solo `AuthScreen` importa tutti i manager e coordina le dipendenze

## Struttura Dipendenze

```
AuthScreen
├── AuthInitializationManager
│   └── AuthUIRenderer (indipendente)
├── AuthValidationManager (indipendente)
├── AuthStateManager (usa renderAuthForm via DI)
├── AuthSessionManager (usa callbacks via DI)
└── AuthFormManager (usa callbacks via DI)
```

## Flusso Autenticazione

1. **Inizializzazione**: `AuthInitializationManager` crea UI tramite `AuthUIRenderer`
2. **Controllo Sessione**: `AuthSessionManager.checkExistingSession()` → `AuthStateManager.setState(LOGIN)`
3. **Rendering Form**: `AuthStateManager.updateUI()` → `AuthFormManager.renderForm()`
4. **Login/Register**: `AuthFormManager` → `AuthSessionManager.handleLogin/Register()`
5. **Validazione**: `AuthSessionManager` → `AuthValidationManager` per validazione e messaggi
6. **Autenticazione**: `AuthSessionManager.notifyAuthenticated()` → `AuthStateManager.setState(LOADING)`
7. **Callback**: `onAuthenticated()` chiamato → transizione a PlayState

## Esempi di Utilizzo

### AuthScreen (Orchestratore)
```typescript
const authScreen = new AuthScreen(context);
authScreen.setOnAuthenticated(() => {
  // Transizione a PlayState
});
authScreen.updateLoadingText("Connecting...");
authScreen.hide();
```

### Manager Individuali (per testing)
```typescript
// Test isolato di AuthValidationManager
const validationManager = new AuthValidationManager(authContainer);
const isValid = validationManager.isValidEmail('test@example.com');
console.log(isValid); // true

// Test isolato di AuthUIRenderer
const uiRenderer = new AuthUIRenderer();
uiRenderer.addGlobalStyles();
const ui = uiRenderer.createUI();
```

## Note

- Tutti i manager sono testabili in isolamento
- Le dipendenze tra manager sono gestite via dependency injection
- Nessuna dipendenza circolare tra manager
- `AuthScreen` agisce come orchestratore e mantiene le API pubbliche
- L'inizializzazione è lazy per gestire dipendenze circolari

## Changelog

- **v2.0** (Refactoring): Modularizzazione completa, riduzione da 1080 a 154 righe
- **v1.0**: Implementazione monolitica originale
