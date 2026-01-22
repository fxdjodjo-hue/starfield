# Piano Refactoring PlayerControlSystem.ts

## 📊 Analisi File Originale

**File**: `src/systems/input/PlayerControlSystem.ts`  
**Righe totali**: 613  
**Target**: < 500 righe  
**Riduzione necessaria**: ~113 righe (~18%)

## 🎯 Moduli Proposti

### 1. **PlayerInputManager** (~150 righe)
**Responsabilità**: Gestione input utente (tastiera, mouse, SPACE)

**Metodi da estrarre**:
- `handleKeyPress(key: string)` (linee 60-103)
- `handleKeyRelease(key: string)` (linee 108-113)
- `handleMouseState(pressed: boolean, x: number, y: number)` (linee 434-448)
- `handleMouseMoveWhilePressed(x: number, y: number)` (linee 453-459)
- `isKeyboardMoving()` (linee 610-613)

**Dipendenze**:
- `ECS`, `keysPressed` Set
- Callback per attacco: `handleSpacePress()`
- Callback per movimento: `onMouseStateCallback`

### 2. **PlayerMovementManager** (~200 righe)
**Responsabilità**: Gestione movimento player (mouse, tastiera WASD, minimappa)

**Metodi da estrarre**:
- `movePlayerTo(worldX: number, worldY: number)` (linee 465-474)
- `movePlayerTowardsMinimapTarget()` (linee 479-513)
- `movePlayerTowardsMouse()` (linee 518-553)
- `movePlayerWithKeyboard()` (linee 618-652)
- `stopPlayerMovement()` (linee 558-565)
- `getPlayerSpeed()` (linee 372-385)

**Dipendenze**:
- `ECS`, `playerEntity`, `camera`, `minimapTargetX/Y`
- `isMousePressed`, `lastMouseX/Y`, `keysPressed`
- `onMinimapMovementComplete` callback

### 3. **PlayerAttackManager** (~180 righe)
**Responsabilità**: Gestione attacco, selezione NPC, validazione range

**Metodi da estrarre**:
- `handleSpacePress()` (linee 119-152)
- `findNearestNpcInRange()` (linee 157-190)
- `findNearbyNpcForSelection()` (linee 658-685)
- `selectNpc(npcEntity: any, deactivateAttack: boolean)` (linee 690-713)
- `isSelectedNpcInRange()` (linee 196-223)
- `isNpcInPlayerRange(npcEntity: any)` (linee 228-246)
- `showOutOfRangeMessage()` (linee 251-259)
- `faceSelectedNpc()` (linee 585-605)
- `deactivateAttack()` (linee 295-302)
- `stopCombatIfActive()` (linee 570-579)
- `forceCombatCheck()` (linee 283-290)
- `deactivateAttackOnAnySelection()` (linee 718-726)
- `deselectAllNpcs()` (linee 731-736)

**Dipendenze**:
- `ECS`, `playerEntity`, `attackActivated`, `logSystem`
- `getPlayerAttackCooldown()` (metodo privato)
- Callback per `forceCombatCheck()`

### 4. **PlayerAudioManager** (~50 righe)
**Responsabilità**: Gestione suono motore

**Metodi da estrarre**:
- `startEngineSound()` (linee 328-346)
- `stopEngineSound()` (linee 351-367)
- `setAudioSystem(audioSystem: any)` (linee 314-316)

**Dipendenze**:
- `audioSystem`, `isEnginePlaying`, `engineSoundPromise`

## 📋 Piano Step-by-Step

### Fase 1: Preparazione

**Obiettivo**: Setup ambiente e struttura moduli

**Azioni**:
1. Creare branch `refactor/player-control-system-modularization`
2. Creare cartella `src/systems/input/managers/`
3. Creare skeleton dei moduli:
   - `PlayerInputManager.ts`
   - `PlayerMovementManager.ts`
   - `PlayerAttackManager.ts`
   - `PlayerAudioManager.ts`

**Verifica**:
- [ ] Branch creato
- [ ] Cartella creata
- [ ] Skeleton moduli con classi base e costruttori

---

### Fase 2: Estrazione Audio Manager

**Obiettivo**: Estrarre gestione audio (più semplice, meno dipendenze)

**Azioni**:
1. **PlayerAudioManager**:
   - Estrarre `startEngineSound()` → `PlayerAudioManager.start()`
   - Estrarre `stopEngineSound()` → `PlayerAudioManager.stop()`
   - Estrarre `setAudioSystem()` → `PlayerAudioManager.setAudioSystem()`
   - Aggiornare `PlayerControlSystem.update()` per delegare a `PlayerAudioManager`

**Test Incrementale**:
- [ ] Suono motore si avvia quando player si muove
- [ ] Suono motore si ferma quando player si ferma
- [ ] Fade in/out funziona correttamente

---

### Fase 3: Estrazione Input Manager

**Obiettivo**: Estrarre gestione input

**Azioni**:
1. **PlayerInputManager**:
   - Estrarre `handleKeyPress()` → `PlayerInputManager.handleKeyPress()`
   - Estrarre `handleKeyRelease()` → `PlayerInputManager.handleKeyRelease()`
   - Estrarre `handleMouseState()` → `PlayerInputManager.handleMouseState()`
   - Estrarre `handleMouseMoveWhilePressed()` → `PlayerInputManager.handleMouseMove()`
   - Estrarre `isKeyboardMoving()` → `PlayerInputManager.isKeyboardMoving()`
   - Aggiornare `PlayerControlSystem` per delegare input a `PlayerInputManager`
   - Passare callback per attacco e movimento

**Test Incrementale**:
- [ ] Input tastiera (WASD) funziona
- [ ] Input mouse (click-to-move) funziona
- [ ] SPACE per attacco funziona
- [ ] Selezione automatica NPC con SPACE funziona

---

### Fase 4: Estrazione Movement Manager

**Obiettivo**: Estrarre gestione movimento

**Azioni**:
1. **PlayerMovementManager**:
   - Estrarre `movePlayerTo()` → `PlayerMovementManager.moveTo()`
   - Estrarre `movePlayerTowardsMinimapTarget()` → `PlayerMovementManager.moveTowardsMinimapTarget()`
   - Estrarre `movePlayerTowardsMouse()` → `PlayerMovementManager.moveTowardsMouse()`
   - Estrarre `movePlayerWithKeyboard()` → `PlayerMovementManager.moveWithKeyboard()`
   - Estrarre `stopPlayerMovement()` → `PlayerMovementManager.stop()`
   - Estrarre `getPlayerSpeed()` → `PlayerMovementManager.getPlayerSpeed()`
   - Aggiornare `PlayerControlSystem.update()` per delegare movimento a `PlayerMovementManager`

**Test Incrementale**:
- [ ] Movimento mouse funziona
- [ ] Movimento tastiera (WASD) funziona
- [ ] Movimento minimappa funziona
- [ ] Rotazione player durante movimento funziona
- [ ] Priorità movimento (minimappa > tastiera > mouse) funziona

---

### Fase 5: Estrazione Attack Manager

**Obiettivo**: Estrarre gestione attacco e selezione NPC

**Azioni**:
1. **PlayerAttackManager**:
   - Estrarre tutti i metodi di attacco e selezione NPC
   - Aggiornare `PlayerControlSystem` per delegare attacco a `PlayerAttackManager`
   - Passare callback per `forceCombatCheck()` e `stopCombatIfActive()`

**Test Incrementale**:
- [ ] Selezione NPC con SPACE funziona
- [ ] Attivazione/disattivazione attacco funziona
- [ ] Validazione range funziona
- [ ] Rotazione verso NPC durante combattimento funziona
- [ ] Messaggi "out of range" funzionano

---

### Fase 6: Verifica API Pubblica

**Obiettivo**: Assicurare backward compatibility

**Metodi pubblici da mantenere**:
- ✅ `update(deltaTime: number)` - delegare a manager
- ✅ `setPlayerEntity(entity: any)` - mantenere, aggiornare manager
- ✅ `setCamera(camera: Camera)` - mantenere, aggiornare manager
- ✅ `setAudioSystem(audioSystem: any)` - delegare a `PlayerAudioManager`
- ✅ `setLogSystem(logSystem: LogSystem)` - mantenere, aggiornare manager
- ✅ `setMouseStateCallback(callback)` - delegare a `PlayerInputManager`
- ✅ `setMinimapMovementCompleteCallback(callback)` - delegare a `PlayerMovementManager`
- ✅ `movePlayerTo(worldX, worldY)` - delegare a `PlayerMovementManager`
- ✅ `handleKeyPress(key)` - delegare a `PlayerInputManager`
- ✅ `handleKeyRelease(key)` - delegare a `PlayerInputManager`
- ✅ `handleMouseState(pressed, x, y)` - delegare a `PlayerInputManager`
- ✅ `handleMouseMoveWhilePressed(x, y)` - delegare a `PlayerInputManager`
- ✅ `isAttackActivated()` - delegare a `PlayerAttackManager`
- ✅ `deactivateAttack()` - delegare a `PlayerAttackManager`

**Verifica**:
- [ ] Tutti i metodi pubblici funzionano senza modifiche
- [ ] Nessun breaking change per sistemi che usano `PlayerControlSystem`

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
- [ ] Movimento mouse funziona
- [ ] Movimento tastiera funziona
- [ ] Movimento minimappa funziona
- [ ] Attacco con SPACE funziona
- [ ] Selezione NPC funziona
- [ ] Suono motore funziona
- [ ] Rotazione durante combattimento funziona

**Test Regressione**:
- [ ] Tutte le funzionalità esistenti funzionano
- [ ] API pubbliche invariate
- [ ] Nessun breaking change

---

## 📐 Struttura Finale

```
src/systems/input/
├── PlayerControlSystem.ts (< 500 righe)
└── managers/
    ├── PlayerInputManager.ts (~150 righe)
    ├── PlayerMovementManager.ts (~200 righe)
    ├── PlayerAttackManager.ts (~180 righe)
    └── PlayerAudioManager.ts (~50 righe)
```

## 🔗 Dipendenze tra Moduli

```
PlayerControlSystem
├── PlayerInputManager
│   └── Callback per attacco → PlayerAttackManager
├── PlayerMovementManager
│   └── Callback per completamento movimento minimappa
├── PlayerAttackManager
│   └── Callback per forceCombatCheck, stopCombatIfActive
└── PlayerAudioManager
```

### ⚠️ Pattern Dependency Injection

**Soluzione - Dependency Injection**:
```typescript
// PlayerInputManager.ts
constructor(
  private readonly ecs: ECS,
  private readonly keysPressed: Set<string>,
  private readonly onSpacePress: () => void,
  private readonly onMouseState: (pressed: boolean, x: number, y: number) => void
) {}

// PlayerControlSystem.ts - Inizializzazione
const attackManager = new PlayerAttackManager(...);
const inputManager = new PlayerInputManager(
  this.ecs,
  this.keysPressed,
  () => attackManager.handleSpacePress(),
  (pressed, x, y) => { /* ... */ }
);
```

---

## ✅ Checklist Finale

- [ ] Fase 1: Preparazione completata
- [ ] Fase 2: Estrazione Audio Manager completata
- [ ] Fase 3: Estrazione Input Manager completata
- [ ] Fase 4: Estrazione Movement Manager completata
- [ ] Fase 5: Estrazione Attack Manager completata
- [ ] Fase 6: Verifica API Pubblica completata
- [ ] Fase 7: Pulizia completata
- [ ] Fase 8: Test Completo completato
- [ ] File < 500 righe
- [ ] Nessun breaking change
- [ ] Dependency injection implementata
- [ ] Documentazione README.md creata
