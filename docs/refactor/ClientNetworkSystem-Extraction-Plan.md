# Piano di Estrazione ClientNetworkSystem.ts

## Riepilogo Estrazioni

| Modulo | Linee | Righe Stimate | Priorità |
|--------|------|---------------|----------|
| **NetworkStateManager** | 63-69, 131-135, 531-553, 558-564, 569-575, 617-662, 702-716 | ~250 | ALTA |
| **NetworkInitializationManager** | 119-122, 137-177 (parte), 234-275, 375-427, 1313-1341 | ~350 | ALTA |
| **NetworkAuthenticationManager** | 124-129, 280-330 | ~200 | MEDIA |
| **NetworkPositionSyncManager** | 728-753, 761-826, 831-850 | ~250 | MEDIA |
| **NetworkCombatManager** | 1044-1074, 1079-1095, 1100-1130 | ~200 | MEDIA |
| **NetworkPlayerDataManager** | 1145-1162, 1361-1375 | ~100 | BASSA |
| **NetworkChatManager** | 1167-1196 | ~80 | BASSA (opzionale) |
| **NetworkEventSystem** (estendere) | 335-346, 351-370 | ~40 | MEDIA |
| **PlayerPositionTracker** (estendere) | 728-753 | ~25 | MEDIA |
| **Totale da rimuovere** | | **~1495** | |
| **Righe finali ClientNetworkSystem** | | **~400-450** | ✅ |

---

## Mappa Dettagliata Estrazioni

### NetworkStateManager.ts
```typescript
// Linee 63-69: ConnectionState enum
enum ConnectionState { ... }

// Linee 131-135: Proprietà connection state
private connectionState = ConnectionState.DISCONNECTED;
private connectionPromise: Promise<void> | null = null;
private connectionResolver: (() => void) | null = null;
private connectionRejector: ((error: Error) => void) | null = null;

// Linee 531-553: handleDisconnected()
private handleDisconnected(): void { ... }

// Linee 558-564: handleConnectionError()
private handleConnectionError(error: Event): void { ... }

// Linee 569-575: handleReconnecting()
private handleReconnecting(): void { ... }

// Linee 617-662: connect()
async connect(): Promise<void> { ... }

// Linee 702-716: sendHeartbeat()
private sendHeartbeat(): void { ... }
```

### NetworkInitializationManager.ts
```typescript
// Linee 119-122: Proprietà inizializzazione
private initializationPromise: Promise<void> | null = null;
private initializationResolver: (() => void) | null = null;
private isInitialized = false;

// Linee 137-177: Constructor setup (parte inizializzazione)
// - Inizializzazione componenti modulari
// - Setup messageRouter
// - registerMessageHandlers()

// Linee 234-275: registerMessageHandlers()
private registerMessageHandlers(): void { ... }

// Linee 375-427: handleConnected()
private async handleConnected(socket: WebSocket): Promise<void> {
  // Reset tick manager
  // Notify callbacks
  // JWT validation
  // Send JOIN message
}

// Linee 1313-1341: Initialization API
initialize(): Promise<void> { ... }
markAsInitialized(): void { ... }
isSystemInitialized(): boolean { ... }
```

### NetworkAuthenticationManager.ts
```typescript
// Linee 124-129: Proprietà JWT auth
private jwtRetryCount = 0;
private maxJwtRetries = 3;
private jwtRetryDelay = 2000;
private jwtRetryTimeout: NodeJS.Timeout | null = null;
private isRetryingJwt = false;

// Linee 280-330: handleJwtAuthenticationError()
private handleJwtAuthenticationError(reason: string): void {
  // Retry logic
  // Exponential backoff
  // Session refresh
}
```

### NetworkPositionSyncManager.ts
```typescript
// Linee 728-753: getCurrentPlayerVelocity()
private getCurrentPlayerVelocity(): { x: number; y: number } { ... }

// Linee 761-826: sendPlayerPosition()
private sendPlayerPosition(position: { x: number; y: number; rotation: number }): void {
  // Welcome check
  // Rotation normalization
  // Velocity extraction
  // Rate limiting
  // Position validation
  // Send message
}

// Linee 831-850: isValidPosition()
private isValidPosition(pos: {...}): boolean { ... }
```

### NetworkCombatManager.ts
```typescript
// Linee 1044-1074: sendStartCombat()
sendStartCombat(data: {...}): void {
  // Connection check
  // Rate limiting
  // Set current combat NPC
  // Send message
}

// Linee 1079-1095: sendStopCombat()
sendStopCombat(data: {...}): void { ... }

// Linee 1100-1130: sendProjectileFired()
sendProjectileFired(data: {...}): void {
  // Connection check
  // Rate limiting
  // Send message
}
```

### NetworkPlayerDataManager.ts
```typescript
// Linee 1145-1162: requestSkillUpgrade()
requestSkillUpgrade(upgradeType: 'hp' | 'shield' | 'speed' | 'damage'): void { ... }

// Linee 1361-1375: requestPlayerData()
requestPlayerData(playerId: string): void { ... }
```

### NetworkChatManager.ts (opzionale)
```typescript
// Linee 1167-1196: sendChatMessage()
sendChatMessage(content: string): void {
  // Connection check
  // Content validation
  // Rate limiting
  // Send message
}
```

### Estensioni Moduli Esistenti

#### NetworkEventSystem.ts
```typescript
// Linee 335-346: showAuthenticationErrorToUser()
private showAuthenticationErrorToUser(message: string): void { ... }

// Linee 351-370: showRateLimitNotification()
private showRateLimitNotification(actionType: string, waitTime?: number): void { ... }
```

#### PlayerPositionTracker.ts
```typescript
// Linee 728-753: getCurrentPlayerVelocity()
getCurrentPlayerVelocity(): { x: number; y: number } { ... }
```

---

## API Pubbliche da Mantenere (Backward Compatibility)

### Metodi Pubblici ClientNetworkSystem
```typescript
// Getter/Setter
getRemotePlayerSystem(): RemotePlayerSystem
setPlayerSystem(playerSystem: PlayerSystem): void
getPlayerSystem(): PlayerSystem | null
setHasReceivedWelcome(received: boolean): void
getPendingPosition(): {...} | null
clearPendingPosition(): void
setCurrentCombatNpcId(npcId: string | null): void
getCurrentCombatNpcId(): string | null
invalidatePositionCache(): void
getHasReceivedWelcome(): boolean

// Connection State
isConnected(): boolean
getConnectionState(): ConnectionState
connectToServer(): Promise<void>
disconnect(): void

// Remote Systems
getRemoteNpcSystem(): RemoteNpcSystem | null
setRemoteNpcSystem(remoteNpcSystem: RemoteNpcSystem): void
setRemoteProjectileSystem(remoteProjectileSystem: RemoteProjectileSystem): void
getRemoteProjectileSystem(): RemoteProjectileSystem | null

// ECS
setEcs(ecs: ECS): void
getECS(): ECS | null
stopCombat(): void

// External Systems
setAudioSystem(audioSystem: any): void
getAudioSystem(): any
setLogSystem(logSystem: any): void
getLogSystem(): any
setUiSystem(uiSystem: any): void
getUiSystem(): any
setEconomySystem(economySystem: any): void
getEconomySystem(): any
setRewardSystem(rewardSystem: any): void
getRewardSystem(): any

// Callbacks
onDisconnected(callback: () => void): void
onConnectionError(callback: (error: Event) => void): void
onReconnecting(callback: () => void): void
onReconnected(callback: () => void): void
onConnected(callback: () => void): void
setOnPlayerIdReceived(callback: (playerId: number) => void): void

// Message Router
getMessageRouter(): MessageRouter

// Explosions
sendExplosionCreated(data: {...}): void
createRemoteExplosion(message: {...}): Promise<void>
setPreloadedExplosionFrames(frames: HTMLImageElement[]): void

// Combat (delegati a NetworkCombatManager)
sendStartCombat(data: {...}): void
sendStopCombat(data: {...}): void
sendProjectileFired(data: {...}): void

// Player Data (delegati a NetworkPlayerDataManager)
requestSkillUpgrade(upgradeType: 'hp' | 'shield' | 'speed' | 'damage'): void
requestPlayerData(playerId: string): void

// Chat (delegato a NetworkChatManager)
sendChatMessage(content: string): void

// Utilities
getLocalClientId(): string
getRateLimiterStats()
resetAllUpgradeProgress(): void
getEntityDestroyedHandler(): any
initialize(): Promise<void>
markAsInitialized(): void
isSystemInitialized(): boolean
destroy(): void
```

---

## Ordine di Estrazione (Step-by-Step)

### Step 1: NetworkStateManager
**Motivo**: Base per gestione connessione, necessario per altri moduli

**Azioni**:
1. Creare `NetworkStateManager.ts`
2. Estrarre ConnectionState enum
3. Estrarre proprietà e metodi connection state
4. Aggiornare ClientNetworkSystem per usare NetworkStateManager
5. Test connessione/disconnessione

**Righe rimosse**: ~250

### Step 2: NetworkInitializationManager
**Motivo**: Setup iniziale, necessario per funzionamento sistema

**Azioni**:
1. Creare `NetworkInitializationManager.ts`
2. Estrarre proprietà e metodi inizializzazione
3. Estrarre registerMessageHandlers()
4. Estrarre handleConnected() (senza JWT - gestito da NetworkAuthenticationManager)
5. Aggiornare ClientNetworkSystem
6. Test inizializzazione

**Righe rimosse**: ~300

### Step 3: NetworkAuthenticationManager
**Motivo**: Separare logica autenticazione complessa

**Azioni**:
1. Creare `NetworkAuthenticationManager.ts`
2. Estrarre proprietà e metodi JWT
3. Integrare con handleConnected() in NetworkInitializationManager
4. Aggiornare ClientNetworkSystem
5. Test autenticazione e retry

**Righe rimosse**: ~200

### Step 4: NetworkPositionSyncManager
**Motivo**: Logica posizione complessa con validazione

**Azioni**:
1. Creare `NetworkPositionSyncManager.ts` O estendere PlayerPositionTracker
2. Estrarre metodi posizione
3. Aggiornare ClientNetworkSystem
4. Test sincronizzazione posizione

**Righe rimosse**: ~250

### Step 5: NetworkCombatManager
**Motivo**: Raggruppare messaggi combattimento

**Azioni**:
1. Creare `NetworkCombatManager.ts`
2. Estrarre metodi combattimento
3. Aggiornare ClientNetworkSystem (delegare API pubbliche)
4. Test combattimento

**Righe rimosse**: ~200

### Step 6: NetworkPlayerDataManager
**Motivo**: Raggruppare richieste dati player

**Azioni**:
1. Creare `NetworkPlayerDataManager.ts`
2. Estrarre metodi player data
3. Aggiornare ClientNetworkSystem (delegare API pubbliche)
4. Test richieste dati

**Righe rimosse**: ~100

### Step 7: NetworkChatManager (opzionale)
**Motivo**: Separare logica chat se complessa

**Azioni**:
1. Creare `NetworkChatManager.ts` O estendere ChatMessageHandler
2. Estrarre sendChatMessage()
3. Aggiornare ClientNetworkSystem
4. Test chat

**Righe rimosse**: ~80

### Step 8: Estensioni Moduli Esistenti
**Motivo**: Riutilizzare moduli esistenti invece di creare nuovi

**Azioni**:
1. Estendere NetworkEventSystem con notifiche
2. Estendere PlayerPositionTracker con velocità
3. Verificare ProjectileUpdateHandler
4. Test integrazione

**Righe rimosse**: ~65

### Step 9: Pulizia Finale
**Azioni**:
1. Rimuovere codice duplicato
2. Semplificare handleMessage()
3. Aggiornare commenti
4. Verificare metriche (< 500 righe)
5. Test completo end-to-end

---

## Verifica Finale

### Metriche Target
- [ ] ClientNetworkSystem.ts < 500 righe
- [ ] Ogni modulo < 350 righe
- [ ] Zero codice duplicato
- [ ] Tutte le API pubbliche funzionanti

### Test Coverage
- [ ] Test unitari per ogni nuovo modulo
- [ ] Test integrazione ClientNetworkSystem
- [ ] Test end-to-end multiplayer
- [ ] Test backward compatibility

### Documentazione
- [ ] Commenti aggiornati
- [ ] README moduli aggiornato
- [ ] Documentazione API pubblica
