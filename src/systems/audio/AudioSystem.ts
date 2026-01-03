import { System } from '../../infrastructure/ecs/System';
import { GameContext } from '../../infrastructure/engine/GameContext';

export interface AudioConfig {
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  uiVolume: number;
  enabled: boolean;
}

export interface SoundAsset {
  key: string;
  url: string;
  volume?: number;
  loop?: boolean;
}

export default class AudioSystem extends System {
  private config: AudioConfig;
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private musicInstance: HTMLAudioElement | null = null;
  private gainNodes: Map<string, GainNode> = new Map();

  constructor(config: Partial<AudioConfig> = {}) {
    super();
    this.config = {
      masterVolume: 1.0,
      musicVolume: 0.7,
      effectsVolume: 0.8,
      uiVolume: 0.9,
      enabled: true,
      ...config
    };
  }

  init(): void {
    // Inizializzazione sistema audio
    this.setupAudio();
  }

  update(deltaTime: number): void {
    // Aggiornamenti periodici se necessari
  }

  destroy(): void {
    // Cleanup risorse audio
    this.sounds.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.sounds.clear();

    if (this.musicInstance) {
      this.musicInstance.pause();
      this.musicInstance.currentTime = 0;
      this.musicInstance = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }

  private setupAudio(): void {
    try {
      // Inizializza AudioContext per Web Audio API
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Audio system: Web Audio API not supported, falling back to HTML Audio');
    }
  }

  // Metodi pubblici per gestione audio

  playSound(key: string, volume: number = this.config.effectsVolume): void {
    if (!this.config.enabled) return;

    try {
      const audio = new Audio(`/assets/audio/${key}`);
      audio.volume = this.config.masterVolume * volume;
      audio.play();
      this.sounds.set(key, audio);

      // Rimuovi dalla mappa quando finisce
      audio.addEventListener('ended', () => {
        this.sounds.delete(key);
      });
    } catch (error) {
      console.warn(`Audio system: Failed to play sound '${key}':`, error);
    }
  }

  playMusic(key: string, volume: number = this.config.musicVolume): void {
    if (!this.config.enabled) return;

    try {
      // Ferma musica precedente se presente
      if (this.musicInstance) {
        this.musicInstance.pause();
        this.musicInstance.currentTime = 0;
      }

      this.musicInstance = new Audio(`/assets/audio/${key}`);
      this.musicInstance.volume = this.config.masterVolume * volume;
      this.musicInstance.loop = true;
      this.musicInstance.play();
    } catch (error) {
      console.warn(`Audio system: Failed to play music '${key}':`, error);
    }
  }

  stopMusic(): void {
    if (this.musicInstance) {
      this.musicInstance.pause();
      this.musicInstance.currentTime = 0;
    }
  }

  pauseMusic(): void {
    if (this.musicInstance) {
      this.musicInstance.pause();
    }
  }

  resumeMusic(): void {
    if (this.musicInstance) {
      this.musicInstance.play();
    }
  }

  // Controlli volume
  setMasterVolume(volume: number): void {
    this.config.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  setMusicVolume(volume: number): void {
    this.config.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicInstance) {
      this.musicInstance.volume = this.config.masterVolume * volume;
    }
  }

  setEffectsVolume(volume: number): void {
    this.config.effectsVolume = Math.max(0, Math.min(1, volume));
  }

  setUIVolume(volume: number): void {
    this.config.uiVolume = Math.max(0, Math.min(1, volume));
  }

  // Toggle audio
  toggleAudio(): void {
    this.config.enabled = !this.config.enabled;
    if (!this.config.enabled) {
      this.stopAllSounds();
    }
  }

  private stopAllSounds(): void {
    this.sounds.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.stopMusic();
  }

  private updateAllVolumes(): void {
    // Aggiorna volume di tutti gli audio attivi
    this.sounds.forEach(audio => {
      // Il volume relativo viene mantenuto, ma moltiplicato per master volume
      const relativeVolume = audio.volume / this.config.masterVolume || 1;
      audio.volume = this.config.masterVolume * relativeVolume;
    });

    if (this.musicInstance) {
      this.musicInstance.volume = this.config.masterVolume * this.config.musicVolume;
    }
  }

  // Utility methods
  isSoundPlaying(key: string): boolean {
    const audio = this.sounds.get(key);
    return audio ? !audio.paused && !audio.ended : false;
  }

  isMusicPlaying(): boolean {
    return this.musicInstance ? !this.musicInstance.paused && !this.musicInstance.ended : false;
  }

  getConfig(): AudioConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.applyConfigChanges();
  }

  private applyConfigChanges(): void {
    this.updateAllVolumes();
  }
}
