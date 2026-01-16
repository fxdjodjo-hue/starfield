# Refactor Step 1.1: Analisi websocket-manager.cjs

## ✅ Branch Creato
- **Branch**: `refactor/websocket-manager-split`
- **Status**: Pronto per refactor

## 📊 Analisi File Originale

**File**: `server/core/websocket-manager.cjs`
- **Righe totali**: 1287
- **Metodi principali**: 14
- **Responsabilità multiple**: 4 aree logiche distinte

## 🔍 Sezioni Logiche Identificate

### 1. **WebSocketConnectionManager** (~400 righe)
**Responsabilità**: Connessioni base, routing messaggi, event handlers

**Metodi da spostare:**
- `constructor()` - Setup iniziale
- `setupConnectionHandling()` (linee 336-1179) - **CRITICO**: Routing tutti i messaggi
- `setupShutdownHandling()` (linee 1222-1236) - Cleanup server
- `filterChatMessage()` (linee 1262-1284) - Filtro chat

**Dipendenze:**
- `logger.cjs`
- `InputValidator.cjs`
- `BoundaryEnforcement` (shared)
- `mapServer`
- `messageCount`

### 2. **PlayerDataManager** (~350 righe)
**Responsabilità**: Tutte le operazioni database Supabase

**Metodi da spostare:**
- `setupPeriodicSave()` (linee 35-54) - Salvataggio periodico ogni 5 min
- `loadPlayerData()` (linee 59-127) - Carica dati player
- `createInitialPlayerRecords()` (linee 132-167) - Crea record iniziali
- `savePlayerData()` (linee 172-261) - Salva dati player
- `saveHonorSnapshot()` (linee 266-280) - Snapshot honor
- `getRecentHonorAverage()` (linee 285-302) - Media honor 30 giorni
- `getDefaultPlayerData()` (linee 307-331) - Dati default

**Dipendenze:**
- `logger.cjs`
- `@supabase/supabase-js`
- `mapServer` (per iterare players)

### 3. **MessageBroadcaster** (~150 righe)
**Responsabilità**: Formattazione messaggi per broadcast

**Metodi da spostare:**
- `formatWelcomeMessage()` - Da linee 476-499
- `formatInitialNpcsMessage()` - Da linee 458-474
- `formatPlayerJoinedMessage()` - Da linee 434-439
- `formatPlayerLeftMessage()` - Da linee 1159-1162
- `formatCombatUpdateMessage()` - Da linee 851-859, 868-876
- `formatChatMessage()` - Da linee 1064-1070
- `formatLeaderboardResponse()` - Da linee 976-981
- `formatPlayerDataResponse()` - Da linee 1012-1020

**Dipendenze:**
- `logger.cjs`
- `mapServer` (per broadcasting, ma già delegato)

**Nota**: Il broadcasting effettivo è già in `mapServer.broadcastToMap()`, questo modulo contiene solo formattazione.

### 4. **AuthenticationManager** (~200 righe)
**Responsabilità**: Security checks e helper functions

**Metodi da spostare:**
- `validatePlayerId()` - Verifica playerId matching (usato in 5+ punti)
- `validateClientId()` - Verifica clientId matching (linee 1040-1048)
- `calculateMaxHealth()` (linee 1242-1246) - Helper calcolo health
- `calculateMaxShield()` (linee 1252-1256) - Helper calcolo shield
- `calculateRankName()` (linee 1184-1217) - Calcolo rank militare

**Dipendenze:**
- `logger.cjs`

**Nota**: Le validazioni principali sono già in `InputValidator` e `BoundaryEnforcement`. Questo modulo contiene solo helper inline.

## 📁 Struttura Creata

```
server/core/
├── connection/
│   └── WebSocketConnectionManager.cjs  ✅ Creato (skeleton + TODO)
├── database/
│   └── PlayerDataManager.cjs            ✅ Creato (skeleton + TODO)
├── messaging/
│   └── MessageBroadcaster.cjs          ✅ Creato (skeleton + TODO)
├── auth/
│   └── AuthenticationManager.cjs      ✅ Creato (skeleton + TODO)
├── websocket-manager.cjs               ⚠️ Originale (invariato)
└── REFACTOR_PLAN.md                    ✅ Documentazione
```

## 🗺️ Mappa Completa Sezione → Modulo

| Linee Originali | Sezione | Nuovo Modulo | Priorità |
|----------------|---------|--------------|----------|
| 14-30 | Constructor | WebSocketConnectionManager | Alta |
| 35-54 | Periodic Save | PlayerDataManager | Media |
| 59-127 | Load Player Data | PlayerDataManager | Alta |
| 132-167 | Create Records | PlayerDataManager | Media |
| 172-261 | Save Player Data | PlayerDataManager | Alta |
| 266-280 | Honor Snapshot | PlayerDataManager | Bassa |
| 285-302 | Honor Average | PlayerDataManager | Bassa |
| 307-331 | Default Data | PlayerDataManager | Media |
| 336-1179 | Connection Handling | WebSocketConnectionManager | **CRITICA** |
| 434-439 | Player Joined Format | MessageBroadcaster | Bassa |
| 458-474 | Initial NPCs Format | MessageBroadcaster | Bassa |
| 476-499 | Welcome Format | MessageBroadcaster | Media |
| 595-604 | PlayerId Validation | AuthenticationManager | Alta |
| 752-760 | PlayerId Validation | AuthenticationManager | Alta |
| 821-829 | PlayerId Validation | AuthenticationManager | Alta |
| 851-859, 868-876 | Combat Format | MessageBroadcaster | Bassa |
| 976-981 | Leaderboard Format | MessageBroadcaster | Bassa |
| 998-1006 | PlayerId Validation | AuthenticationManager | Alta |
| 1012-1020 | Player Data Format | MessageBroadcaster | Bassa |
| 1040-1048 | ClientId Validation | AuthenticationManager | Alta |
| 1064-1070 | Chat Format | MessageBroadcaster | Bassa |
| 1080-1088 | Save Validation | AuthenticationManager | Alta |
| 1159-1162 | Player Left Format | MessageBroadcaster | Bassa |
| 1184-1217 | Rank Calculation | AuthenticationManager | Bassa |
| 1222-1236 | Shutdown Handling | WebSocketConnectionManager | Media |
| 1242-1246 | Max Health Calc | AuthenticationManager | Media |
| 1252-1256 | Max Shield Calc | AuthenticationManager | Media |
| 1262-1284 | Chat Filter | WebSocketConnectionManager | Bassa |

## ⚠️ Note Critiche

### Dipendenze Cicliche da Evitare
- `WebSocketConnectionManager` deve poter chiamare `PlayerDataManager`
- `WebSocketConnectionManager` deve poter chiamare `MessageBroadcaster`
- `WebSocketConnectionManager` deve poter chiamare `AuthenticationManager`
- **Soluzione**: Dependency injection nel constructor

### Comportamento Runtime
- **NON modificare** la logica esistente
- Mantenere tutti i controlli di sicurezza
- Preservare logging throttling
- Mantenere error handling esistente

### Testing
- Testare ogni modulo dopo lo spostamento
- Verificare che tutti i messaggi funzionino
- Verificare periodic save
- Verificare security checks

## 📋 Prossimi Step

1. ✅ **COMPLETATO**: Analisi e struttura
2. ⏳ **NEXT**: Spostare codice da websocket-manager.cjs
3. ⏳ Aggiornare websocket-manager.cjs per usare nuovi moduli
4. ⏳ Test completo
5. ⏳ Rimuovere codice duplicato

## 🔗 File di Riferimento

- **Piano completo**: `server/core/REFACTOR_PLAN.md`
- **File originale**: `server/core/websocket-manager.cjs`
- **Nuovi moduli**: `server/core/{connection,database,messaging,auth}/*.cjs`
