/// <reference types="vite/client" />
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

interface WebAudioActiveSound {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  category: keyof typeof AUDIO_ASSETS;
  baseVolume: number;
}

export default class AudioSystem extends System {
  private config: AudioConfig;
  private audioContext: AudioContext | null = null;

  // HTMLAudio backend (fallback + music + ambience)
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private musicInstance: HTMLAudioElement | null = null;
  private currentMusicKey: string | null = null;

  // Preloaded HTMLAudio pools for quick fallback playback
  private preloadedSounds: Map<string, HTMLAudioElement> = new Map();
  private audioPool: Map<string, HTMLAudioElement[]> = new Map();
  private readonly POOL_SIZE = 3;

  // WebAudio backend (primary for non-music categories)
  private webAudioSounds: Map<string, WebAudioActiveSound> = new Map();
  private webAudioBufferCache: Map<string, AudioBuffer> = new Map();
  private webAudioBufferPromises: Map<string, Promise<AudioBuffer | null>> = new Map();
  private webAudioStartTokens: Map<string, number> = new Map();

  // Debouncing for short one-shot sounds
  private lastPlayedTimes: Map<string, number> = new Map();
  private debounceTimeouts: Map<string, number> = new Map();

  // Settings listeners
  private settingsListenersRegistered = false;
  private masterVolumeListener: ((e: any) => void) | null = null;
  private effectsVolumeListener: ((e: any) => void) | null = null;
  private musicVolumeListener: ((e: any) => void) | null = null;

  // Track metadata for all active sounds, independent from backend
  private activeSoundCategories: Map<string, keyof typeof AUDIO_ASSETS> = new Map();
  private activeSoundBaseVolumes: Map<string, number> = new Map();

  // Precision loop windows for assets that are not seamless on full-file loops
  private readonly loopWindows: Record<string, { start: number; end: number }> = {
    engine: { start: 0.34, end: 1.54 }
  };

  private readonly webAudioCategories = new Set<keyof typeof AUDIO_ASSETS>(['effects', 'ui', 'voice']);
  private readonly HTML_READY_TIMEOUT_MS = 3000;
  private readonly HTML_CLEANUP_FALLBACK_MS = 8000;
  private readonly WEB_STOP_PAD_SECONDS = 0.03;
  private readonly LOOP_ZERO_CROSS_SEARCH_SECONDS = 0.03;
  private readonly LOOP_MIN_DURATION_SECONDS = 0.18;

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
    this.setupAudio();
    void this.preloadImportantSounds();
    this.setupSettingsListeners();

    const settings = GameSettings.getInstance();
    this.setMasterVolume(settings.audio.master / 100);
    this.setEffectsVolume(settings.audio.sfx / 100);
    this.setMusicVolume(settings.audio.music / 100);
  }

  private setupSettingsListeners(): void {
    if (this.settingsListenersRegistered) {
      return;
    }

    this.masterVolumeListener = (e: any) => {
      this.setMasterVolume(e.detail);
    };
    this.effectsVolumeListener = (e: any) => {
      this.setEffectsVolume(e.detail);
    };
    this.musicVolumeListener = (e: any) => {
      this.setMusicVolume(e.detail);
    };

    document.addEventListener('settings:volume:master', this.masterVolumeListener);
    document.addEventListener('settings:volume:sfx', this.effectsVolumeListener);
    document.addEventListener('settings:volume:music', this.musicVolumeListener);
    this.settingsListenersRegistered = true;
  }

  private teardownSettingsListeners(): void {
    if (!this.settingsListenersRegistered) {
      return;
    }

    if (this.masterVolumeListener) {
      document.removeEventListener('settings:volume:master', this.masterVolumeListener);
      this.masterVolumeListener = null;
    }
    if (this.effectsVolumeListener) {
      document.removeEventListener('settings:volume:sfx', this.effectsVolumeListener);
      this.effectsVolumeListener = null;
    }
    if (this.musicVolumeListener) {
      document.removeEventListener('settings:volume:music', this.musicVolumeListener);
      this.musicVolumeListener = null;
    }

    this.settingsListenersRegistered = false;
  }

  /**
   * Preload key effects for lower start latency.
   * We warm both HTML fallback pools and WebAudio decode cache.
   */
  private async preloadImportantSounds(): Promise<void> {
    const importantEffects = ['explosion', 'engine', 'collect'];

    for (const soundKey of importantEffects) {
      const assetPath = this.getAssetPath(soundKey, 'effects');
      if (!assetPath) continue;

      const audioUrl = `assets/audio/${assetPath}`;

      // Warm WebAudio decode cache (non-blocking fallback if unavailable).
      if (this.shouldUseWebAudio('effects')) {
        void this.getDecodedBuffer(audioUrl);
      }

      // Warm HTML fallback pool.
      const pool: HTMLAudioElement[] = [];
      for (let i = 0; i < this.POOL_SIZE; i++) {
        const audio = new Audio(audioUrl);
        audio.volume = 0;
        audio.preload = 'auto';

        const ready = await this.waitForAudioReady(audio, this.HTML_READY_TIMEOUT_MS);
        if (ready) {
          pool.push(audio);
        } else if (import.meta.env.DEV) {
          console.warn(`[AudioSystem] Failed to preload sound ${soundKey} instance ${i}`);
        }
      }

      if (pool.length > 0) {
        this.audioPool.set(soundKey, pool);
        this.preloadedSounds.set(soundKey, pool[0]);
      }
    }
  }

  private waitForAudioReady(audio: HTMLAudioElement, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        audio.removeEventListener('canplaythrough', onReady);
        audio.removeEventListener('error', onError);
        resolve(ok);
      };

      const onReady = () => finish(true);
      const onError = () => finish(false);

      const timeoutId = setTimeout(() => {
        finish(audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA);
      }, timeoutMs);

      audio.addEventListener('canplaythrough', onReady, { once: true });
      audio.addEventListener('error', onError, { once: true });

      try {
        audio.load();
      } catch {
        finish(false);
      }
    });
  }

  private getAudioFromPool(key: string): HTMLAudioElement | null {
    const pool = this.audioPool.get(key);
    if (!pool || pool.length === 0) return null;

    for (const audio of pool) {
      if (audio.paused || audio.ended) {
        audio.currentTime = 0;
        return audio;
      }
    }

    return pool[0];
  }

  update(_deltaTime: number): void {
    // No periodic update required currently.
  }

  destroy(): void {
    this.stopAllSounds();
    this.clearDebounceTimeouts();

    this.audioPool.clear();
    this.preloadedSounds.clear();
    this.webAudioBufferCache.clear();
    this.webAudioBufferPromises.clear();
    this.webAudioStartTokens.clear();
    this.lastPlayedTimes.clear();

    this.teardownSettingsListeners();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close();
    }
    this.audioContext = null;
  }

  private setupAudio(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.installAudioContextUnlockHandlers();
    } catch {
      console.warn('Audio system: Web Audio API not supported, using HTML Audio fallback');
      this.audioContext = null;
    }
  }

  private installAudioContextUnlockHandlers(): void {
    if (!this.audioContext || typeof document === 'undefined') return;

    const context = this.audioContext;

    const cleanup = () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('touchstart', unlock);
    };

    const unlock = () => {
      if (context.state === 'running') {
        cleanup();
        return;
      }
      void context.resume().finally(cleanup);
    };

    document.addEventListener('pointerdown', unlock, { once: true, passive: true });
    document.addEventListener('keydown', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true, passive: true });
  }

  private async ensureAudioContextRunning(): Promise<boolean> {
    if (!this.audioContext) return false;
    if (this.audioContext.state === 'running') return true;

    try {
      await this.audioContext.resume();
    } catch {
      return false;
    }

    const stateAfterResume = this.audioContext.state as AudioContextState;
    return stateAfterResume === 'running';
  }

  /**
   * Positional sound wrapper.
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

    const maxDistance = options.maxDistance || 2000;
    const baseVolume = options.volume !== undefined ? options.volume : 1.0;
    let distanceAttenuation = 1.0;

    try {
      const cameraSystem = this.ecs.getSystems().find(s => s.getName() === 'CameraSystem') as any;

      if (cameraSystem) {
        const camera = cameraSystem.getCamera();
        const dx = x - camera.x;
        const dy = y - camera.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > maxDistance) {
          return;
        }

        const attenuation = 1 - (distance / maxDistance);
        distanceAttenuation = attenuation * attenuation;
      }
    } catch {
      // Keep full volume on positioning errors.
    }

    const finalVolume = baseVolume * distanceAttenuation;
    if (finalVolume < 0.001) return;

    this.playSound(
      key,
      finalVolume,
      options.loop || false,
      options.allowMultiple || false,
      options.category || 'effects',
      options.debounceMs || 50
    );
  }

  playSound(
    key: string,
    volume: number = this.config.effectsVolume,
    loop: boolean = false,
    allowMultiple: boolean = false,
    category: keyof typeof AUDIO_ASSETS = 'effects',
    debounceMs: number = 50
  ): void {
    if (!this.config.enabled) return;

    const now = Date.now();
    const lastPlayed = this.lastPlayedTimes.get(key) || 0;

    if (!loop && !allowMultiple && (now - lastPlayed) < debounceMs) {
      const existingTimeout = this.debounceTimeouts.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      this.debounceTimeouts.set(key, setTimeout(() => {
        this.debounceTimeouts.delete(key);
        this._playSoundInternal(key, volume, loop, allowMultiple, category);
        this.lastPlayedTimes.set(key, Date.now());
      }, debounceMs - (now - lastPlayed)) as unknown as number);

      return;
    }

    this._playSoundInternal(key, volume, loop, allowMultiple, category);
    this.lastPlayedTimes.set(key, now);
  }

  private _playSoundInternal(
    key: string,
    volume: number,
    loop: boolean,
    allowMultiple: boolean,
    category: keyof typeof AUDIO_ASSETS
  ): void {
    try {
      const soundKey = allowMultiple ? `${key}_${Date.now()}_${Math.random()}` : key;

      if (loop) {
        this.stopSound(key);
      } else if (!allowMultiple && (this.sounds.has(soundKey) || this.webAudioSounds.has(soundKey))) {
        return;
      }

      const assetPath = this.getAssetPath(key, category);
      if (!assetPath) {
        console.warn(`Audio system: Asset '${key}' not found in AUDIO_ASSETS.${category}`);
        return;
      }

      const audioUrl = `assets/audio/${assetPath}`;

      // Track metadata regardless of backend.
      this.activeSoundCategories.set(soundKey, category);
      this.activeSoundBaseVolumes.set(soundKey, volume);

      if (this.shouldUseWebAudio(category)) {
        const scheduled = this.playWebAudioSound(key, soundKey, audioUrl, volume, loop, category, () => {
          this.playHtmlSound(key, soundKey, audioUrl, volume, loop, allowMultiple, category);
        });

        if (scheduled) {
          return;
        }
      }

      this.playHtmlSound(key, soundKey, audioUrl, volume, loop, allowMultiple, category);
    } catch (error) {
      console.warn(`Audio system: Failed to create sound '${key}':`, error);
    }
  }

  private shouldUseWebAudio(category: keyof typeof AUDIO_ASSETS): boolean {
    return !!this.audioContext && this.webAudioCategories.has(category);
  }

  private playWebAudioSound(
    key: string,
    soundKey: string,
    audioUrl: string,
    volume: number,
    loop: boolean,
    category: keyof typeof AUDIO_ASSETS,
    fallbackToHtml: () => void
  ): boolean {
    if (!this.audioContext) return false;

    const token = this.createWebAudioStartToken(soundKey);

    void this.startWebAudioSound(key, soundKey, audioUrl, volume, loop, category, token)
      .then((started) => {
        if (!started && this.isWebAudioTokenCurrent(soundKey, token)) {
          this.clearWebAudioStartToken(soundKey, token);
          fallbackToHtml();
        }
      })
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.warn(`[AudioSystem] WebAudio playback failed for '${soundKey}', fallback to HTMLAudio`, error);
        }

        if (this.isWebAudioTokenCurrent(soundKey, token)) {
          this.clearWebAudioStartToken(soundKey, token);
          fallbackToHtml();
        }
      });

    return true;
  }

  private async startWebAudioSound(
    key: string,
    soundKey: string,
    audioUrl: string,
    baseVolume: number,
    loop: boolean,
    category: keyof typeof AUDIO_ASSETS,
    token: number
  ): Promise<boolean> {
    const context = this.audioContext;
    if (!context) return false;

    const unlocked = await this.ensureAudioContextRunning();
    if (!unlocked) return false;
    if (!this.isWebAudioTokenCurrent(soundKey, token) || !this.config.enabled) return false;

    const buffer = await this.getDecodedBuffer(audioUrl);
    if (!buffer) return false;
    if (!this.isWebAudioTokenCurrent(soundKey, token) || !this.config.enabled) return false;

    const source = context.createBufferSource();
    source.buffer = buffer;

    const resolvedBaseVolume = this.activeSoundBaseVolumes.get(soundKey) ?? baseVolume;
    const gainNode = context.createGain();
    gainNode.gain.value = this.toFinalVolume(resolvedBaseVolume, category);

    source.connect(gainNode);
    gainNode.connect(context.destination);

    let startOffset = 0;
    if (loop) {
      source.loop = true;

      const loopWindow = this.getLoopWindowForBuffer(key, buffer);
      if (loopWindow) {
        source.loopStart = loopWindow.start;
        source.loopEnd = loopWindow.end;
        startOffset = loopWindow.start;
      }
    }

    const activeSound: WebAudioActiveSound = {
      source,
      gainNode,
      category,
      baseVolume: resolvedBaseVolume
    };

    this.webAudioSounds.set(soundKey, activeSound);

    source.onended = () => {
      const tracked = this.webAudioSounds.get(soundKey);
      if (!tracked || tracked.source !== source) return;
      this.cleanupWebAudioSound(soundKey, tracked);
    };

    source.start(0, startOffset);
    this.clearWebAudioStartToken(soundKey, token);

    return true;
  }

  private async getDecodedBuffer(audioUrl: string): Promise<AudioBuffer | null> {
    if (!this.audioContext) return null;

    const cached = this.webAudioBufferCache.get(audioUrl);
    if (cached) return cached;

    const pending = this.webAudioBufferPromises.get(audioUrl);
    if (pending) return pending;

    const loadPromise = (async () => {
      try {
        const response = await fetch(audioUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.arrayBuffer();
        const context = this.audioContext;
        if (!context) return null;

        const decoded = await context.decodeAudioData(data.slice(0));
        this.webAudioBufferCache.set(audioUrl, decoded);
        return decoded;
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn(`[AudioSystem] Failed to decode audio buffer '${audioUrl}'`, error);
        }
        return null;
      } finally {
        this.webAudioBufferPromises.delete(audioUrl);
      }
    })();

    this.webAudioBufferPromises.set(audioUrl, loadPromise);
    return loadPromise;
  }

  private getLoopWindowForBuffer(key: string, buffer: AudioBuffer): { start: number; end: number } | null {
    const configured = this.loopWindows[key];
    if (!configured) return null;

    const duration = Number(buffer.duration || 0);
    if (!Number.isFinite(duration) || duration <= 0.05) return null;

    const sampleRate = buffer.sampleRate;
    const maxSample = Math.max(1, buffer.length - 2);

    let startSample = Math.max(0, Math.min(Math.round(configured.start * sampleRate), maxSample));
    let endSample = Math.max(startSample + 1, Math.min(Math.round(configured.end * sampleRate), maxSample));

    const minLoopSamples = Math.max(32, Math.floor(sampleRate * this.LOOP_MIN_DURATION_SECONDS));
    const searchRadius = Math.max(8, Math.floor(sampleRate * this.LOOP_ZERO_CROSS_SEARCH_SECONDS));
    const channelData = buffer.getChannelData(0);

    const alignedStart = this.findNearestZeroCrossingSample(
      channelData,
      startSample,
      searchRadius,
      null,
      0,
      maxSample
    );
    if (alignedStart !== null) {
      startSample = alignedStart;
    }

    const preferredDirection = this.getZeroCrossingDirection(channelData, startSample);

    let alignedEnd = this.findBestLoopEndSample(
      channelData,
      startSample,
      endSample,
      searchRadius,
      preferredDirection,
      Math.min(maxSample, startSample + 1),
      maxSample
    );

    if (alignedEnd !== null) {
      endSample = alignedEnd;
    }

    if (endSample - startSample < minLoopSamples) {
      const desiredEnd = Math.min(maxSample, startSample + minLoopSamples);
      const expandedEnd = this.findBestLoopEndSample(
        channelData,
        startSample,
        desiredEnd,
        searchRadius,
        preferredDirection,
        Math.min(maxSample, startSample + 1),
        maxSample
      );
      if (expandedEnd !== null && expandedEnd > startSample + 1) {
        endSample = expandedEnd;
      } else {
        endSample = Math.max(startSample + 1, desiredEnd);
      }
    }

    if (endSample <= startSample + 1) return null;

    const loopStart = startSample / sampleRate;
    const loopEnd = endSample / sampleRate;
    if (!(loopEnd > loopStart)) return null;

    return { start: loopStart, end: loopEnd };
  }

  private findNearestZeroCrossingSample(
    samples: Float32Array,
    targetSample: number,
    searchRadius: number,
    preferredDirection: 1 | -1 | null,
    minSample: number,
    maxSample: number
  ): number | null {
    const lowerBound = Math.max(0, minSample);
    const upperBound = Math.min(samples.length - 2, maxSample);
    if (upperBound <= lowerBound) return null;

    const clampedTarget = Math.max(lowerBound, Math.min(targetSample, upperBound));

    for (let offset = 0; offset <= searchRadius; offset++) {
      const left = clampedTarget - offset;
      if (left >= lowerBound) {
        const leftDirection = this.getZeroCrossingDirection(samples, left);
        if (leftDirection !== null && (preferredDirection === null || leftDirection === preferredDirection)) {
          return left;
        }
      }

      if (offset === 0) continue;

      const right = clampedTarget + offset;
      if (right <= upperBound) {
        const rightDirection = this.getZeroCrossingDirection(samples, right);
        if (rightDirection !== null && (preferredDirection === null || rightDirection === preferredDirection)) {
          return right;
        }
      }
    }

    return null;
  }

  private findBestLoopEndSample(
    samples: Float32Array,
    loopStartSample: number,
    targetSample: number,
    searchRadius: number,
    preferredDirection: 1 | -1 | null,
    minSample: number,
    maxSample: number
  ): number | null {
    const tryFind = (direction: 1 | -1 | null): number | null => {
      const lowerBound = Math.max(0, minSample, targetSample - searchRadius);
      const upperBound = Math.min(samples.length - 2, maxSample, targetSample + searchRadius);
      if (upperBound <= lowerBound) return null;

      const startA = samples[loopStartSample];
      const startB = samples[Math.min(samples.length - 1, loopStartSample + 1)];

      let bestIndex: number | null = null;
      let bestScore = Number.POSITIVE_INFINITY;

      for (let i = lowerBound; i <= upperBound; i++) {
        const crossingDir = this.getZeroCrossingDirection(samples, i);
        if (crossingDir === null) continue;
        if (direction !== null && crossingDir !== direction) continue;

        const endA = samples[i];
        const endB = samples[i + 1];
        const continuityScore = Math.abs(endA - startA) + Math.abs(endB - startB);
        const distancePenalty = Math.abs(i - targetSample) * 0.0002;
        const score = continuityScore + distancePenalty;

        if (score < bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }

      return bestIndex;
    };

    const bestWithDirection = tryFind(preferredDirection);
    if (bestWithDirection !== null) return bestWithDirection;
    return tryFind(null);
  }

  private getZeroCrossingDirection(samples: Float32Array, index: number): 1 | -1 | null {
    if (index < 0 || index + 1 >= samples.length) return null;
    const a = samples[index];
    const b = samples[index + 1];

    if (a <= 0 && b > 0) return 1;
    if (a >= 0 && b < 0) return -1;
    return null;
  }

  private playHtmlSound(
    key: string,
    soundKey: string,
    audioUrl: string,
    volume: number,
    loop: boolean,
    allowMultiple: boolean,
    category: keyof typeof AUDIO_ASSETS
  ): void {
    let audio: HTMLAudioElement;

    const pooledAudio = !loop && !allowMultiple ? this.getAudioFromPool(key) : null;
    if (pooledAudio) {
      audio = pooledAudio;
    } else if (!loop && !allowMultiple && this.preloadedSounds.has(key)) {
      audio = this.preloadedSounds.get(key)!;
      audio.currentTime = 0;
    } else {
      audio = new Audio(audioUrl);
    }

    const resolvedBaseVolume = this.activeSoundBaseVolumes.get(soundKey) ?? volume;
    audio.loop = loop;
    audio.volume = this.toFinalVolume(resolvedBaseVolume, category);
    this.activeSoundBaseVolumes.set(soundKey, resolvedBaseVolume);

    this.sounds.set(soundKey, audio);

    const cleanup = () => {
      this.cleanupHtmlSound(soundKey, audio);
    };

    if (!loop) {
      audio.addEventListener('ended', cleanup, { once: true });

      setTimeout(() => {
        if (this.sounds.get(soundKey) === audio && (audio.ended || audio.paused)) {
          cleanup();
        }
      }, this.HTML_CLEANUP_FALLBACK_MS);
    }

    const playAudio = async (retryCount = 0) => {
      try {
        await audio.play();
      } catch (error) {
        if (retryCount < 2) {
          setTimeout(() => {
            void playAudio(retryCount + 1);
          }, 50 * (retryCount + 1));
        } else {
          if (import.meta.env.DEV) {
            console.warn(`Audio system: Failed to play '${soundKey}' after retries`, error);
          }
          cleanup();
        }
      }
    };

    void playAudio();
  }

  private cleanupHtmlSound(soundKey: string, expectedAudio?: HTMLAudioElement): void {
    const current = this.sounds.get(soundKey);
    if (!current) return;
    if (expectedAudio && current !== expectedAudio) return;

    current.pause();
    current.currentTime = 0;

    this.sounds.delete(soundKey);
    this.activeSoundCategories.delete(soundKey);
    this.activeSoundBaseVolumes.delete(soundKey);
  }

  private cleanupWebAudioSound(soundKey: string, expectedSound?: WebAudioActiveSound): void {
    const tracked = this.webAudioSounds.get(soundKey);
    if (!tracked) return;
    if (expectedSound && tracked !== expectedSound) return;

    tracked.source.onended = null;

    try {
      tracked.source.disconnect();
    } catch {
      // no-op
    }

    try {
      tracked.gainNode.disconnect();
    } catch {
      // no-op
    }

    this.webAudioSounds.delete(soundKey);
    this.activeSoundCategories.delete(soundKey);
    this.activeSoundBaseVolumes.delete(soundKey);
  }

  private stopWebAudioSound(soundKey: string): void {
    const tracked = this.webAudioSounds.get(soundKey);
    if (!tracked) return;

    tracked.source.onended = null;

    try {
      tracked.source.stop();
    } catch {
      // already stopped
    }

    this.cleanupWebAudioSound(soundKey, tracked);
  }

  private createWebAudioStartToken(soundKey: string): number {
    const next = (this.webAudioStartTokens.get(soundKey) || 0) + 1;
    this.webAudioStartTokens.set(soundKey, next);
    return next;
  }

  private isWebAudioTokenCurrent(soundKey: string, token: number): boolean {
    return this.webAudioStartTokens.get(soundKey) === token;
  }

  private clearWebAudioStartToken(soundKey: string, token: number): void {
    if (this.webAudioStartTokens.get(soundKey) === token) {
      this.webAudioStartTokens.delete(soundKey);
    }
  }

  private invalidateWebAudioStart(soundKey: string): void {
    this.createWebAudioStartToken(soundKey);
  }

  playMusic(key: string, volume: number = this.config.musicVolume): void {
    if (!this.config.enabled) return;

    try {
      if (this.musicInstance && this.currentMusicKey === key) {
        return;
      }

      if (this.musicInstance) {
        this.musicInstance.pause();
        this.musicInstance.currentTime = 0;
      }

      const assetPath = this.getAssetPath(key, 'music');
      if (!assetPath) {
        console.warn(`Audio system: Asset '${key}' not found in AUDIO_ASSETS.music`);
        return;
      }

      const audioUrl = `assets/audio/${assetPath}`;

      this.musicInstance = new Audio(audioUrl);
      this.currentMusicKey = key;
      this.musicInstance.volume = 0;
      this.musicInstance.loop = true;

      this.musicInstance.addEventListener('error', (e) => {
        if (import.meta.env.DEV) {
          console.error(`Audio system: Error loading music '${key}':`, e);
        }
      });

      const targetVolume = this.clamp01(this.config.masterVolume * volume);

      const playMusic = async (retryCount = 0) => {
        try {
          await this.musicInstance!.play();

          const duration = 2000;
          const startTime = Date.now();

          const fadeStep = () => {
            if (!this.musicInstance || this.currentMusicKey !== key) return;

            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = progress * progress;
            const newVolume = targetVolume * easedProgress;

            this.musicInstance.volume = this.clamp01(newVolume);

            if (progress < 1) {
              requestAnimationFrame(fadeStep);
            }
          };

          fadeStep();
        } catch (error) {
          if (retryCount < 2) {
            setTimeout(() => {
              void playMusic(retryCount + 1);
            }, 50 * (retryCount + 1));
          } else if (import.meta.env.DEV) {
            console.warn(`Audio system: Failed to play music '${key}' after retries`, error);
          }
        }
      };

      void playMusic();
    } catch (error) {
      console.warn(`Audio system: Failed to create music '${key}':`, error);
    }
  }

  /**
   * Ambient loop with dynamic volume updates.
   */
  playAmbience(key: string, volume: number, category: keyof typeof AUDIO_ASSETS = 'effects'): void {
    if (!this.config.enabled) return;

    const soundKey = `ambience_${key}`;
    let audio = this.sounds.get(soundKey);

    if (volume <= 0.01) {
      this.stopSound(soundKey);
      return;
    }

    if (!audio) {
      const assetPath = this.getAssetPath(key, 'music') || this.getAssetPath(key, 'effects');
      if (!assetPath) return;

      audio = new Audio(`assets/audio/${assetPath}`);
      audio.loop = true;
      this.sounds.set(soundKey, audio);
      this.activeSoundCategories.set(soundKey, category);

      void audio.play().catch((e) => {
        if (import.meta.env.DEV) {
          console.warn(`[AudioSystem] Failed to play ambience ${key}`, e);
        }
      });
    }

    this.activeSoundBaseVolumes.set(soundKey, volume);
    audio.volume = this.toFinalVolume(volume, category);
  }

  stopMusic(): void {
    if (this.musicInstance) {
      this.musicInstance.pause();
      this.musicInstance.currentTime = 0;
    }
    this.musicInstance = null;
    this.currentMusicKey = null;
  }

  pauseMusic(): void {
    if (this.musicInstance) {
      this.musicInstance.pause();
    }
  }

  resumeMusic(): void {
    if (this.musicInstance) {
      void this.musicInstance.play();
    }
  }

  // Volume controls
  setMasterVolume(volume: number): void {
    this.config.masterVolume = this.clamp01(volume);
    this.updateAllVolumes();
  }

  setMusicVolume(volume: number): void {
    this.config.musicVolume = this.clamp01(volume);
    this.updateAllVolumes();
  }

  setEffectsVolume(volume: number): void {
    this.config.effectsVolume = this.clamp01(volume);
    this.updateAllVolumes();
  }

  setUIVolume(volume: number): void {
    this.config.uiVolume = this.clamp01(volume);
    this.updateAllVolumes();
  }

  // Toggle audio
  toggleAudio(): void {
    const oldStatus = this.config.enabled;
    this.config.enabled = !this.config.enabled;

    if (oldStatus && !this.config.enabled) {
      this.stopAllSounds();
      this.clearDebounceTimeouts();
    }
  }

  stopSound(key: string): void {
    this.invalidateWebAudioStart(key);

    const webSound = this.webAudioSounds.get(key);
    if (webSound) {
      this.stopWebAudioSound(key);
    }

    const htmlAudio = this.sounds.get(key);
    if (htmlAudio) {
      htmlAudio.pause();
      htmlAudio.currentTime = 0;
      this.sounds.delete(key);
    }

    this.activeSoundCategories.delete(key);
    this.activeSoundBaseVolumes.delete(key);
  }

  /**
   * Fade in active sound to target base volume.
   */
  fadeInSound(key: string, duration: number = 500, targetVolume: number = this.config.effectsVolume): void {
    const targetBase = Math.max(0, targetVolume);
    this.activeSoundBaseVolumes.set(key, targetBase);

    const webSound = this.webAudioSounds.get(key);
    if (webSound && this.audioContext) {
      const now = this.audioContext.currentTime;
      const currentGain = webSound.gainNode.gain.value;
      const targetGain = this.toFinalVolume(targetBase, webSound.category);

      webSound.baseVolume = targetBase;

      webSound.gainNode.gain.cancelScheduledValues(now);
      webSound.gainNode.gain.setValueAtTime(currentGain, now);
      webSound.gainNode.gain.linearRampToValueAtTime(targetGain, now + duration / 1000);
      return;
    }

    const audio = this.sounds.get(key);
    if (!audio) return;

    const category = this.activeSoundCategories.get(key) || 'effects';
    const startVolume = this.clamp01(audio.volume);
    const targetAbsolute = this.toFinalVolume(targetBase, category);
    const startTime = Date.now();

    const fadeStep = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = progress * progress;
      const newVolume = startVolume + (targetAbsolute - startVolume) * easedProgress;

      audio.volume = this.clamp01(newVolume);

      if (progress < 1) {
        requestAnimationFrame(fadeStep);
      }
    };

    fadeStep();
  }

  /**
   * Fade out sound and stop it.
   */
  fadeOutSound(key: string, duration: number = 300): Promise<void> {
    const webSound = this.webAudioSounds.get(key);
    if (webSound) {
      return this.fadeOutWebAudioSound(key, duration);
    }

    return new Promise((resolve) => {
      const audio = this.sounds.get(key);
      if (!audio) {
        resolve();
        return;
      }

      this.invalidateWebAudioStart(key);

      const startVolume = this.clamp01(audio.volume);
      const startTime = Date.now();

      const fadeStep = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 2);
        const newVolume = startVolume * (1 - easedProgress);

        audio.volume = this.clamp01(newVolume);

        if (progress < 1) {
          requestAnimationFrame(fadeStep);
        } else {
          audio.pause();
          audio.currentTime = 0;
          this.sounds.delete(key);
          this.activeSoundCategories.delete(key);
          this.activeSoundBaseVolumes.delete(key);
          resolve();
        }
      };

      fadeStep();
    });
  }

  private fadeOutWebAudioSound(key: string, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const sound = this.webAudioSounds.get(key);
      const context = this.audioContext;

      if (!sound || !context) {
        resolve();
        return;
      }

      this.invalidateWebAudioStart(key);

      const now = context.currentTime;
      const endTime = now + duration / 1000;
      const startGain = this.clamp01(sound.gainNode.gain.value);

      sound.gainNode.gain.cancelScheduledValues(now);
      sound.gainNode.gain.setValueAtTime(startGain, now);
      sound.gainNode.gain.linearRampToValueAtTime(0, endTime);

      const tracked = sound;

      tracked.source.onended = () => {
        this.cleanupWebAudioSound(key, tracked);
        resolve();
      };

      try {
        tracked.source.stop(endTime + this.WEB_STOP_PAD_SECONDS);
      } catch {
        this.cleanupWebAudioSound(key, tracked);
        resolve();
      }

      setTimeout(() => {
        if (this.webAudioSounds.get(key) === tracked) {
          this.cleanupWebAudioSound(key, tracked);
        }
        resolve();
      }, duration + 120);
    });
  }

  private stopAllSounds(): void {
    this.webAudioStartTokens.clear();

    for (const soundKey of Array.from(this.webAudioSounds.keys())) {
      this.stopWebAudioSound(soundKey);
    }

    this.sounds.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.sounds.clear();

    this.activeSoundCategories.clear();
    this.activeSoundBaseVolumes.clear();

    this.stopMusic();
  }

  private clearDebounceTimeouts(): void {
    this.debounceTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.debounceTimeouts.clear();
  }

  private getCategoryVolume(category: keyof typeof AUDIO_ASSETS): number {
    if (category === 'music') return this.config.musicVolume;
    if (category === 'ui') return this.config.uiVolume;
    // Voice currently follows effects volume bucket.
    return this.config.effectsVolume;
  }

  private toFinalVolume(baseVolume: number, category: keyof typeof AUDIO_ASSETS): number {
    return this.clamp01(this.config.masterVolume * this.getCategoryVolume(category) * baseVolume);
  }

  private clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }

  private updateAllVolumes(): void {
    this.sounds.forEach((audio, key) => {
      const category = this.activeSoundCategories.get(key) || 'effects';
      const baseVolume = this.activeSoundBaseVolumes.get(key) || 1.0;
      audio.volume = this.toFinalVolume(baseVolume, category);
    });

    this.webAudioSounds.forEach((sound, key) => {
      const category = this.activeSoundCategories.get(key) || sound.category;
      const baseVolume = this.activeSoundBaseVolumes.get(key) ?? sound.baseVolume;
      sound.baseVolume = baseVolume;

      if (this.audioContext) {
        sound.gainNode.gain.setValueAtTime(this.toFinalVolume(baseVolume, category), this.audioContext.currentTime);
      } else {
        sound.gainNode.gain.value = this.toFinalVolume(baseVolume, category);
      }
    });

    if (this.musicInstance) {
      this.musicInstance.volume = this.clamp01(this.config.masterVolume * this.config.musicVolume);
    }
  }

  // Utility methods
  isSoundPlaying(key: string): boolean {
    if (this.webAudioSounds.has(key)) {
      return true;
    }

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
