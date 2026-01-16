# Refactor Aggiuntivo: MessageRouter

## Problema

`WebSocketConnectionManager.cjs` è ancora grande (931 righe) perché contiene tutto il routing dei messaggi inline.

## Soluzione

Estrarre il routing in un modulo separato `MessageRouter.cjs`.

## Analisi Routing

Il file contiene **12 tipi di messaggio** gestiti inline:

1. `join` (~100 righe)
2. `position_update` (~50 righe)
3. `heartbeat` (~10 righe)
4. `skill_upgrade_request` (~150 righe)
5. `projectile_fired` (~70 righe)
6. `start_combat` (~50 righe)
7. `stop_combat` (~15 righe)
8. `explosion_created` (~15 righe)
9. `request_leaderboard` (~100 righe)
10. `request_player_data` (~30 righe)
11. `chat_message` (~50 righe)
12. `save_request` (~35 righe)

**Totale routing**: ~600 righe

## Struttura Proposta

```
server/core/connection/
├── WebSocketConnectionManager.cjs  (~300 righe)
│   - Setup connessioni base
│   - Event handlers (connection, close, error)
│   - Delega routing a MessageRouter
│
└── MessageRouter.cjs                (~600 righe)
    - handleJoin()
    - handlePositionUpdate()
    - handleHeartbeat()
    - handleSkillUpgrade()
    - handleProjectileFired()
    - handleStartCombat()
    - handleStopCombat()
    - handleExplosionCreated()
    - handleRequestLeaderboard()
    - handleRequestPlayerData()
    - handleChatMessage()
    - handleSaveRequest()
```

## Vantaggi

- **WebSocketConnectionManager**: ~300 righe (gestione connessioni)
- **MessageRouter**: ~600 righe (routing messaggi)
- Separazione chiara: connessioni vs routing
- Più facile testare ogni handler separatamente
- Più facile aggiungere nuovi tipi di messaggio

## Prossimo Step

Spostare ogni handler dal metodo `setupConnectionHandling()` a `MessageRouter.cjs`.
