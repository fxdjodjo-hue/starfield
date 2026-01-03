import { AudioConfig } from '../systems/audio/AudioSystem';

export const AUDIO_CONFIG: AudioConfig = {
  masterVolume: 1.0,
  musicVolume: 0.7,
  effectsVolume: 0.8,
  uiVolume: 0.9,
  enabled: true
};

// Asset audio predefiniti
export const AUDIO_ASSETS = {
  // Effetti sonori
  effects: {
    laser: 'effects/laser.wav',
    explosion: 'effects/explosion.wav',
    hit: 'effects/hit.wav',
    shieldHit: 'effects/shield_hit.wav',
    collect: 'effects/collect.wav',
    upgrade: 'effects/upgrade.wav',
    damage: 'effects/damage.wav'
  },

  // Musica
  music: {
    background: 'music/bgmusic.mp3',
    menu: 'music/menu_theme.mp3',
    gameplay: 'music/gameplay_theme.mp3',
    battle: 'music/battle_theme.mp3',
    victory: 'music/victory_theme.mp3',
    defeat: 'music/defeat_theme.mp3'
  },

  // UI
  ui: {
    click: 'ui/click.wav',
    hover: 'ui/hover.wav',
    select: 'ui/select.wav',
    back: 'ui/back.wav',
    confirm: 'ui/confirm.wav'
  }
};

// Categorie audio per gestione granulare
export enum AudioCategory {
  MASTER = 'master',
  MUSIC = 'music',
  EFFECTS = 'effects',
  UI = 'ui'
}

// Configurazioni specifiche per diversi contesti di gioco
export const CONTEXT_AUDIO_CONFIGS = {
  menu: {
    musicVolume: 0.8,
    effectsVolume: 0.9,
    uiVolume: 1.0
  },
  gameplay: {
    musicVolume: 0.6,
    effectsVolume: 0.8,
    uiVolume: 0.7
  },
  battle: {
    musicVolume: 0.8,
    effectsVolume: 1.0,
    uiVolume: 0.6
  },
  paused: {
    musicVolume: 0.3,
    effectsVolume: 0.2,
    uiVolume: 0.8
  }
};
