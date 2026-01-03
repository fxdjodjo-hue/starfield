# Audio Assets

Questa cartella contiene tutti gli asset audio del gioco Starfield.

## 📁 Struttura

### effects/
Effetti sonori di gameplay:
- `laser.wav` - Suono sparo laser player
- `explosion.wav` - Esplosione nave nemica
- `hit.wav` - Colpo ricevuto dalla nave
- `shield_hit.wav` - Impatto su scudo attivo
- `collect.wav` - Raccolta risorse/currency
- `upgrade.wav` - Acquisizione upgrade
- `damage.wav` - Danno subito alla nave

### music/
Tracce musicali di sottofondo:
- `menu_theme.mp3` - Tema menu principale e start screen
- `gameplay_theme.mp3` - Tema esplorazione normale
- `battle_theme.mp3` - Tema durante combattimenti
- `victory_theme.mp3` - Tema vittoria missione
- `defeat_theme.mp3` - Tema sconfitta/partita persa

### ui/
Suoni interfaccia utente:
- `click.wav` - Click su pulsante/elemento
- `hover.wav` - Hover su elemento interattivo
- `select.wav` - Selezione elemento da lista
- `back.wav` - Torna indietro navigazione
- `confirm.wav` - Conferma azione/dialogo

## 🔊 Specifiche Tecniche

### Formati Supportati
- **Effetti**: WAV, MP3, OGG
- **Musica**: MP3, OGG (preferibile MP3 per qualità/compressione)
- **UI**: WAV (per latenza minima)

### Qualità Audio
- **Sample Rate**: 44.1kHz minimo
- **Bit Depth**: 16-bit minimo
- **Canali**: Stereo
- **Compressione**: MP3 128-192kbps per musica, WAV lossless per effetti

### Ottimizzazioni
- Effetti < 500KB ciascuno
- Musica < 5MB per traccia
- UI < 100KB ciascuno
- Loop seamless per musica
