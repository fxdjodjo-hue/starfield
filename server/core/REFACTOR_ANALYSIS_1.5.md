# Refactor Analysis FASE 1.5 — Map Server

## 📊 Analisi File Originale

**File**: `server/core/map-server.cjs`
- **Righe totali**: 488
- **Metodi principali**: 12
- **Responsabilità multiple**: 4 aree logiche distinte

## 🔍 Sezioni Logiche Identificate

### 1. **NpcMovementSystem** (~280 righe)
**Responsabilità**: Logica di movimento NPC con comportamenti complessi

**Metodi da spostare:**
- `updateNpcMovements()` (linee 138-420) - **CRITICO**: Logica movimento completa
  - Validazione posizione/velocity
  - Calcolo comportamento (flee, aggressive, cruise)
  - Switch case per comportamenti (aggressive: ~80 righe, flee: ~45 righe, cruise: ~12 righe)
  - Boundary collision e rimbalzo
  - Calcolo movimento significativo
  - Aggiornamento rotazione

**Dipendenze:**
- `this.npcManager` (getAllNpcs, WORLD_LEFT/RIGHT/TOP/BOTTOM)
- `this.players` (per cercare target players)
- `NPC_CONFIG` (stats.speed, stats.range)
- `SERVER_CONSTANTS` (TIMEOUTS.DAMAGE_TIMEOUT)

**Complessità:**
- Logica comportamenti NPC molto complessa
- Validazioni multiple (NaN, finite, bounds)
- Calcoli di distanza e direzione
- Gestione boundary collision

### 2. **MapBroadcaster** (~80 righe)
**Responsabilità**: Broadcasting messaggi ai client connessi

**Metodi da spostare:**
- `broadcastToMap(message, excludeClientId)` (linee 86-114) - Broadcast base
- `broadcastNear(position, radius, message, excludeClientId)` (linee 117-135) - Broadcast con raggio
- `broadcastNpcUpdates()` (linee 423-457) - Broadcast aggiornamenti NPC

**Dipendenze:**
- `this.players` (Map di clientId -> playerData)
- `this.npcManager` (getAllNpcs)
- `SERVER_CONSTANTS.NETWORK.WORLD_RADIUS`
- `WebSocket` (readyState, send)

**Complessità:**
- Gestione WebSocket states
- Calcolo distanze per filtering
- Formattazione messaggi NPC

### 3. **PositionUpdateProcessor** (~25 righe)
**Responsabilità**: Processamento queue aggiornamenti posizione player

**Metodi da spostare:**
- `processPositionUpdates()` (linee 460-484) - Processa queue posizioni

**Dipendenze:**
- `this.positionUpdateQueue` (Map clientId -> Array updates)
- `this.broadcastToMap()` (delegato a MapBroadcaster)

**Complessità:**
- Bassa: prende ultimo update e broadcasta

### 4. **MapServer Orchestrator** (resto)
**Responsabilità**: Coordinamento moduli e gestione mappa base

**Metodi che rimangono:**
- `constructor()` - Setup iniziale
- `initialize()` - Inizializzazione mappa
- `addPlayer()` / `removePlayer()` - Gestione players
- `getAllNpcs()` / `getNpc()` / `createNpc()` - Delegati a npcManager
- `tick()` - Orchestrator principale (chiama moduli)

**Dipendenze:**
- Tutti i moduli specializzati
- `this.npcManager`, `this.projectileManager`
- `this.players`, `this.positionUpdateQueue`

## 📦 Moduli Proposti

### 1. `NpcMovementSystem.cjs`
**Responsabilità**: Movimento e comportamenti NPC

**Metodi:**
- `updateMovements(allNpcs, players, npcManager, deltaTime)`
- `calculateBehavior(npc, now, players)` - Determina comportamento
- `applyAggressiveMovement(npc, players, speed, deltaTime, attackRange)`
- `applyFleeMovement(npc, players, speed, deltaTime, attackRange)`
- `applyCruiseMovement(npc, speed, deltaTime)`
- `applyBoundaryCollision(npc, newX, newY, worldBounds)`
- `validateAndResetPosition(npc, newX, newY, deltaX, deltaY, speed, deltaTime)`

**Dipendenze:**
- `NPC_CONFIG`, `SERVER_CONSTANTS`
- `npcManager` (per world bounds)
- `players` (per target detection)

### 2. `MapBroadcaster.cjs`
**Responsabilità**: Broadcasting messaggi ai client

**Metodi:**
- `broadcastToMap(players, message, excludeClientId)`
- `broadcastNear(players, position, radius, message, excludeClientId)`
- `broadcastNpcUpdates(players, npcs, worldRadius)`

**Dipendenze:**
- `SERVER_CONSTANTS.NETWORK.WORLD_RADIUS`
- `WebSocket` (per readyState)

### 3. `PositionUpdateProcessor.cjs`
**Responsabilità**: Processamento queue aggiornamenti posizione

**Metodi:**
- `processUpdates(positionUpdateQueue, broadcaster)`

**Dipendenze:**
- `MapBroadcaster` (per broadcast)

## 🎯 Obiettivi Refactor

**Orchestratore finale**: `map-server.cjs` < 300 righe

**Riduzione stimata**:
- Originale: 488 righe
- Dopo estrazione: ~200-250 righe (orchestratore)
- Moduli: ~280 + ~80 + ~25 = ~385 righe totali

**Vantaggi**:
- Separazione logica movimento NPC (complessità isolata)
- Broadcasting riutilizzabile
- Testabilità migliorata (movement system testabile isolatamente)
- Manutenibilità (comportamenti NPC in un unico modulo)

## 🔧 Strategia di Estrazione

1. **Step 1**: Creare `MapBroadcaster.cjs` (più semplice, meno dipendenze)
2. **Step 2**: Creare `PositionUpdateProcessor.cjs` (usa MapBroadcaster)
3. **Step 3**: Creare `NpcMovementSystem.cjs` (più complesso, estrarre gradualmente)
4. **Step 4**: Aggiornare `map-server.cjs` per usare i moduli

## ⚠️ Note Critiche

- `updateNpcMovements()` è molto complesso (~280 righe)
- Logica comportamenti NPC strettamente accoppiata
- Validazioni multiple per NaN/finite
- Boundary collision logic integrata nel movimento
- Dipendenza da `this.npcManager.WORLD_*` (getter già presenti)

## ✅ Criteri di Successo

- Orchestratore < 300 righe ✅
- Moduli con responsabilità singola ✅
- API pubblica invariata (tick(), addPlayer(), etc.) ✅
- Nessun cambiamento di gameplay ✅
- Test runtime: movimento NPC, broadcasting, posizioni ✅
