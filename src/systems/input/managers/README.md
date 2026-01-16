# PlayerControlSystem Managers

Questo documento descrive l'architettura modulare del `PlayerControlSystem`, refactorizzato da 613 righe a 227 righe.

## Architettura

Il `PlayerControlSystem` è stato suddiviso in 4 manager specializzati, ognuno con una responsabilità specifica:

### 1. PlayerAudioManager
**Responsabilità**: Gestione suono motore del player.

**Metodi principali**:
- `start()`: Avvia il suono del motore con fade in
- `stop()`: Ferma il suono del motore con fade out
- `isPlaying()`: Verifica se il suono è in riproduzione
- `setEngineSoundPromise()` / `getEngineSoundPromise()`: Gestione promise per evitare chiamate concorrenti

**Dipendenze**:
- Getter callback: `getAudioSystem()`

### 2. PlayerInputManager
**Responsabilità**: Gestione input utente (tastiera, mouse).

**Metodi principali**:
- `handleKeyPress(key: string)`: Gestisce pressione tasti (WASD per movimento)
- `handleKeyRelease(key: string)`: Gestisce rilascio tasti
- `handleMouseState(pressed, x, y)`: Gestisce stato mouse (premuto/rilasciato)
- `handleMouseMoveWhilePressed(x, y)`: Gestisce movimento mouse mentre premuto
- `isKeyboardMoving()`: Verifica se ci sono tasti movimento premuti

**Dipendenze**:
- `ECS`
- Callback per SPACE: `onSpacePress()` (delega a `PlayerAttackManager`)
- Callback opzionale per mouse state: `onMouseStateCallback`

### 3. PlayerMovementManager
**Responsabilità**: Gestione movimento player (mouse, tastiera WASD, minimappa).

**Metodi principali**:
- `movePlayerTo(worldX, worldY)`: Imposta destinazione per movimento minimappa
- `movePlayerTowardsMinimapTarget()`: Muove player verso target minimappa
- `movePlayerTowardsMouse()`: Muove player verso posizione mouse
- `movePlayerWithKeyboard()`: Muove player con tasti WASD
- `stopPlayerMovement()`: Ferma il movimento del player
- `hasMinimapTarget()`: Verifica se c'è un target minimappa
- `clearMinimapTarget()`: Pulisce target minimappa
- `setMinimapMovementCompleteCallback()`: Imposta callback per completamento movimento

**Dipendenze**:
- `ECS`
- Getter callbacks: `getPlayerEntity()`, `getCamera()`, `getIsMousePressed()`, `getLastMouseX()`, `getLastMouseY()`, `getKeysPressed()`
- Setter callback: `setIsMousePressed()`

### 4. PlayerAttackManager
**Responsabilità**: Gestione attacco, selezione NPC, validazione range.

**Metodi principali**:
- `handleSpacePress()`: Gestisce pressione SPACE per attacco (toggle mode)
- `handleKeyPress(key: string)`: Gestisce pressione SPACE con logica completa (selezione automatica NPC)
- `isAttackActivated()`: Verifica se l'attacco è attivo
- `deactivateAttack()`: Disattiva l'attacco
- `faceSelectedNpc()`: Ruota player verso NPC selezionato durante combattimento

**Metodi privati**:
- `findNearestNpcInRange()`: Trova NPC più vicino entro range attacco
- `findNearbyNpcForSelection()`: Trova NPC vicino per selezione automatica (600px)
- `isSelectedNpcInRange()`: Verifica se NPC selezionato è in range
- `isNpcInPlayerRange()`: Verifica se NPC specifico è in range
- `showOutOfRangeMessage()`: Mostra messaggio "out of range"
- `selectNpc()`: Seleziona un NPC
- `deselectAllNpcs()`: Deseleziona tutti gli NPC

**Dipendenze**:
- `ECS`
- Getter callbacks: `getPlayerEntity()`, `getLogSystem()`
- Callback per combattimento: `forceCombatCheck()`, `stopCombatIfActive()`
- Setter callback: `setAttackActivated()`

## Pattern di Dependency Injection

Tutti i manager utilizzano **dependency injection** per evitare dipendenze circolari:

1. **Dipendenze dirette**: Passate come parametri del costruttore (es. `ECS`)
2. **Dipendenze opzionali/lazy**: Passate come getter callbacks (es. `() => this.audioSystem`)
3. **Dipendenze bidirezionali**: Passate come setter callbacks quando necessario (es. `setAttackActivated`)

## Inizializzazione Lazy

I manager vengono inizializzati in modo lazy (al primo utilizzo) tramite `initializeManagers()` nel `PlayerControlSystem`. Questo permette di:
- Evitare problemi di ordine di inizializzazione
- Permettere ai setter (`setAudioSystem`, `setLogSystem`, ecc.) di essere chiamati prima dell'inizializzazione

## API Pubbliche Mantenute

Tutte le API pubbliche del `PlayerControlSystem` sono state mantenute per backward compatibility:
- `update(deltaTime: number)`: Delegato ai manager (movimento, audio, attacco)
- `handleKeyPress(key)` / `handleKeyRelease(key)`: Delegati a `PlayerInputManager` e `PlayerAttackManager`
- `handleMouseState(pressed, x, y)` / `handleMouseMoveWhilePressed(x, y)`: Delegati a `PlayerInputManager`
- `movePlayerTo(worldX, worldY)`: Delegato a `PlayerMovementManager`
- `isAttackActivated()`: Delegato a `PlayerAttackManager`
- `deactivateAttack()`: Delegato a `PlayerAttackManager`
- `setPlayerEntity()`, `setCamera()`, `setAudioSystem()`, `setLogSystem()`, `setMouseStateCallback()`, `setMinimapMovementCompleteCallback()`: Mantenuti per configurazione

## Note

- Il metodo `getPlayerSpeed()` è stato spostato in `PlayerMovementManager` come metodo privato
- La gestione del suono motore è completamente estratta in `PlayerAudioManager`
- La logica di selezione NPC è gestita da `PlayerAttackManager`
- Il movimento è gestito da `PlayerMovementManager` con priorità: minimappa > tastiera > mouse
