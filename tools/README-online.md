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

### "ngrok non è installato"
**SOLUZIONE COMPLETA per Windows:**
```bash
# 1. Scarica ngrok da: https://ngrok.com/download
# 2. Scegli "Download for Windows"
# 3. Estrai ngrok.exe in una cartella (es: C:\ngrok)
# 4. Aggiungi la cartella al PATH di sistema:
#    - Clicca tasto Windows → "Variabili d'ambiente"
#    - Modifica "Path" → Aggiungi la cartella di ngrok
# 5. Riavvia il terminale
# 6. Registra account gratuito:
ngrok config add-authtoken YOUR_TOKEN
```

### "Tunnel fallito" o "Authentication failed"
```bash
# Devi registrarti gratuitamente su ngrok.com
# Ottieni il token dalla dashboard e configuralo:
ngrok config add-authtoken YOUR_TOKEN_HERE
```

### "Porta 3000 occupata"
```bash
# Chiudi altri server o cambia porta
# Uccidi processi sulla porta 3000:
npx kill-port 3000

# Oppure modifica la porta in start-online.cjs
const SERVER_PORT = 8080; // Invece di 3000
```

### 🎯 **GIOCARE SENZA NGROK (Rete Locale)**

Se ngrok non funziona, puoi giocare con amici nella stessa rete WiFi:

```bash
# 1. Avvia server normale
npm run server

# 2. Trova il tuo IP locale
ipconfig  # Cerca "Indirizzo IPv4"

# 3. Condividi questo URL con amici:
# http://192.168.1.XXX:3000  (sostituisci con il tuo IP)
```

**Vantaggi:** Nessuna configurazione, funziona sempre
**Svantaggi:** Solo amici nella stessa rete WiFi

### 🔄 **Testare da Solo**

Vuoi testare che tutto funzioni prima di invitare amici?

```bash
# Avvia server
npm run server

# Apri due browser diversi:
# Browser 1: http://localhost:3000
# Browser 2: http://localhost:3000 (modalità incognito)

# Vedrai due giocatori giocare insieme!
```

## 🔧 Configurazione Avanzata

### Cambiare Regione ngrok
Modifica `tools/start-online.cjs`:
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
