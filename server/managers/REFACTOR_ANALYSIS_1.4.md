# FASE 1.4 - Analisi NPC Manager

## File Originale
- **File**: `server/managers/npc-manager.cjs`
- **Righe**: 499
- **Obiettivo**: Orchestratore < 300 righe

## Mappatura Responsabilità

### 1. NpcSpawner.cjs (Creazione e Inizializzazione)
- `createNpc()` (linee 60-106) - Creazione singolo NPC
- `initializeWorldNpcs()` (linee 482-495) - Inizializzazione bulk
- `updateNpc()` (linee 111-129) - Aggiornamento stato NPC

**Dipendenze**: `logger`, `NPC_CONFIG`, `mapServer.npcs`, `npcIdCounter`

### 2. NpcRespawnSystem.cjs (Sistema Respawn)
- `startRespawnTimer()` (linee 34-40) - Avvia timer
- `stopRespawnTimer()` (linee 45-51) - Ferma timer
- `scheduleRespawn()` (linee 328-338) - Pianifica respawn
- `processRespawnQueue()` (linee 343-360) - Processa coda
- `respawnNpc()` (linee 365-382) - Esegue respawn
- `findSafeRespawnPosition()` (linee 387-406) - Trova posizione sicura
- `isPositionSafeFromPlayers()` (linee 411-429) - Verifica sicurezza

**Dipendenze**: `logger`, `mapServer`, `WORLD_*`, `respawnQueue`, `respawnCheckInterval`

### 3. NpcDamageHandler.cjs (Gestione Danno)
- `damageNpc()` (linee 155-185) - Danno a NPC
- `damagePlayer()` (linee 190-217) - Danno a player
- `removeNpc()` (linee 222-237) - Rimuove NPC e pianifica respawn

**Dipendenze**: `logger`, `mapServer`, `npcs Map`

### 4. NpcRewardSystem.cjs (Sistema Ricompense)
- `awardNpcKillRewards()` (linee 242-287) - Assegna ricompense
- `sendRewardsNotification()` (linee 292-323) - Invia notifica client

**Dipendenze**: `logger`, `NPC_CONFIG`, `mapServer.players`, `mapServer.websocketManager`

### 5. NpcBroadcaster.cjs (Broadcasting Eventi)
- `broadcastNpcSpawn()` (linee 434-453) - Broadcast spawn NPC

**Dipendenze**: `mapServer.broadcastNear`, `npcs Map`

## Metodi che rimangono nell'Orchestratore
- `getNpc()` (linee 134-136) - Getter semplice
- `getAllNpcs()` (linee 141-143) - Getter semplice
- `getNpcsNeedingUpdate()` (linee 148-150) - Query con filtro
- `getStats()` (linee 467-477) - Statistiche
- `destroy()` (linee 458-462) - Cleanup

## API Pubblica da Mantenere (Backward Compatible)
- `createNpc(type, x, y, silent)`
- `updateNpc(npcId, updates)`
- `getNpc(npcId)`
- `getAllNpcs()`
- `getNpcsNeedingUpdate(since)`
- `damageNpc(npcId, damage, attackerId)`
- `damagePlayer(clientId, damage, attackerId)`
- `removeNpc(npcId)`
- `initializeWorldNpcs(scouterCount, frigateCount)`
- `getStats()`
- `destroy()`

## Note
- `handlePlayerDeath()` non esiste in questo file, probabilmente è in `combat-manager.cjs`
- Il respawn system deve accedere a `createNpc()` e `broadcastNpcSpawn()` → dependency injection
- Il damage handler deve accedere a `removeNpc()` e `awardNpcKillRewards()` → dependency injection
