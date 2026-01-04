# 🔧 Configurazione Supabase - Guida Setup

## 1. Recupera le API Keys

Vai su [Supabase Dashboard](https://supabase.com/dashboard) → Il tuo progetto → **Settings** → **API**

Copia questi valori:

### Project URL
```
https://euvlanwkqzhqnbwbvwis.supabase.co
```

### Anon/Public Key
Cerca "**anon public**" nella pagina API - copia la chiave lunga che inizia con `eyJ...`

## 2. Configura il file .env

Modifica il file `.env` nella root del progetto:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://euvlanwkqzhqnbwbvwis.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...[LA_TUA_CHIAVE_ANON_QUI]...
```

## 3. Test della Connessione

Dopo aver configurato `.env`, testa con:

```bash
npm run dev
```

Il gioco dovrebbe avviarsi senza errori di connessione.

## 4. Applica le Migrazioni del Database

Una volta configurato `.env`, applica lo schema del database:

```bash
# Collega al progetto Supabase
npx supabase link --project-ref euvlanwkqzhqnbwbvwis

# Applica le migrazioni (crea le tabelle)
npx supabase db push
```

**Nota:** Usa `npx supabase` invece di installare globalmente.

## 5. Verifica il Database

Nel [Supabase Dashboard](https://supabase.com/dashboard) → Database → Tables, dovresti vedere:

- ✅ `user_profiles`
- ✅ `player_stats`
- ✅ `player_upgrades`
- ✅ `player_currencies`
- ✅ `quest_progress`

---

## 🚨 IMPORTANTE

**Non committare mai il file `.env`** - contiene chiavi segrete!

Se hai problemi, verifica:
1. Le API keys sono corrette
2. Il progetto Supabase è attivo
3. Hai applicato le migrazioni (`supabase db push`)
