import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { GameSettings } from '../../core/settings/GameSettings';
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

  // Cache per suoni precaricati (per sincronizzazione perfetta)
  private preloadedSounds: Map<string, HTMLAudioElement> = new Map();
  // Pool di istanze audio precaricate per riproduzioni multiple istantanee
  private audioPool: Map<string, HTMLAudioElement[]> = new Map();
  private readonly POOL_SIZE = 3; // Numero di istanze nel pool per ogni suono

  // Debouncing system to prevent sound duplication
  private lastPlayedTimes: Map<string, number> = new Map();
  private debounceTimeouts: Map<string, number> = new Map();

  constructor(ecs: ECS, config: Partial<AudioConfig> = {}) {
    super(ecs);
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
    // Precariare suoni importanti per sincronizzazione perfetta
    this.preloadImportantSounds();

    // Setup listener per impostazioni
    this.setupSettingsListeners();

    // Apply saved settings
    const settings = GameSettings.getInstance();
    this.setMasterVolume(settings.audio.master / 100);
    this.setEffectsVolume(settings.audio.sfx / 100);
    this.setMusicVolume(settings.audio.music / 100);
  }

  private setupSettingsListeners(): void {
    document.addEventListener('settings:volume:master', (e: any) => {
      this.setMasterVolume(e.detail);
    });
    document.addEventListener('settings:volume:sfx', (e: any) => {
      this.setEffectsVolume(e.detail);
    });
    document.addEventListener('settings:volume:music', (e: any) => {
      this.setMusicVolume(e.detail);
    });
  }

  /**
   * Precariare suoni importanti per evitare delay di caricamento
   */
  private async preloadImportantSounds(): Promise<void> {
    const importantSounds = ['explosion'];

    for (const soundKey of importantSounds) {
      const assetPath = this.getAssetPath(soundKey, 'effects');
      if (!assetPath) continue;

      const audioUrl = `assets/audio/${assetPath}`;

      // Crea pool di istanze precaricate per riproduzioni multiple istantanee
      const pool: HTMLAudioElement[] = [];
      for (let i = 0; i < this.POOL_SIZE; i++) {
        const audio = new Audio(audioUrl);
        audio.volume = 0; // Volume 0 durante il precaricamento
        audio.preload = 'auto';

        try {
          await audio.load();
          pool.push(audio);
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn(`[AudioSystem] Failed to preload sound ${soundKey} instance ${i}:`, error);
          }
        }
      }

      if (pool.length > 0) {
        this.audioPool.set(soundKey, pool);
        this.preloadedSounds.set(soundKey, pool[0]); // Mantieni anche la prima istanza per compatibilità
      }
    }
  }

  /**
   * Ottiene un'istanza audio dal pool (per riproduzione istantanea)
   */
  private getAudioFromPool(key: string): HTMLAudioElement | null {
    const pool = this.audioPool.get(key);
    if (!pool || pool.length === 0) return null;

    // Trova un'istanza non in riproduzione
    for (const audio of pool) {
      if (audio.paused || audio.ended) {
        audio.currentTime = 0; // Reset al tempo 0
        return audio;
      }
    }

    // Se tutte le istanze sono in riproduzione, usa la prima (per allowMultiple)
    return pool[0];
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

    // Cancella tutti i timeout di debouncing
    this.debounceTimeouts.forEach(timeout => clearTimeout(timeout));
    this.debounceTimeouts.clear();
    this.lastPlayedTimes.clear();

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

  /**
   * Riproduce un suono in una posizione specifica (Positional Audio)
   * Il volume viene attenuato in base alla distanza dal centro della camera
   * @param key Chiave del suono
   * @param x Coordinata X del mondo
   * @param y Coordinata Y del mondo
   * @param options Opzioni extra (volume base, loop, etc.)
   */
  playSoundAt(
    key: string,
    x: number,
    y: number,
    options: {
      volume?: number;
      loop?: boolean;
      allowMultiple?: boolean;
      category?: keyof typeof AUDIO_ASSETS;
      debounceMs?: number;
      maxDistance?: number;
    } = {}
  ): void {
    if (!this.config.enabled) return;

    // Distanza massima di default (2000 unità)
    const maxDistance = options.maxDistance || 2000;
    let finalVolume = options.volume !== undefined ? options.volume : this.config.effectsVolume;

    try {
      // Ottieni la posizione del player o del centro camera
      const cameraSystem = this.ecs.getSystems().find(s => s.constructor.name === 'CameraSystem') as any;

      if (cameraSystem) {
        const camera = cameraSystem.getCamera();
        // 🚀 FIX: La camera usa x/y come centro del mondo direttamente.
        // In precedenza chiamavo getCenter() che non esiste, causando il fallback al volume pieno.
        const cameraX = camera.x;
        const cameraY = camera.y;

        const dx = x - cameraX;
        const dy = y - cameraY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > maxDistance) {
          // Suono troppo lontano, non riprodurre nulla
          return;
        }

        // Calcola attenuazione lineare: 1.0 (vicino) -> 0.0 (maxDistance)
        const attenuation = 1 - (distance / maxDistance);

        // Applica curva quadratica per una caduta del suono più naturale (opzionale)
        const smoothedAttenuation = attenuation * attenuation;

        finalVolume *= smoothedAttenuation;
      }
    } catch (err) {
      // In caso di errore nel calcolo della distanza, usa il volume originale
      // (meglio sentire il suono che avere un crash o silenzio totale)
    }

    // Se il volume è trascurabile, ignora
    if (finalVolume < 0.001) return;

    // Riproduci il suono con il volume calcolato
    this.playSound(
      key,
      finalVolume,
      options.loop || false,
      options.allowMultiple || false,
      options.category || 'effects',
      options.debounceMs || 50
    );
  }

  playSound(key: string, volume: number = this.config.effectsVolume, loop: boolean = false, allowMultiple: boolean = false, category: keyof typeof AUDIO_ASSETS = 'effects', debounceMs: number = 50): void {
    if (!this.config.enabled) return;

    const now = Date.now();
    const lastPlayed = this.lastPlayedTimes.get(key) || 0;

    // Per suoni non-loop senza allowMultiple, applica debouncing
    if (!loop && !allowMultiple && (now - lastPlayed) < debounceMs) {
      // Cancella eventuali timeout precedenti e schedula una nuova riproduzione
      const existingTimeout = this.debounceTimeouts.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      this.debounceTimeouts.set(key, setTimeout(() => {
        this.debounceTimeouts.delete(key);
        this._playSoundInternal(key, volume, loop, allowMultiple, category);
        this.lastPlayedTimes.set(key, Date.now());
      }, debounceMs - (now - lastPlayed)));

      return;
    }

    // Riproduzione immediata
    this._playSoundInternal(key, volume, loop, allowMultiple, category);
    this.lastPlayedTimes.set(key, now);
  }

  private _playSoundInternal(key: string, volume: number, loop: boolean, allowMultiple: boolean, category: keyof typeof AUDIO_ASSETS): void {
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

      // Cerca il path nell'AUDIO_ASSETS nella categoria specificata
      const assetPath = this.getAssetPath(key, category);
      if (!assetPath) {
        console.warn(`Audio system: Asset '${key}' not found in AUDIO_ASSETS.${category}`);
        return;
      }

      // Usa suono precaricato se disponibile (per sincronizzazione perfetta)
      let audio: HTMLAudioElement;
      const audioUrl = `assets/audio/${assetPath}`;

      // Prova a ottenere un'istanza dal pool (più veloce)
      const pooledAudio = this.getAudioFromPool(key);
      if (pooledAudio) {
        audio = pooledAudio;
      } else if (this.preloadedSounds.has(key)) {
        // Fallback: usa l'istanza precaricata se il pool non è disponibile
        audio = this.preloadedSounds.get(key)!;
        audio.currentTime = 0;
      } else {
        // Fallback: carica normalmente se non precaricato
        audio = new Audio(audioUrl);
      }

      // Salva metadati per il ricalcolo del volume
      this.activeSoundCategories.set(soundKey, category);
      this.activeSoundBaseVolumes.set(soundKey, volume);

      // Calcola volume iniziale: Master * Category * Instance(volume argument)
      let categoryVolume = 1.0;
      if (category === 'music') categoryVolume = this.config.musicVolume;
      else if (category === 'effects') categoryVolume = this.config.effectsVolume;
      else if (category === 'ui') categoryVolume = this.config.uiVolume;

      const finalVolume = this.config.masterVolume * categoryVolume * volume;

      if (Number.isFinite(finalVolume)) {
        audio.volume = Math.max(0, Math.min(1, finalVolume));
      } else {
        audio.volume = 0;
      }

      audio.loop = loop;

      // Aggiungi listener per errori di caricamento

      // Gestisci la riproduzione con retry per superare blocchi del browser
      // Per suoni precaricati, la riproduzione dovrebbe essere istantanea
      const playAudio = async (retryCount = 0) => {
        try {
          // Per suoni precaricati, assicurati che siano pronti prima di riprodurre
          if (this.preloadedSounds.has(key) && audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
            // Attendi che il suono precaricato sia pronto (dovrebbe essere già pronto)
            await new Promise((resolve) => {
              if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
                resolve(undefined);
              } else {
                audio.addEventListener('canplaythrough', () => resolve(undefined), { once: true });
              }
            });
          }

          await audio.play();
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
          this.activeSoundCategories.delete(soundKey);
          this.activeSoundBaseVolumes.delete(soundKey);
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
      // Ferma musica precedente se presente (solo se è una chiave diversa)
      if (this.musicInstance && this.musicInstance.src) {
        const currentKey = this.musicInstance.src.split('/').pop()?.replace('.mp3', '') || '';
        if (currentKey !== key) {
          this.musicInstance.pause();
          this.musicInstance.currentTime = 0;
        } else {
          // Stessa musica, non fare nulla
          return;
        }
      }

      // Cerca il path nell'AUDIO_ASSETS
      const assetPath = this.getAssetPath(key, 'music');
      if (!assetPath) {
        console.warn(`Audio system: Asset '${key}' not found in AUDIO_ASSETS.music`);
        return;
      }

      const audioUrl = `assets/audio/${assetPath}`;

      this.musicInstance = new Audio(audioUrl);
      this.musicInstance.volume = this.config.masterVolume * volume;
      this.musicInstance.loop = true;

      // Verifica errori di caricamento
      this.musicInstance.addEventListener('error', (e) => {
        console.error(`Audio system: Error loading music '${key}':`, e);
        if (this.musicInstance?.error) {
          console.error(`Audio system: Error code: ${this.musicInstance.error.code}, message: ${this.musicInstance.error.message}`);
        }
      });

      // Stesso approccio semplice dei suoni normali
      const playMusic = async (retryCount = 0) => {
        try {
          await this.musicInstance!.play();
        } catch (error) {
          if (retryCount < 2) {
            console.warn(`Audio system: Failed to play music '${key}' (attempt ${retryCount + 1}), retrying...`, error);
            setTimeout(() => playMusic(retryCount + 1), 50 * (retryCount + 1));
          } else {
            console.warn(`Audio system: Failed to play music '${key}' after ${retryCount + 1} attempts:`, error);
          }
        }
      };

      playMusic();
    } catch (error) {
      console.warn(`Audio system: Failed to create music '${key}':`, error);
    }
  }

  /**
   * Riproduce un suono ambientale in loop con volume dinamico
   * @param key Chiave dell'asset (es. 'spaceStation')
   * @param volume Volume target (0.0 - 1.0)
   * @param category Categoria per il controllo volume (default: 'effects')
   */
  playAmbience(key: string, volume: number, category: keyof typeof AUDIO_ASSETS = 'effects'): void {
    if (!this.config.enabled) return;

    const soundKey = `ambience_${key}`;
    let audio = this.sounds.get(soundKey);

    // Se volume basso, ferma e rimuovi per risparmiare risorse
    if (volume <= 0.01) {
      if (audio) {
        audio.pause();
        this.sounds.delete(soundKey);
        this.activeSoundCategories.delete(soundKey);
        this.activeSoundBaseVolumes.delete(soundKey);
      }
      return;
    }

    // Se non esiste, crea nuova istanza
    if (!audio) {
      // Cerca in 'music' perché l'abbiamo messo lì nel config, ma permetti override
      const assetPath = this.getAssetPath(key, 'music') || this.getAssetPath(key, 'effects');
      if (!assetPath) return;

      audio = new Audio(`assets/audio/${assetPath}`);
      audio.loop = true;
      this.sounds.set(soundKey, audio);
      this.activeSoundCategories.set(soundKey, category);

      audio.play().catch(e => console.warn(`[AudioSystem] Failed to play ambience ${key}`, e));
    }

    // Aggiorna volume base
    this.activeSoundBaseVolumes.set(soundKey, volume);

    // Applica volume immediato
    const master = this.config.masterVolume;
    const catVol = category === 'music' ? this.config.musicVolume :
      category === 'effects' ? this.config.effectsVolume :
        category === 'ui' ? this.config.uiVolume : 1.0;

    audio.volume = Math.max(0, Math.min(1, master * catVol * volume));
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
    const oldMasterVolume = this.config.masterVolume;
    this.config.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes(oldMasterVolume);
  }

  setMusicVolume(volume: number): void {
    this.config.musicVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  setEffectsVolume(volume: number): void {
    this.config.effectsVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  setUIVolume(volume: number): void {
    this.config.uiVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  // Toggle audio
  toggleAudio(): void {
    const oldStatus = this.config.enabled;
    this.config.enabled = !this.config.enabled;

    if (oldStatus && !this.config.enabled) {
      // Disabilitato: ferma tutto
      this.stopAllSounds();
    }
  }

  stopSound(key: string): void {
    const audio = this.sounds.get(key);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      this.sounds.delete(key);
      this.activeSoundCategories.delete(key);
      this.activeSoundBaseVolumes.delete(key);
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
      const newVolume = this.config.masterVolume * startVolume + (this.config.masterVolume * targetVolume - this.config.masterVolume * startVolume) * easedProgress;

      if (Number.isFinite(newVolume)) {
        audio.volume = Math.max(0, Math.min(1, newVolume));
      }

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

      // Calcola volume relativo di partenza in modo sicuro
      let startRelativeVolume = 0;
      if (this.config.masterVolume > 0.0001) {
        startRelativeVolume = audio.volume / this.config.masterVolume;
      }

      const startTime = Date.now();

      const fadeStep = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Curva ease-out per fade più naturale
        const easedProgress = 1 - Math.pow(1 - progress, 2);
        const newVolume = this.config.masterVolume * (startRelativeVolume * (1 - easedProgress));

        if (Number.isFinite(newVolume)) {
          audio.volume = Math.max(0, Math.min(1, newVolume));
        }

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

  // Mappa per tenere traccia della categoria di ogni suono attivo
  private activeSoundCategories: Map<string, keyof typeof AUDIO_ASSETS> = new Map();
  // Mappa per tenere traccia del volume base (instance volume) di ogni suono attivo
  private activeSoundBaseVolumes: Map<string, number> = new Map();

  private updateAllVolumes(oldMasterVolume?: number): void {
    // Aggiorna volume di tutti gli audio attivi
    this.sounds.forEach((audio, key) => {
      const category = this.activeSoundCategories.get(key) || 'effects';
      const instanceVolume = this.activeSoundBaseVolumes.get(key) || 1.0;

      let categoryVolume = 1.0;
      if (category === 'music') {
        categoryVolume = this.config.musicVolume;
      } else if (category === 'effects') {
        categoryVolume = this.config.effectsVolume;
      } else if (category === 'ui') {
        categoryVolume = this.config.uiVolume;
      }

      // Calcola nuovo volume: Master * Category * Instance
      const newVolume = this.config.masterVolume * categoryVolume * instanceVolume;

      // Applica solo se finito
      if (Number.isFinite(newVolume)) {
        audio.volume = Math.max(0, Math.min(1, newVolume));
      }
    });

    if (this.musicInstance) {
      const newMusicVolume = this.config.masterVolume * this.config.musicVolume;
      if (Number.isFinite(newMusicVolume)) {
        this.musicInstance.volume = Math.max(0, Math.min(1, newMusicVolume));
      }
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
    const oldMasterVolume = this.config.masterVolume;
    this.config = { ...this.config, ...newConfig };
    this.applyConfigChanges(oldMasterVolume);
  }

  private applyConfigChanges(oldMasterVolume?: number): void {
    this.updateAllVolumes(oldMasterVolume);
  }

  private getAssetPath(key: string, category: keyof typeof AUDIO_ASSETS): string | null {
    const categoryAssets = AUDIO_ASSETS[category];
    if (categoryAssets && typeof categoryAssets === 'object' && key in categoryAssets) {
      return categoryAssets[key as keyof typeof categoryAssets] as string;
    }
    return null;
  }

}
