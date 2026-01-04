import { System } from '../../infrastructure/ecs/System';
import { GameContext } from '../../infrastructure/engine/GameContext';
import type { AudioConfig } from '../../config/AudioConfig';
import { AUDIO_ASSETS } from '../../config/AudioConfig';

// Re-export AudioConfig for backward compatibility
export type { AudioConfig };

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

  playSound(key: string, volume: number = this.config.effectsVolume, loop: boolean = false, allowMultiple: boolean = false): void {
    if (!this.config.enabled) return;

    try {
      // Crea una chiave unica per suoni multipli ravvicinati
      const soundKey = allowMultiple ? `${key}_${Date.now()}_${Math.random()}` : key;

      // Per suoni loop, ferma quello precedente se esiste
      if (loop && this.sounds.has(key)) {
        this.stopSound(key);
      } else if (this.sounds.has(soundKey) && !loop && !allowMultiple) {
        // Per suoni non loop, se già presente non riavviarlo (a meno che allowMultiple)
        return;
      }

      // Cerca il path nell'AUDIO_ASSETS
      const assetPath = this.getAssetPath(key, 'effects');
      if (!assetPath) {
        console.warn(`Audio system: Asset '${key}' not found in AUDIO_ASSETS.effects`);
        return;
      }

      const audio = new Audio(`/assets/audio/${assetPath}`);
      audio.volume = this.config.masterVolume * volume;
      audio.loop = loop;

      // Gestisci la riproduzione con retry per superare blocchi del browser
      const playAudio = async (retryCount = 0) => {
        try {
          await audio.play();
          console.log(`Audio system: Playing '${key}' successfully`);
        } catch (error) {
          if (retryCount < 2) {
            console.warn(`Audio system: Failed to play '${key}' (attempt ${retryCount + 1}), retrying...`);
            // Riprova dopo un delay crescente
            setTimeout(() => playAudio(retryCount + 1), 50 * (retryCount + 1));
          } else {
            console.warn(`Audio system: Failed to play '${key}' after ${retryCount + 1} attempts:`, error);
            this.sounds.delete(soundKey);
          }
          return;
        }
      };

      playAudio();
      this.sounds.set(soundKey, audio);

      // Per suoni non loop, rimuovi dalla mappa quando finisce
      if (!loop) {
        audio.addEventListener('ended', () => {
          this.sounds.delete(soundKey);
        });

        // Safety timeout per suoni che potrebbero non finire correttamente
        setTimeout(() => {
          if (this.sounds.has(soundKey)) {
            this.sounds.delete(soundKey);
          }
        }, 5000); // 5 secondi massimo per suoni laser
      }
    } catch (error) {
      console.warn(`Audio system: Failed to create sound '${key}':`, error);
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

      // Cerca il path nell'AUDIO_ASSETS
      const assetPath = this.getAssetPath(key, 'music');
      if (!assetPath) {
        console.warn(`Audio system: Asset '${key}' not found in AUDIO_ASSETS.music`);
        return;
      }

      this.musicInstance = new Audio(`/assets/audio/${assetPath}`);
      this.musicInstance.volume = this.config.masterVolume * volume;
      this.musicInstance.loop = true;

      this.musicInstance.play().catch(error => {
        console.warn(`Audio system: Failed to play music '${key}':`, error);
      });
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

  stopSound(key: string): void {
    const audio = this.sounds.get(key);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      this.sounds.delete(key);
    }
  }

  /**
   * Fade in del suono (graduale aumento volume)
   */
  fadeInSound(key: string, duration: number = 500, targetVolume: number = this.config.effectsVolume): void {
    const audio = this.sounds.get(key);
    if (!audio) return;

    const startVolume = 0;
    const startTime = Date.now();

    const fadeStep = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Curva ease-in per fade più naturale
      const easedProgress = progress * progress;
      audio.volume = this.config.masterVolume * startVolume + (this.config.masterVolume * targetVolume - this.config.masterVolume * startVolume) * easedProgress;

      if (progress < 1) {
        requestAnimationFrame(fadeStep);
      }
    };

    fadeStep();
  }

  /**
   * Fade out del suono (graduale diminuzione volume)
   */
  fadeOutSound(key: string, duration: number = 300): Promise<void> {
    return new Promise((resolve) => {
      const audio = this.sounds.get(key);
      if (!audio) {
        resolve();
        return;
      }

      const startVolume = audio.volume / this.config.masterVolume;
      const startTime = Date.now();

      const fadeStep = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Curva ease-out per fade più naturale
        const easedProgress = 1 - Math.pow(1 - progress, 2);
        audio.volume = this.config.masterVolume * (startVolume * (1 - easedProgress));

        if (progress < 1) {
          requestAnimationFrame(fadeStep);
        } else {
          // Fade completato, ferma il suono
          audio.pause();
          audio.currentTime = 0;
          this.sounds.delete(key);
          resolve();
        }
      };

      fadeStep();
    });
  }

  private stopAllSounds(): void {
    this.sounds.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.sounds.clear();
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

  private getAssetPath(key: string, category: keyof typeof AUDIO_ASSETS): string | null {
    const categoryAssets = AUDIO_ASSETS[category];
    if (categoryAssets && typeof categoryAssets === 'object' && key in categoryAssets) {
      return categoryAssets[key as keyof typeof categoryAssets] as string;
    }
    return null;
  }
}
