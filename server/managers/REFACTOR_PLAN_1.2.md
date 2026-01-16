# 🎯 FASE 1.2 — Projectile Manager Refactor

## 📊 Situazione Attuale

**File**: `server/managers/projectile-manager.cjs`  
**Righe**: 819  
**Status**: ❌ Supera soglia (900 righe)  
**Responsabilità multiple**: ❌ Spawn, fisica, collisioni, homing, broadcasting, danni

## 🎯 Obiettivo

Portare `projectile-manager.cjs` allo stesso livello di qualità del networking (FASE 1.1).

### Criteri di Uscita

- ✅ Orchestratore < 300-400 righe
- ✅ Moduli separati per responsabilità
- ✅ Nessun cambiamento di gameplay
- ✅ Stesso metodo, stesso successo

## 📦 Moduli Proposti

### 1. **ProjectileSpawner.cjs**
**Responsabilità**: Creazione e registrazione proiettili

**Metodi**:
- `addProjectile()` - Registra nuovo proiettile
- `createProjectileData()` - Crea struttura dati proiettile
- `calculateInitialDistance()` - Calcola distanza iniziale per homing

**Dipendenze**: mapServer, logger

---

### 2. **ProjectilePhysics.cjs**
**Responsabilità**: Simulazione fisica e movimento

**Metodi**:
- `updateProjectile()` - Aggiorna posizione
- `updateProjectileHoming()` - Logica homing
- `simulateMovement()` - Simula movimento proiettile
- `calculateProjectileLifetime()` - Calcola timeout
- `isProjectileOrphaned()` - Verifica proiettile orfano
- `getMaxTargetDistance()` - Distanza massima per homing
- `getDistanceToTarget()` - Calcola distanza al target

**Dipendenze**: mapServer, logger

---

### 3. **ProjectileCollision.cjs**
**Responsabilità**: Rilevamento collisioni

**Metodi**:
- `checkCollisions()` - Loop principale collisioni
- `checkNpcCollision()` - Collisione con NPC
- `checkPlayerCollision()` - Collisione con player
- `checkSpecificTargetCollision()` - Collisione con target specifico
- `calculateCollisionRadius()` - Raggio collisione dinamico
- `isOutOfBounds()` - Verifica confini mondo

**Dipendenze**: mapServer, logger, npcManager

---

### 4. **ProjectileHoming.cjs**
**Responsabilità**: Logica homing avanzata

**Metodi**:
- `updateProjectileHoming()` - Aggiorna direzione homing
- `getTargetData()` - Recupera dati target (NPC/player)
- `calculateHomingDirection()` - Calcola direzione verso target
- `predictTargetPosition()` - Predizione posizione target

**Dipendenze**: mapServer, logger

---

### 5. **ProjectileBroadcaster.cjs**
**Responsabilità**: Broadcasting eventi proiettili

**Metodi**:
- `broadcastProjectileFired()` - Broadcast creazione proiettile
- `broadcastProjectileDestroyed()` - Broadcast distruzione
- `broadcastProjectileDestroyedAtPosition()` - Broadcast con posizione
- `broadcastEntityDamaged()` - Broadcast danno entità
- `broadcastEntityDestroyed()` - Broadcast distruzione entità
- `broadcastPlayerRespawn()` - Broadcast respawn player

**Dipendenze**: mapServer, logger, SERVER_CONSTANTS

---

### 6. **ProjectileDamageHandler.cjs**
**Responsabilità**: Gestione danni e morte

**Metodi**:
- `handleNpcDamage()` - Applica danno a NPC
- `handlePlayerDamage()` - Applica danno a player
- `handlePlayerDeath()` - Gestisce morte player
- `handlePlayerRespawn()` - Gestisce respawn player

**Dipendenze**: mapServer, logger, npcManager

---

## 🏗️ Struttura Finale

```
server/managers/
├── projectile-manager.cjs          ✅ Orchestratore (< 400 righe)
└── projectile/
    ├── ProjectileSpawner.cjs       ✅ Spawn proiettili
    ├── ProjectilePhysics.cjs       ✅ Fisica e movimento
    ├── ProjectileCollision.cjs     ✅ Rilevamento collisioni
    ├── ProjectileHoming.cjs        ✅ Logica homing
    ├── ProjectileBroadcaster.cjs   ✅ Broadcasting eventi
    └── ProjectileDamageHandler.cjs ✅ Gestione danni
```

## 🔄 Strategia di Refactor

### Step 1: Analisi e Mapping
- [ ] Identificare tutte le responsabilità
- [ ] Mappare dipendenze tra metodi
- [ ] Definire interfacce dei moduli

### Step 2: Estrazione Moduli
- [ ] Creare `ProjectileSpawner.cjs`
- [ ] Creare `ProjectilePhysics.cjs`
- [ ] Creare `ProjectileCollision.cjs`
- [ ] Creare `ProjectileHoming.cjs`
- [ ] Creare `ProjectileBroadcaster.cjs`
- [ ] Creare `ProjectileDamageHandler.cjs`

### Step 3: Refactor Orchestratore
- [ ] Ridurre `projectile-manager.cjs` a orchestratore
- [ ] Dependency injection dei moduli
- [ ] Mantenere API pubblica identica

### Step 4: Testing
- [ ] Verificare spawn proiettili
- [ ] Verificare fisica/movimento
- [ ] Verificare collisioni
- [ ] Verificare homing
- [ ] Verificare broadcasting
- [ ] Verificare danni/morte

## ✅ Metriche di Successo

- **projectile-manager.cjs**: < 400 righe ✅
- **Moduli separati**: 6 moduli ✅
- **Responsabilità singola**: Ogni modulo ha una responsabilità ✅
- **Nessun cambio gameplay**: Comportamento identico ✅
- **Backward compatibility**: API pubblica invariata ✅

## 📝 Note

- Seguire lo stesso pattern della FASE 1.1
- Handler puri con context esplicito
- Dependency injection per testabilità
- Nessun cambiamento runtime
- Documentazione completa
