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
  private scene: Phaser.Scene;
  private config: AudioConfig;
  private sounds: Map<string, Phaser.Sound.BaseSound> = new Map();
  private musicInstance: Phaser.Sound.BaseSound | null = null;

  constructor(scene: Phaser.Scene, config: Partial<AudioConfig> = {}) {
    super();
    this.scene = scene;
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
    this.sounds.forEach(sound => {
      if (sound.isPlaying) {
        sound.stop();
      }
    });
    this.sounds.clear();
    this.musicInstance = null;
  }

  private setupAudio(): void {
    // Configurazione iniziale audio
    if (!this.scene.sound) {
      console.warn('Audio system: Phaser sound system not available');
      return;
    }

    // Imposta volumi iniziali
    this.scene.sound.volume = this.config.masterVolume;
  }

  // Metodi pubblici per gestione audio

  playSound(key: string, config: Phaser.Types.Sound.SoundConfig = {}): void {
    if (!this.config.enabled) return;

    try {
      const sound = this.scene.sound.add(key, {
        volume: this.config.effectsVolume,
        ...config
      });
      sound.play();
      this.sounds.set(key, sound);
    } catch (error) {
      console.warn(`Audio system: Failed to play sound '${key}':`, error);
    }
  }

  playMusic(key: string, config: Phaser.Types.Sound.SoundConfig = {}): void {
    if (!this.config.enabled) return;

    try {
      // Ferma musica precedente se presente
      if (this.musicInstance && this.musicInstance.isPlaying) {
        this.musicInstance.stop();
      }

      this.musicInstance = this.scene.sound.add(key, {
        volume: this.config.musicVolume,
        loop: true,
        ...config
      });
      this.musicInstance.play();
      this.sounds.set(key, this.musicInstance);
    } catch (error) {
      console.warn(`Audio system: Failed to play music '${key}':`, error);
    }
  }

  stopMusic(): void {
    if (this.musicInstance && this.musicInstance.isPlaying) {
      this.musicInstance.stop();
    }
  }

  pauseMusic(): void {
    if (this.musicInstance && this.musicInstance.isPlaying) {
      this.musicInstance.pause();
    }
  }

  resumeMusic(): void {
    if (this.musicInstance && !this.musicInstance.isPlaying) {
      this.musicInstance.resume();
    }
  }

  // Controlli volume
  setMasterVolume(volume: number): void {
    this.config.masterVolume = Math.max(0, Math.min(1, volume));
    this.scene.sound.volume = this.config.masterVolume;
  }

  setMusicVolume(volume: number): void {
    this.config.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicInstance) {
      this.musicInstance.setVolume(volume);
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
    this.sounds.forEach(sound => {
      if (sound.isPlaying) {
        sound.stop();
      }
    });
  }

  // Utility methods
  isSoundPlaying(key: string): boolean {
    const sound = this.sounds.get(key);
    return sound ? sound.isPlaying : false;
  }

  getConfig(): AudioConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.applyConfigChanges();
  }

  private applyConfigChanges(): void {
    this.scene.sound.volume = this.config.masterVolume;
    if (this.musicInstance) {
      this.musicInstance.setVolume(this.config.musicVolume);
    }
  }
}
