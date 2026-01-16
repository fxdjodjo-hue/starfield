# CombatSystem Managers

Questo documento descrive l'architettura modulare del `CombatSystem`, refactorizzato da 634 righe a 155 righe.

## Architettura

Il `CombatSystem` è stato suddiviso in 4 manager specializzati, ognuno con una responsabilità specifica:

### 1. CombatStateManager
**Responsabilità**: Gestione dello stato del combattimento, processamento del combattimento del player, invio richieste start/stop al server, logging degli attacchi.

**Metodi principali**:
- `processPlayerCombat()`: Processa lo stato del combattimento del player e invia richieste al server
- `sendStartCombat()`: Invia richiesta di inizio combattimento al server
- `sendStopCombat()`: Invia richiesta di fine combattimento al server
- `startAttackLogging()`: Inizia il logging di un attacco
- `endAttackLogging()`: Termina il logging di un attacco
- `stopCombatImmediately()`: Ferma immediatamente il combattimento
- `reset()`: Reset dello stato del combattimento

**Dipendenze**:
- `ECS`, `PlayerSystem`, `CameraSystem`, `GameContext`
- Getter callbacks: `PlayerControlSystem`, `ClientNetworkSystem`, `LogSystem`

### 2. CombatProjectileManager
**Responsabilità**: Creazione di proiettili e esecuzione degli attacchi.

**Metodi principali**:
- `performAttack()`: Esegue un attacco da un attaccante verso un target
- `createSingleLaser()`: Crea un singolo laser per il player
- `createSingleProjectile()`: Crea un singolo proiettile (usato dagli NPC)
- `createProjectileAt()`: Crea un proiettile in una posizione e direzione specifica (per il player crea 2 laser visivi)
- `faceTarget()`: Ruota l'entità attaccante per puntare verso il target
- `facePlayer()`: Ruota l'NPC verso il player

**Dipendenze**:
- `ECS`, `PlayerSystem`
- Getter callback: `ClientNetworkSystem`

### 3. CombatDamageManager
**Responsabilità**: Creazione e gestione dei testi di danno.

**Metodi principali**:
- `createDamageText()`: Crea un testo di danno per un'entità
- `hasRecentShieldDamage()`: Controlla se l'entità ha subito danno shield recentemente
- `decrementDamageTextCount()`: Decrementa il contatore dei testi di danno attivi
- `clear()`: Pulisce tutte le risorse

**Dipendenze**:
- `ECS`, `PlayerSystem`

### 4. CombatExplosionManager
**Responsabilità**: Creazione di esplosioni e rimozione di entità morte.

**Metodi principali**:
- `createExplosion()`: Crea un effetto esplosione per un'entità morta
- `loadExplosionFrames()`: Carica tutti i frame dell'animazione dell'esplosione
- `removeDeadEntities()`: Rimuove tutte le entità morte dal mondo
- `isExploding()`: Verifica se un'entità è in esplosione
- `markAsExploding()`: Marca un'entità come in esplosione
- `setPreloadedExplosionFrames()`: Imposta i frame dell'esplosione precaricati
- `clear()`: Pulisce tutte le risorse

**Dipendenze**:
- `ECS`
- Getter callbacks: `ClientNetworkSystem`, `getPreloadedFrames`
- Setter callback: `setPreloadedFrames`

## Pattern di Dependency Injection

Tutti i manager utilizzano **dependency injection** per evitare dipendenze circolari:

1. **Dipendenze dirette**: Passate come parametri del costruttore (es. `ECS`, `PlayerSystem`)
2. **Dipendenze opzionali/lazy**: Passate come getter callbacks (es. `() => this.clientNetworkSystem`)
3. **Dipendenze bidirezionali**: Passate come setter callbacks quando necessario (es. `setPreloadedFrames`)

## Inizializzazione Lazy

I manager vengono inizializzati in modo lazy (al primo utilizzo) tramite `initializeManagers()` nel `CombatSystem`. Questo permette di:
- Evitare problemi di ordine di inizializzazione
- Permettere ai setter (`setClientNetworkSystem`, `setLogSystem`, ecc.) di essere chiamati prima dell'inizializzazione

## API Pubbliche Mantenute

Tutte le API pubbliche del `CombatSystem` sono state mantenute per backward compatibility:
- `update(deltaTime: number)`: Delegato a `stateManager.processPlayerCombat()` e `explosionManager.removeDeadEntities()`
- `createDamageText(...)`: Delegato a `damageManager.createDamageText()`
- `decrementDamageTextCount(...)`: Delegato a `damageManager.decrementDamageTextCount()`
- `stopCombatImmediately()`: Delegato a `stateManager.stopCombatImmediately()`
- `destroy()`: Chiama `clear()` su tutti i manager
- `setClientNetworkSystem(...)`, `setAudioSystem(...)`, `setPlayerControlSystem(...)`, `setLogSystem(...)`, `setPreloadedExplosionFrames(...)`: Mantenuti per configurazione

## Note

- Il metodo `processNpcCombat()` è stato rimosso perché non più utilizzato (NPC combat gestito lato server)
- I metodi privati `faceTarget()` e `facePlayer()` sono stati spostati in `CombatProjectileManager`
- La gestione delle esplosioni è stata completamente estratta in `CombatExplosionManager`
- Il logging degli attacchi è gestito da `CombatStateManager`
