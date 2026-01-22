# Analisi Refactoring ClientNetworkSystem.ts

## Stato Attuale
- **File**: `src/multiplayer/client/ClientNetworkSystem.ts`
- **Righe totali**: 1407
- **Obiettivo**: < 500 righe
- **Riduzione necessaria**: ~907 righe (~64%)

---

## Mappa Responsabilità Linea per Linea

### Sezione 1: Imports e Setup (1-60)
**Righe**: 1-60  
**Responsabilità**: Import di dipendenze, tipi, configurazioni  
**Azione**: Mantenere (necessario per il file principale)

### Sezione 2: ConnectionState Enum (63-69)
**Righe**: 63-69  
**Responsabilità**: Definizione stati connessione  
**Azione**: **Estrarre → NetworkStateManager.ts**

### Sezione 3: Class Definition e Properties (75-135)
**Righe**: 75-135  
**Responsabilità**: 
- Definizione classe e proprietà core (77-98)
- Proprietà stato connessione (112-135)
- Proprietà inizializzazione (119-122)
- Proprietà JWT auth (124-129)
- Proprietà connection state (131-135)

**Azione**: 
- Mantenere proprietà core (77-98)
- **Estrarre proprietà stato → NetworkStateManager**
- **Estrarre proprietà init → NetworkInitializationManager**
- **Estrarre proprietà JWT → NetworkAuthenticationManager** (nuovo modulo)

### Sezione 4: Constructor (137-177)
**Righe**: 137-177  
**Responsabilità**: Inizializzazione componenti modulari  
**Azione**: **Estrarre logica setup → NetworkInitializationManager**

### Sezione 5: Getter/Setter API Pubblica (179-229)
**Righe**: 179-229  
**Responsabilità**: API pubblica per accesso stato  
**Azione**: **Mantenere** (API pubblica - backward compatibility)

### Sezione 6: registerMessageHandlers (234-275)
**Righe**: 234-275  
**Responsabilità**: Registrazione handler messaggi  
**Azione**: **Estrarre → NetworkInitializationManager**

### Sezione 7: JWT Authentication (280-346)
**Righe**: 280-346  
**Responsabilità**: 
- Gestione errori autenticazione JWT (280-330)
- Retry logic con exponential backoff
- Refresh session Supabase

**Azione**: **Estrarre → NetworkAuthenticationManager.ts** (nuovo modulo)

### Sezione 8: showAuthenticationErrorToUser (335-346)
**Righe**: 335-346  
**Responsabilità**: Notifica errori autenticazione all'utente  
**Azione**: **Estrarre → NetworkEventSystem** (già gestisce notifiche UI)

### Sezione 9: showRateLimitNotification (351-370)
**Righe**: 351-370  
**Responsabilità**: Notifica rate limiting all'utente  
**Azione**: **Estrarre → NetworkEventSystem**

### Sezione 10: handleConnected (375-427)
**Righe**: 375-427  
**Responsabilità**: 
- Gestione connessione stabilita (375-390)
- Validazione sessione JWT (392-408)
- Invio messaggio JOIN (410-426)

**Azione**: **Estrarre → NetworkInitializationManager** (logica setup connessione)

### Sezione 11: handleMessage (432-474)
**Righe**: 432-474  
**Responsabilità**: 
- Parsing messaggi (434-435)
- Routing a MessageRouter (443-467)
- Gestione messaggi semplici (444-455)

**Azione**: **Mantenere** (orchestrazione routing - può essere semplificato)

### Sezione 12: handleProjectileUpdates (479-526)
**Righe**: 479-526  
**Responsabilità**: Aggiornamento posizione proiettili remoti  
**Azione**: **Estrarre → ProjectileUpdateHandler** (già esiste, estendere)

### Sezione 13: handleDisconnected (531-553)
**Righe**: 531-553  
**Responsabilità**: Gestione disconnessione e cleanup  
**Azione**: **Estrarre → NetworkStateManager**

### Sezione 14: handleConnectionError (558-564)
**Righe**: 558-564  
**Responsabilità**: Gestione errori connessione  
**Azione**: **Estrarre → NetworkStateManager**

### Sezione 15: handleReconnecting (569-575)
**Righe**: 569-575  
**Responsabilità**: Gestione tentativi riconnessione  
**Azione**: **Estrarre → NetworkStateManager**

### Sezione 16: Callback Registration API (582-612)
**Righe**: 582-612  
**Responsabilità**: API pubblica per registrazione callback  
**Azione**: **Mantenere** (API pubblica)

### Sezione 17: connect() (617-662)
**Righe**: 617-662  
**Responsabilità**: 
- Prevenzione race conditions (619-626)
- Gestione promise connessione (628-645)
- Gestione errori (647-659)

**Azione**: **Estrarre → NetworkStateManager** (gestione stato connessione)

### Sezione 18: update() (668-694)
**Righe**: 668-694  
**Responsabilità**: 
- Update loop principale (668-683)
- Logging stato (685-693)

**Azione**: **Mantenere** (orchestrazione principale - semplificare)

### Sezione 19: sendHeartbeat() (702-716)
**Righe**: 702-716  
**Responsabilità**: Invio heartbeat con rate limiting  
**Azione**: **Estrarre → NetworkStateManager** (già gestito da NetworkTickManager, ma rate limiting qui)

### Sezione 20: getLocalPlayerPosition() (721-723)
**Righe**: 721-723  
**Responsabilità**: Delegazione a PlayerPositionTracker  
**Azione**: **Mantenere** (wrapper API pubblica)

### Sezione 21: getCurrentPlayerVelocity() (728-753)
**Righe**: 728-753  
**Responsabilità**: Estrazione velocità player da ECS  
**Azione**: **Estrarre → PlayerPositionTracker** (estendere funzionalità)

### Sezione 22: sendPlayerPosition() (761-826)
**Righe**: 761-826  
**Responsabilità**: 
- Validazione stato welcome (765-769)
- Normalizzazione rotazione (772-774)
- Estrazione velocità (777)
- Rate limiting (788-791)
- Validazione posizione (794-814)
- Invio messaggio (816-825)

**Azione**: **Estrarre → NetworkPositionSyncManager.ts** (nuovo modulo) o **estendere PlayerPositionTracker**

### Sezione 23: isValidPosition() (831-850)
**Righe**: 831-850  
**Responsabilità**: Validazione posizione prima invio  
**Azione**: **Estrarre → NetworkPositionSyncManager** o **PlayerPositionTracker**

### Sezione 24: sendMessage() (857-864)
**Righe**: 857-864  
**Responsabilità**: Wrapper invio messaggi  
**Azione**: **Mantenere** (API pubblica semplificata)

### Sezione 25: API Pubbliche Varie (869-989)
**Righe**: 869-989  
**Responsabilità**: 
- isConnected(), getConnectionState() (869-878)
- Getter/Setter RemoteNpcSystem (883-900)
- Getter/Setter RemoteProjectileSystem (905-915)
- setEcs() (920-922)
- stopCombat() (927-952)
- connectToServer() (957-963)
- getEntityDestroyedHandler() (968-975)
- getRemoteProjectileSystem() (980-982)
- getECS() (987-989)

**Azione**: **Mantenere** (API pubblica)

### Sezione 26: sendExplosionCreated() (994-1016)
**Righe**: 994-1016  
**Responsabilità**: Invio notifica esplosione  
**Azione**: **Mantenere** (API pubblica - delegazione a connectionManager)

### Sezione 27: createRemoteExplosion() (1022-1030)
**Righe**: 1022-1030  
**Responsabilità**: Delegazione a NetworkEventSystem  
**Azione**: **Mantenere** (API pubblica)

### Sezione 28: setPreloadedExplosionFrames() (1036-1038)
**Righe**: 1036-1038  
**Responsabilità**: Delegazione a explosionSystem  
**Azione**: **Mantenere** (API pubblica - ma explosionSystem non è accessibile direttamente)

### Sezione 29: sendStartCombat() (1044-1074)
**Righe**: 1044-1074  
**Responsabilità**: 
- Validazione connessione (1048-1054)
- Rate limiting (1058-1061)
- Invio messaggio START_COMBAT (1066-1073)

**Azione**: **Estrarre → NetworkCombatManager.ts** (nuovo modulo) o **estendere handler esistente**

### Sezione 30: sendStopCombat() (1079-1095)
**Righe**: 1079-1095  
**Responsabilità**: Invio messaggio STOP_COMBAT  
**Azione**: **Estrarre → NetworkCombatManager**

### Sezione 31: sendProjectileFired() (1100-1130)
**Righe**: 1100-1130  
**Responsabilità**: 
- Validazione connessione (1108-1110)
- Rate limiting (1113-1116)
- Invio messaggio PROJECTILE_FIRED (1118-1129)

**Azione**: **Estrarre → NetworkCombatManager**

### Sezione 32: requestSkillUpgrade() (1145-1162)
**Righe**: 1145-1162  
**Responsabilità**: Richiesta upgrade skill al server  
**Azione**: **Estrarre → NetworkPlayerDataManager.ts** (nuovo modulo) o **handler dedicato**

### Sezione 33: sendChatMessage() (1167-1196)
**Righe**: 1167-1196  
**Responsabilità**: 
- Validazione connessione e contenuto (1168-1176)
- Rate limiting (1179-1182)
- Invio messaggio chat (1184-1195)

**Azione**: **Estrarre → NetworkChatManager.ts** (nuovo modulo) o **estendere ChatMessageHandler**

### Sezione 34: Setter Sistemi Esterni (1201-1307)
**Righe**: 1201-1307  
**Responsabilità**: 
- setAudioSystem(), getAudioSystem() (1201-1212)
- getMessageRouter() (1217-1219)
- disconnect() (1224-1227)
- setLogSystem(), getLogSystem() (1233-1256)
- resetAllUpgradeProgress() (1244-1249)
- setUiSystem(), getUiSystem() (1262-1275)
- setEconomySystem(), getEconomySystem() (1280-1293)
- setRewardSystem(), getRewardSystem() (1298-1307)

**Azione**: **Mantenere** (API pubblica - delegazione a eventSystem)

### Sezione 35: Initialization API (1313-1341)
**Righe**: 1313-1341  
**Responsabilità**: 
- initialize() (1313-1323)
- markAsInitialized() (1328-1334)
- isSystemInitialized() (1339-1341)

**Azione**: **Estrarre → NetworkInitializationManager**

### Sezione 36: setOnPlayerIdReceived() (1347-1349)
**Righe**: 1347-1349  
**Responsabilità**: Callback player ID  
**Azione**: **Mantenere** (API pubblica)

### Sezione 37: getRateLimiterStats() (1354-1356)
**Righe**: 1354-1356  
**Responsabilità**: Statistiche rate limiter  
**Azione**: **Mantenere** (API pubblica)

### Sezione 38: requestPlayerData() (1361-1375)
**Righe**: 1361-1375  
**Responsabilità**: Richiesta dati player  
**Azione**: **Estrarre → NetworkPlayerDataManager**

### Sezione 39: destroy() (1380-1406)
**Righe**: 1380-1406  
**Responsabilità**: Cleanup risorse  
**Azione**: **Mantenere** (orchestrazione cleanup - delegare ai manager)

---

## Moduli Proposti

### 1. NetworkStateManager.ts (NUOVO)
**Responsabilità**: Gestione stato connessione, riconnessione, ping/heartbeat  
**Linee da estrarre**:
- ConnectionState enum (63-69)
- Proprietà connection state (131-135)
- handleDisconnected() (531-553)
- handleConnectionError() (558-564)
- handleReconnecting() (569-575)
- connect() con race condition prevention (617-662)
- sendHeartbeat() con rate limiting (702-716)

**Dipendenze**:
- NetworkConnectionManager (per invio messaggi)
- RateLimiter (per rate limiting heartbeat)
- NetworkTickManager (per timing heartbeat)

**Righe stimate**: ~200-250

### 2. NetworkInitializationManager.ts (NUOVO)
**Responsabilità**: Setup rete, inizializzazione stati, handshake, init client state  
**Linee da estrarre**:
- Proprietà inizializzazione (119-122)
- Constructor setup logic (137-177) - parte inizializzazione
- registerMessageHandlers() (234-275)
- handleConnected() con JWT validation e JOIN (375-427)
- initialize(), markAsInitialized(), isSystemInitialized() (1313-1341)

**Dipendenze**:
- MessageRouter (per registrazione handler)
- NetworkConnectionManager (per connessione)
- NetworkEventSystem (per notifiche)
- GameContext (per dati player)

**Righe stimate**: ~300-350

### 3. NetworkAuthenticationManager.ts (NUOVO)
**Responsabilità**: Gestione autenticazione JWT, retry logic, refresh session  
**Linee da estrarre**:
- Proprietà JWT auth (124-129)
- handleJwtAuthenticationError() (280-330)
- Logica refresh session Supabase (302-329)

**Dipendenze**:
- supabase client
- NetworkEventSystem (per notifiche errori)
- NetworkStateManager (per riconnessione dopo refresh)

**Righe stimate**: ~150-200

### 4. NetworkPositionSyncManager.ts (NUOVO)
**Responsabilità**: Sincronizzazione posizione player, validazione, rate limiting  
**Linee da estrarre**:
- sendPlayerPosition() (761-826)
- isValidPosition() (831-850)
- getCurrentPlayerVelocity() (728-753) - o estendere PlayerPositionTracker

**Dipendenze**:
- PlayerPositionTracker (per posizione)
- RateLimiter (per rate limiting)
- NetworkConnectionManager (per invio)
- ECS (per velocità)

**Righe stimate**: ~200-250

**Alternativa**: Estendere PlayerPositionTracker invece di creare nuovo modulo

### 5. NetworkCombatManager.ts (NUOVO)
**Responsabilità**: Gestione messaggi combattimento (start/stop combat, projectile fired)  
**Linee da estrarre**:
- sendStartCombat() (1044-1074)
- sendStopCombat() (1079-1095)
- sendProjectileFired() (1100-1130)

**Dipendenze**:
- NetworkConnectionManager (per invio)
- RateLimiter (per rate limiting)
- NetworkEventSystem (per notifiche rate limit)
- RemoteEntityManager (per currentCombatNpcId)

**Righe stimate**: ~150-200

### 6. NetworkPlayerDataManager.ts (NUOVO)
**Responsabilità**: Richiesta/gestione dati player (skill upgrade, player data)  
**Linee da estrarre**:
- requestSkillUpgrade() (1145-1162)
- requestPlayerData() (1361-1375)

**Dipendenze**:
- NetworkConnectionManager (per invio)
- GameContext (per playerId)

**Righe stimate**: ~80-100

### 7. NetworkChatManager.ts (NUOVO - OPZIONALE)
**Responsabilità**: Gestione messaggi chat con rate limiting  
**Linee da estrarre**:
- sendChatMessage() (1167-1196)

**Dipendenze**:
- NetworkConnectionManager (per invio)
- RateLimiter (per rate limiting)
- NetworkEventSystem (per notifiche rate limit)

**Righe stimate**: ~60-80

**Alternativa**: Estendere ChatMessageHandler esistente invece di creare nuovo modulo

---

## Riallocazione in Moduli Esistenti

### NetworkEventSystem.ts
**Aggiungere**:
- showAuthenticationErrorToUser() (335-346)
- showRateLimitNotification() (351-370)

**Righe aggiuntive**: ~40

### PlayerPositionTracker.ts
**Aggiungere**:
- getCurrentPlayerVelocity() (728-753)

**Righe aggiuntive**: ~25

**Alternativa**: Creare NetworkPositionSyncManager se la logica diventa troppo complessa

### ProjectileUpdateHandler.ts (esistente)
**Estendere**:
- handleProjectileUpdates() (479-526) - già gestito, verificare se completo

---

## Dipendenze tra Blocchi

```
ClientNetworkSystem (orchestratore)
├── NetworkStateManager
│   ├── NetworkConnectionManager
│   ├── RateLimiter
│   └── NetworkTickManager
├── NetworkInitializationManager
│   ├── MessageRouter
│   ├── NetworkConnectionManager
│   ├── NetworkEventSystem
│   └── GameContext
├── NetworkAuthenticationManager
│   ├── supabase client
│   ├── NetworkEventSystem
│   └── NetworkStateManager
├── NetworkPositionSyncManager (o PlayerPositionTracker esteso)
│   ├── PlayerPositionTracker
│   ├── RateLimiter
│   ├── NetworkConnectionManager
│   └── ECS
├── NetworkCombatManager
│   ├── NetworkConnectionManager
│   ├── RateLimiter
│   ├── NetworkEventSystem
│   └── RemoteEntityManager
├── NetworkPlayerDataManager
│   ├── NetworkConnectionManager
│   └── GameContext
└── NetworkChatManager (opzionale)
    ├── NetworkConnectionManager
    ├── RateLimiter
    └── NetworkEventSystem
```

---

## Piano di Refactor Step-by-Step

### Fase 1: Preparazione (Priorità ALTA)
1. ✅ Creare branch `refactor/client-network-system-modularization`
2. Creare struttura moduli nuovi:
   - `src/multiplayer/client/managers/NetworkStateManager.ts`
   - `src/multiplayer/client/managers/NetworkInitializationManager.ts`
   - `src/multiplayer/client/managers/NetworkAuthenticationManager.ts`
   - `src/multiplayer/client/managers/NetworkPositionSyncManager.ts`
   - `src/multiplayer/client/managers/NetworkCombatManager.ts`
   - `src/multiplayer/client/managers/NetworkPlayerDataManager.ts`
   - `src/multiplayer/client/managers/NetworkChatManager.ts` (opzionale)

### Fase 2: Estrazione NetworkStateManager (Priorità ALTA)
**Step 2.1**: Creare NetworkStateManager.ts
- Estrarre ConnectionState enum
- Estrarre proprietà connection state
- Estrarre handleDisconnected(), handleConnectionError(), handleReconnecting()
- Estrarre connect() con race condition prevention
- Estrarre sendHeartbeat() con rate limiting

**Step 2.2**: Aggiornare ClientNetworkSystem
- Rimuovere codice estratto
- Aggiungere riferimento a NetworkStateManager
- Delegare chiamate a NetworkStateManager
- Test: verifica connessione/disconnessione/riconnessione

**Righe rimosse**: ~200-250

### Fase 3: Estrazione NetworkInitializationManager (Priorità ALTA)
**Step 3.1**: Creare NetworkInitializationManager.ts
- Estrarre proprietà inizializzazione
- Estrarre logica setup constructor
- Estrarre registerMessageHandlers()
- Estrarre handleConnected() con JWT validation e JOIN
- Estrarre initialize(), markAsInitialized(), isSystemInitialized()

**Step 3.2**: Aggiornare ClientNetworkSystem
- Rimuovere codice estratto
- Aggiungere riferimento a NetworkInitializationManager
- Delegare chiamate a NetworkInitializationManager
- Test: verifica inizializzazione e handshake

**Righe rimosse**: ~300-350

### Fase 4: Estrazione NetworkAuthenticationManager (Priorità MEDIA)
**Step 4.1**: Creare NetworkAuthenticationManager.ts
- Estrarre proprietà JWT auth
- Estrarre handleJwtAuthenticationError()
- Estrarre logica refresh session

**Step 4.2**: Aggiornare ClientNetworkSystem
- Rimuovere codice estratto
- Aggiungere riferimento a NetworkAuthenticationManager
- Delegare chiamate a NetworkAuthenticationManager
- Test: verifica autenticazione e retry

**Righe rimosse**: ~150-200

### Fase 5: Estrazione NetworkPositionSyncManager (Priorità MEDIA)
**Step 5.1**: Creare NetworkPositionSyncManager.ts
- Estrarre sendPlayerPosition()
- Estrarre isValidPosition()
- Estrarre getCurrentPlayerVelocity() (o estendere PlayerPositionTracker)

**Step 5.2**: Aggiornare ClientNetworkSystem
- Rimuovere codice estratto
- Aggiungere riferimento a NetworkPositionSyncManager
- Delegare chiamate a NetworkPositionSyncManager
- Test: verifica sincronizzazione posizione

**Righe rimosse**: ~200-250

### Fase 6: Estrazione NetworkCombatManager (Priorità MEDIA)
**Step 6.1**: Creare NetworkCombatManager.ts
- Estrarre sendStartCombat()
- Estrarre sendStopCombat()
- Estrarre sendProjectileFired()

**Step 6.2**: Aggiornare ClientNetworkSystem
- Rimuovere codice estratto
- Aggiungere riferimento a NetworkCombatManager
- Delegare chiamate a NetworkCombatManager
- Test: verifica combattimento

**Righe rimosse**: ~150-200

### Fase 7: Estrazione NetworkPlayerDataManager (Priorità BASSA)
**Step 7.1**: Creare NetworkPlayerDataManager.ts
- Estrarre requestSkillUpgrade()
- Estrarre requestPlayerData()

**Step 7.2**: Aggiornare ClientNetworkSystem
- Rimuovere codice estratto
- Aggiungere riferimento a NetworkPlayerDataManager
- Delegare chiamate a NetworkPlayerDataManager
- Test: verifica richieste dati player

**Righe rimosse**: ~80-100

### Fase 8: Estrazione NetworkChatManager (Priorità BASSA - OPZIONALE)
**Step 8.1**: Creare NetworkChatManager.ts O estendere ChatMessageHandler
- Estrarre sendChatMessage()

**Step 8.2**: Aggiornare ClientNetworkSystem
- Rimuovere codice estratto
- Aggiungere riferimento a NetworkChatManager
- Delegare chiamate a NetworkChatManager
- Test: verifica chat

**Righe rimosse**: ~60-80

### Fase 9: Riallocazione in Moduli Esistenti (Priorità MEDIA)
**Step 9.1**: Estendere NetworkEventSystem
- Aggiungere showAuthenticationErrorToUser()
- Aggiungere showRateLimitNotification()

**Step 9.2**: Estendere PlayerPositionTracker
- Aggiungere getCurrentPlayerVelocity()

**Step 9.3**: Verificare ProjectileUpdateHandler
- Assicurarsi che handleProjectileUpdates() sia completo

### Fase 10: Pulizia e Ottimizzazione (Priorità ALTA)
**Step 10.1**: Rimuovere codice duplicato
**Step 10.2**: Semplificare handleMessage() se possibile
**Step 10.3**: Verificare tutte le API pubbliche ancora funzionanti
**Step 10.4**: Aggiornare commenti e documentazione
**Step 10.5**: Verificare metriche finali (< 500 righe)

### Fase 11: Testing Completo (Priorità ALTA)
**Step 11.1**: Test unitari per ogni nuovo modulo
**Step 11.2**: Test integrazione ClientNetworkSystem
**Step 11.3**: Test end-to-end multiplayer
**Step 11.4**: Verifica backward compatibility API pubblica

---

## Metriche Target

### Righe per Modulo
- **ClientNetworkSystem.ts**: < 500 righe (target: ~400-450)
- **NetworkStateManager.ts**: ~200-250 righe
- **NetworkInitializationManager.ts**: ~300-350 righe
- **NetworkAuthenticationManager.ts**: ~150-200 righe
- **NetworkPositionSyncManager.ts**: ~200-250 righe
- **NetworkCombatManager.ts**: ~150-200 righe
- **NetworkPlayerDataManager.ts**: ~80-100 righe
- **NetworkChatManager.ts**: ~60-80 righe (opzionale)

### Responsabilità per Modulo
- **ClientNetworkSystem**: Orchestrazione, API pubblica, delegazione
- **NetworkStateManager**: Stato connessione, riconnessione, heartbeat
- **NetworkInitializationManager**: Setup, handshake, init
- **NetworkAuthenticationManager**: JWT auth, retry, refresh
- **NetworkPositionSyncManager**: Sincronizzazione posizione, validazione
- **NetworkCombatManager**: Messaggi combattimento
- **NetworkPlayerDataManager**: Richieste dati player
- **NetworkChatManager**: Messaggi chat

### Testabilità
- Ogni modulo testabile in isolamento
- Dipendenze iniettate via constructor
- Mock facilmente sostituibili
- API pubblica invariata (backward compatible)

### Manutenibilità
- Single Responsibility Principle rispettato
- Dipendenze chiare e documentate
- Codice duplicato minimizzato
- Commenti aggiornati

---

## Note e Considerazioni

### Decisioni Architetturali
1. **NetworkPositionSyncManager vs estendere PlayerPositionTracker**:
   - Se la logica di validazione e invio diventa complessa (> 200 righe), creare modulo separato
   - Altrimenti estendere PlayerPositionTracker

2. **NetworkChatManager vs estendere ChatMessageHandler**:
   - Se sendChatMessage() ha logica complessa, creare modulo
   - Altrimenti estendere handler esistente

3. **handleProjectileUpdates()**:
   - Verificare se ProjectileUpdateHandler già gestisce completamente
   - Se no, estendere handler invece di creare nuovo modulo

### Rischi
1. **Breaking Changes**: Mantenere tutte le API pubbliche identiche
2. **Dipendenze Circolari**: Evitare riferimenti circolari tra moduli
3. **Performance**: Verificare che delegazione non introduca overhead significativo
4. **Testing**: Assicurarsi che tutti i test esistenti continuino a funzionare

### Backward Compatibility
- Tutte le API pubbliche di ClientNetworkSystem devono rimanere identiche
- Metodi pubblici devono mantenere stessa signature
- Comportamento deve essere identico (solo refactoring interno)

---

## Checklist Refactoring

- [ ] Fase 1: Preparazione
- [ ] Fase 2: NetworkStateManager
- [ ] Fase 3: NetworkInitializationManager
- [ ] Fase 4: NetworkAuthenticationManager
- [ ] Fase 5: NetworkPositionSyncManager
- [ ] Fase 6: NetworkCombatManager
- [ ] Fase 7: NetworkPlayerDataManager
- [ ] Fase 8: NetworkChatManager (opzionale)
- [ ] Fase 9: Riallocazione moduli esistenti
- [ ] Fase 10: Pulizia e ottimizzazione
- [ ] Fase 11: Testing completo
- [ ] Verifica metriche finali (< 500 righe)
- [ ] Verifica backward compatibility
- [ ] Documentazione aggiornata
