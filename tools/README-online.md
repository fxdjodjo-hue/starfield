# 🌐 Starfield Online - Gioca con Amici

Questa cartella contiene gli strumenti per giocare a Starfield con amici da qualsiasi parte del mondo!

## 🚀 Avvio Rapido

```bash
# Avvia server + tunnel pubblico automaticamente
npm run server:online
```

Questo comando:
1. ✅ Avvia il server di gioco (porta 3000)
2. ✅ Crea un tunnel sicuro con ngrok
3. ✅ Ti dà un URL pubblico da condividere
4. ✅ Mostra istruzioni per gli amici

## 📋 Come Giocare Online

### 1. Avvia il Server Online
```bash
npm run server:online
```

Vedrai output simile:
```
🚀 Avvio Starfield Online Server...
🌐 Creazione tunnel pubblico con ngrok...

🎮 Avvio server di gioco...
🔗 Creazione tunnel ngrok...

🎉 === STARFIELD ONLINE PRONTO! === 🎉
🌐 URL da condividere con gli amici:
   https://abc123.ngrok.io
```

### 2. Condividi l'URL
Invia l'URL `https://abc123.ngrok.io` ai tuoi amici.

### 3. Giocate Insieme!
- Ogni amico apre l'URL nel browser
- Inserisce un nickname
- Giocate in tempo reale!

## 🛠️ Troubleshooting

### "ngrok non trovato"
```bash
# Installa ngrok globalmente
npm install -g ngrok

# Oppure usa npx
npx ngrok http 3000
```

### "Tunnel fallito"
```bash
# Registra account gratuito su ngrok.com
# Ottieni token auth e configuralo:
ngrok config add-authtoken YOUR_TOKEN
```

### "Porta 3000 occupata"
```bash
# Uccidi processi sulla porta 3000
npx kill-port 3000
```

### "Voglio testare localmente"
```bash
# Server normale (solo rete locale)
npm run server

# Poi dai amici: http://TUO_IP:3000
```

## 🔧 Configurazione Avanzata

### Cambiare Regione ngrok
Modifica `tools/start-online.js`:
```javascript
const url = await ngrok.connect({
  proto: 'http',
  addr: SERVER_PORT,
  region: 'us' // 'eu', 'us', 'ap', etc.
});
```

### Porta Personalizzata
Modifica `tools/start-online.js`:
```javascript
const SERVER_PORT = 8080; // Invece di 3000
```

## 🎯 Caratteristiche Multiplayer

- ✅ **Giocatori multipli** in tempo reale
- ✅ **NPC condivisi** tra tutti i giocatori
- ✅ **Combattimento sincronizzato**
- ✅ **Respawn automatico** degli NPC
- ✅ **Chat e interazioni**

## 🛡️ Sicurezza

- 🔒 **Tunnel criptato** (HTTPS)
- 🔒 **Connessioni WebSocket sicure**
- ⚠️ **Per uso personale** - non esporre a sconosciuti

## 📞 Supporto

Se hai problemi:
1. Controlla la console per errori
2. Verifica connessione internet
3. Prova a riavviare ngrok: `ngrok config check`

---

**Divertiti a giocare con gli amici!** 🎮🤝
