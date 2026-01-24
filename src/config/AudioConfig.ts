export type AudioConfig = {
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  uiVolume: number;
  enabled: boolean;
};

export const AUDIO_CONFIG: AudioConfig = {
  masterVolume: 1.0,
  musicVolume: 0.7, // Volume musica di background
  effectsVolume: 0.8,
  uiVolume: 0.9,
  enabled: true
};

// Asset audio predefiniti
export const AUDIO_ASSETS = {
  // Effetti sonori
  effects: {
    laser: 'effects/laser/laser_red.wav',
    scouterLaser: 'effects/laser/scouter_laser_sound.wav',
    explosion: 'effects/explosions/explosion.mp3',
    hit: 'effects/hit.wav',
    shieldHit: 'effects/shield_hit.wav',
    collect: 'effects/collect.wav',
    upgrade: 'effects/upgrade.wav',
    damage: 'effects/damage.wav',
    engine: 'effects/engine/enginesoundeffect.mp3',
    playerLogin: 'effects/playerlogin/bubbleSounds.mp3',
    portal: 'effects/portal/portal.mp3',
    portalBassdrop: 'effects/portal/bassdrop.mp3'
  },

  // Musica
  music: {
    background: 'music/bgmusicpalantir.mp3',
    ambience: 'ambient/ambience.mp3',
    menu: 'music/menu_theme.mp3',
    gameplay: 'music/gameplay_theme.mp3',
    battle: 'music/battle_theme.mp3',
    victory: 'music/victory_theme.mp3',
    defeat: 'music/defeat_theme.mp3',
    spaceStation: '../spacestation/spaceStationSoundEffect.mp3'
  },

  // UI
  ui: {
    click: 'loginscreenmusic/uiSounds.mp3',
    hover: 'ui/hover.wav',
    select: 'ui/select.wav',
    back: 'ui/back.wav',
    confirm: 'ui/confirm.wav'
  },

  // Voice
  voice: {
    warning: 'voice/warning/warning_voice.mp3'
  }
};

// Categorie audio per gestione granulare
// Usa const object invece di enum per compatibilità con erasableSyntaxOnly
export const AudioCategory = {
  MASTER: 'master',
  MUSIC: 'music',
  EFFECTS: 'effects',
  UI: 'ui'
} as const;

export type AudioCategory = typeof AudioCategory[keyof typeof AudioCategory];

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
