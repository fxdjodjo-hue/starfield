import { describe, it, expect, beforeEach, vi } from 'vitest';
import AudioSystem from '../../systems/audio/AudioSystem';
import { ECS } from '../../infrastructure/ecs/ECS';

// Mock di Audio
const createMockAudio = () => ({
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  volume: 1.0,
  currentTime: 0,
  loop: false,
  paused: false,
  ended: false,
  addEventListener: vi.fn()
});

describe('AudioSystem', () => {
  let audioSystem: AudioSystem;
  let mockEcs: ECS;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create mock ECS
    mockEcs = new ECS();
    // Mock del costruttore Audio
    const MockAudio = vi.fn().mockImplementation(() => createMockAudio());
    global.Audio = MockAudio as any;
    audioSystem = new AudioSystem(mockEcs);
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const config = audioSystem.getConfig();
      expect(config.masterVolume).toBe(1.0);
      expect(config.musicVolume).toBe(0.7);
      expect(config.effectsVolume).toBe(0.8);
      expect(config.uiVolume).toBe(0.9);
      expect(config.enabled).toBe(true);
    });

    it('should initialize with custom config', () => {
      const customConfig = {
        masterVolume: 0.5,
        musicVolume: 0.3,
        enabled: false
      };
      audioSystem = new AudioSystem(mockEcs, customConfig);

      const config = audioSystem.getConfig();
      expect(config.masterVolume).toBe(0.5);
      expect(config.musicVolume).toBe(0.3);
      expect(config.effectsVolume).toBe(0.8); // default
      expect(config.enabled).toBe(false);
    });
  });

  describe('audio playback', () => {
    it('should play sound effects when enabled', () => {
      audioSystem.playSound('laser');

      expect(global.Audio).toHaveBeenCalledWith('/assets/audio/effects/laser/laser_red.wav');
      expect((global.Audio as any).mock.results[0].value.play).toHaveBeenCalled();
    });

    it('should not play sounds when disabled', () => {
      audioSystem.updateConfig({ enabled: false });
      audioSystem.playSound('laser');

      expect(global.Audio).not.toHaveBeenCalled();
    });

    it('should play music and stop previous music', () => {
      const mockMusic1 = createMockAudio();
      const mockMusic2 = createMockAudio();

      (global.Audio as any)
        .mockImplementationOnce(() => mockMusic1)
        .mockImplementationOnce(() => mockMusic2);

      audioSystem.playMusic('background');
      expect(mockMusic1.play).toHaveBeenCalled();
      expect(mockMusic1.loop).toBe(true);

      audioSystem.playMusic('background');
      expect(mockMusic1.pause).toHaveBeenCalled();
      expect(mockMusic1.currentTime).toBe(0);
      expect(mockMusic2.play).toHaveBeenCalled();
    });
  });

  describe('volume controls', () => {
    it('should set master volume', () => {
      audioSystem.setMasterVolume(0.5);
      expect(audioSystem.getConfig().masterVolume).toBe(0.5);
    });

    it('should clamp volume values', () => {
      audioSystem.setMasterVolume(-0.5);
      expect(audioSystem.getConfig().masterVolume).toBe(0);

      audioSystem.setMasterVolume(1.5);
      expect(audioSystem.getConfig().masterVolume).toBe(1);
    });

    it('should set music volume', () => {
      const mockMusic = createMockAudio();
      (global.Audio as any).mockImplementationOnce(() => mockMusic);

      audioSystem.playMusic('background');
      audioSystem.setMusicVolume(0.6);

      expect(mockMusic.volume).toBe(0.6);
    });
  });

  describe('debouncing', () => {
    let clearTimeoutSpy: any;

    beforeEach(() => {
      vi.useFakeTimers();
      clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    });

    afterEach(() => {
      vi.useRealTimers();
      clearTimeoutSpy.mockRestore();
    });

    it('should debounce rapid calls to the same sound', () => {
      // Prima chiamata immediata
      audioSystem.playSound('laser', 1.0, false, false, 'effects', 100);
      expect(global.Audio).toHaveBeenCalledTimes(1);

      // Seconda chiamata entro il periodo di debouncing
      audioSystem.playSound('laser', 1.0, false, false, 'effects', 100);
      expect(global.Audio).toHaveBeenCalledTimes(1); // Non dovrebbe creare un nuovo suono

      // Avanza il tempo oltre il periodo di debouncing
      vi.advanceTimersByTime(100);

      // Ora dovrebbe riprodurre il suono
      expect(global.Audio).toHaveBeenCalledTimes(2);
    });

    it('should allow multiple different sounds simultaneously', () => {
      audioSystem.playSound('laser', 1.0, false, false, 'effects', 100);
      audioSystem.playSound('explosion', 1.0, false, false, 'effects', 100);

      expect(global.Audio).toHaveBeenCalledTimes(2);
    });

    it('should not debounce sounds with allowMultiple=true', () => {
      audioSystem.playSound('laser', 1.0, false, true, 'effects', 100);
      audioSystem.playSound('laser', 1.0, false, true, 'effects', 100);

      expect(global.Audio).toHaveBeenCalledTimes(2);
    });

    it('should not debounce loop sounds', () => {
      audioSystem.playSound('engine', 1.0, true, false, 'effects', 100);
      audioSystem.playSound('engine', 1.0, true, false, 'effects', 100);

      expect(global.Audio).toHaveBeenCalledTimes(2); // Loop sounds should stop previous and start new
    });

    it('should cleanup debounce timeouts on destroy', () => {
      audioSystem.playSound('laser', 1.0, false, false, 'effects', 100);
      audioSystem.playSound('laser', 1.0, false, false, 'effects', 100); // This should be debounced

      audioSystem.destroy();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const mockSound1 = { ...createMockAudio(), paused: false };
      const mockSound2 = { ...createMockAudio(), paused: true };

      (global.Audio as any)
        .mockImplementationOnce(() => mockSound1)
        .mockImplementationOnce(() => mockSound2);

      audioSystem.playSound('laser');
      audioSystem.playSound('explosion');
      audioSystem.destroy();

      expect(mockSound1.pause).toHaveBeenCalled();
      expect(mockSound1.currentTime).toBe(0);
      expect(mockSound2.pause).toHaveBeenCalled();
    });
  });
});
