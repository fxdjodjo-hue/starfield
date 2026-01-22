# Refactor Plan: websocket-manager.cjs → Moduli Separati

## Analisi Sezioni Logiche

### File Originale: `server/core/websocket-manager.cjs` (1287 righe)

### Sezioni Identificate:

#### 1. **WebSocketConnectionManager** (Connessioni Base)
- **Linee 14-30**: Constructor e inizializzazione
- **Linee 336-1179**: `setupConnectionHandling()` - Gestione connessioni e routing messaggi
- **Linee 1222-1236**: `setupShutdownHandling()` - Cleanup server
- **Linee 1262-1284**: `filterChatMessage()` - Filtro chat

**Responsabilità:**
- Setup WebSocket server
- Event handlers (connection, message, close, error)
- Routing messaggi (tutti i `if data.type === ...`)
- Logging throttling per performance

#### 2. **PlayerDataManager** (Database Operations)
- **Linee 35-54**: `setupPeriodicSave()` - Salvataggio periodico
- **Linee 59-127**: `loadPlayerData()` - Carica dati player
- **Linee 132-167**: `createInitialPlayerRecords()` - Crea record iniziali
- **Linee 172-261**: `savePlayerData()` - Salva dati player
- **Linee 266-280**: `saveHonorSnapshot()` - Snapshot honor
- **Linee 285-302**: `getRecentHonorAverage()` - Media honor
- **Linee 307-331**: `getDefaultPlayerData()` - Dati default

**Responsabilità:**
- Tutte le operazioni Supabase
- Load/save player data
- Honor snapshots e calcoli
- Periodic save system

#### 3. **MessageBroadcaster** (Utility Messaggi)
- **Linee 434-439**: Formattazione `player_joined`
- **Linee 458-474**: Formattazione `initial_npcs`
- **Linee 476-499**: Formattazione `welcome`
- **Linee 851-859, 868-876**: Formattazione `combat_update`
- **Linee 976-981**: Formattazione `leaderboard_response`
- **Linee 1012-1020**: Formattazione `player_data_response`
- **Linee 1064-1070**: Formattazione `chat_message`
- **Linee 1159-1162**: Formattazione `player_left`

**Responsabilità:**
- Formattazione messaggi per broadcast
- Helper per creare payload standardizzati
- Nota: Il broadcasting effettivo è già in `mapServer.broadcastToMap()`

#### 4. **AuthenticationManager** (Security & Helpers)
- **Linee 595-604**: Verifica playerId (skill_upgrade_request)
- **Linee 752-760**: Verifica playerId (projectile_fired)
- **Linee 821-829**: Verifica playerId (start_combat)
- **Linee 998-1006**: Verifica playerId (request_player_data)
- **Linee 1040-1048**: Verifica clientId (chat_message)
- **Linee 1080-1088**: Verifica clientId/playerId (save_request)
- **Linee 1242-1246**: `calculateMaxHealth()` - Helper
- **Linee 1252-1256**: `calculateMaxShield()` - Helper
- **Linee 1184-1217**: `calculateRankName()` - Helper

**Responsabilità:**
- Security checks inline (playerId/clientId validation)
- Helper functions (health, shield, rank calculations)

## Mappa Sezione → Nuovo Modulo

| Sezione Originale | Nuovo Modulo | File Destinazione |
|-------------------|--------------|-------------------|
| Constructor + setup | WebSocketConnectionManager | `server/core/connection/WebSocketConnectionManager.cjs` |
| setupConnectionHandling() | WebSocketConnectionManager | `server/core/connection/WebSocketConnectionManager.cjs` |
| setupShutdownHandling() | WebSocketConnectionManager | `server/core/connection/WebSocketConnectionManager.cjs` |
| filterChatMessage() | WebSocketConnectionManager | `server/core/connection/WebSocketConnectionManager.cjs` |
| Routing messaggi (tutti i `if data.type`) | WebSocketConnectionManager | `server/core/connection/WebSocketConnectionManager.cjs` |
| loadPlayerData() | PlayerDataManager | `server/core/database/PlayerDataManager.cjs` |
| savePlayerData() | PlayerDataManager | `server/core/database/PlayerDataManager.cjs` |
| createInitialPlayerRecords() | PlayerDataManager | `server/core/database/PlayerDataManager.cjs` |
| saveHonorSnapshot() | PlayerDataManager | `server/core/database/PlayerDataManager.cjs` |
| getRecentHonorAverage() | PlayerDataManager | `server/core/database/PlayerDataManager.cjs` |
| getDefaultPlayerData() | PlayerDataManager | `server/core/database/PlayerDataManager.cjs` |
| setupPeriodicSave() | PlayerDataManager | `server/core/database/PlayerDataManager.cjs` |
| Formattazione messaggi | MessageBroadcaster | `server/core/messaging/MessageBroadcaster.cjs` |
| validatePlayerId() | AuthenticationManager | `server/core/auth/AuthenticationManager.cjs` |
| validateClientId() | AuthenticationManager | `server/core/auth/AuthenticationManager.cjs` |
| calculateMaxHealth() | AuthenticationManager | `server/core/auth/AuthenticationManager.cjs` |
| calculateMaxShield() | AuthenticationManager | `server/core/auth/AuthenticationManager.cjs` |
| calculateRankName() | AuthenticationManager | `server/core/auth/AuthenticationManager.cjs` |

## Struttura Cartelle Creata

```
server/core/
├── connection/
│   └── WebSocketConnectionManager.cjs  (Nuovo)
├── database/
│   └── PlayerDataManager.cjs            (Nuovo)
├── messaging/
│   └── MessageBroadcaster.cjs          (Nuovo)
├── auth/
│   └── AuthenticationManager.cjs      (Nuovo)
├── websocket-manager.cjs               (Originale - da refactorizzare)
└── REFACTOR_PLAN.md                    (Questo file)
```

## Prossimi Step

1. ✅ Creata struttura cartelle
2. ✅ Creati file skeleton con TODO
3. ⏳ **NEXT**: Spostare codice da websocket-manager.cjs ai nuovi moduli
4. ⏳ Aggiornare websocket-manager.cjs per usare i nuovi moduli
5. ⏳ Testare che il comportamento runtime sia identico
6. ⏳ Rimuovere codice duplicato da websocket-manager.cjs

## Note Importanti

- **NON modificare comportamento runtime** durante il refactor
- Mantenere tutte le dipendenze esistenti
- Testare dopo ogni spostamento di codice
- Il file originale `websocket-manager.cjs` rimane invariato fino al completamento
