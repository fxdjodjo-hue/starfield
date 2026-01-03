# Audio System

Sistema di gestione audio per Starfield, implementato seguendo l'architettura ECS.

## 📋 Panoramica

Il sistema audio gestisce tutti gli aspetti dell'audio di gioco:
- Effetti sonori (laser, esplosioni, collisioni)
- Musica di sottofondo (menu, gameplay, battaglia)
- Suoni UI (click, hover, selezioni)
- Controlli volume granulari
- Toggle audio globale

## 🏗️ Architettura

### AudioSystem
Classe principale che gestisce:
- Riproduzione suoni ed effetti
- Controlli volume indipendenti
- Gestione musica di sottofondo
- **Fade in/out graduale** per transizioni morbide
- Cleanup risorse

### Configurazione
- `AudioConfig.ts`: Configurazioni base e asset predefiniti
- Supporto per configurazioni contestuali (menu, gameplay, battaglia)

## 📁 Struttura Asset

```
public/assets/audio/
├── effects/          # Effetti sonori di gioco
├── music/           # Tracce musicali
└── ui/              # Suoni interfaccia utente
```

## 🔧 Utilizzo

### Inizializzazione
```typescript
// In GameScene o sistema principale
this.audioSystem = new AudioSystem(this.scene, AUDIO_CONFIG);
this.audioSystem.init();
```

### Riproduzione Audio
```typescript
// Effetti sonori
this.audioSystem.playSound('laser');
this.audioSystem.playSound('explosion', { volume: 0.5 });

// Musica
this.audioSystem.playMusic('gameplay');
this.audioSystem.stopMusic();
```

### Controlli Volume
```typescript
this.audioSystem.setMasterVolume(0.8);
this.audioSystem.setMusicVolume(0.6);
this.audioSystem.setEffectsVolume(1.0);
```

### Fade Effects
```typescript
// Fade in graduale (800ms) fino al volume target
this.audioSystem.fadeInSound('engine', 800, 0.15);

// Fade out graduale (500ms) con promessa di completamento
await this.audioSystem.fadeOutSound('engine', 500);
```

**Caratteristiche Fade:**
- **Curve easing**: ease-in per fade in, ease-out per fade out
- **Durata configurabile**: millisecondi personalizzabili
- **Volume target**: controllo preciso del volume finale
- **Promise-based**: fade out restituisce Promise per sincronizzazione

## 📋 Asset Richiesti

### Effetti (effects/)
- `laser.wav` - Sparo laser
- `explosion.wav` - Esplosioni
- `hit.wav` - Colpo ricevuto
- `shield_hit.wav` - Colpo scudo
- `collect.wav` - Raccolta risorse
- `upgrade.wav` - Upgrade ottenuto
- `damage.wav` - Danno subito

### Musica (music/)
- `menu_theme.mp3` - Tema menu principale
- `gameplay_theme.mp3` - Tema gameplay normale
- `battle_theme.mp3` - Tema combattimento
- `victory_theme.mp3` - Tema vittoria
- `defeat_theme.mp3` - Tema sconfitta

### UI (ui/)
- `click.wav` - Click pulsante
- `hover.wav` - Hover elemento
- `select.wav` - Selezione elemento
- `back.wav` - Torna indietro
- `confirm.wav` - Conferma azione

## 🔄 Integrazione con ECS

Il sistema audio può essere integrato con l'ECS esistente per:
- Audio triggered da eventi entity
- Audio spaziale basato su posizione
- Audio contestuale basato su stato gioco

## 🧪 Testing

- Test unità per metodi AudioSystem
- Test integrazione con Phaser Sound
- Test caricamento asset audio
