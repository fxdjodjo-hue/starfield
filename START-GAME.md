# 🚀 Avvio Rapido Starfield

## File Batch Disponibili

### `start-server.bat`
Avvia solo il server del gioco (per multiplayer).
```cmd
start-server.bat
```

### `start-client.bat`
Avvia solo il client del gioco (con browser automatico).
```cmd
start-client.bat
```

### `start-both.bat`
Avvia sia server che client per giocare in locale.
```cmd
start-both.bat
```

## 🎮 Come Giocare

### Gioco Locale (Solo)
1. Doppio click su `start-both.bat`
2. Il browser si apre automaticamente su `http://localhost:5173`
3. Gioca!

### Multiplayer
1. **Host**: Doppio click su `start-server.bat`
2. **Giocatori**: Doppio click su `start-client.bat` su ogni PC
3. Giocate insieme!

## ⚙️ Configurazione Multiplayer

Per giocare online, modifica `src/config/NetworkConfig.ts`:
```typescript
DEFAULT_SERVER_URL: 'wss://tuo-server-online.com',
```

## 🛠️ Risoluzione Problemi

- Se il server non si avvia: verifica che Node.js sia installato
- Se il client non si avvia: verifica che npm sia installato
- Se il browser non si apre: vai manualmente su `http://localhost:5173`

## 📝 Note

- Premi `Ctrl+C` nel terminale per fermare i processi
- I file `.bat` devono essere nella stessa cartella di `package.json`
- Assicurati che la porta 3000 e 5173 non siano occupate

---
*Creato automaticamente per avvio semplificato* 🎯

