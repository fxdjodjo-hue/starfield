import { describe, it, expect, beforeEach, vi } from 'vitest';
import AudioSystem from '../../systems/audio/AudioSystem';

// Mock di Phaser Scene
const mockScene = {
  sound: {
    add: vi.fn(),
    volume: 1.0
  }
};

describe('AudioSystem', () => {
  let audioSystem: AudioSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    audioSystem = new AudioSystem(mockScene as any);
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
      audioSystem = new AudioSystem(mockScene as any, customConfig);

      const config = audioSystem.getConfig();
      expect(config.masterVolume).toBe(0.5);
      expect(config.musicVolume).toBe(0.3);
      expect(config.effectsVolume).toBe(0.8); // default
      expect(config.enabled).toBe(false);
    });
  });

  describe('audio playback', () => {
    it('should play sound effects when enabled', () => {
      const mockSound = {
        play: vi.fn(),
        isPlaying: false,
        stop: vi.fn()
      };
      mockScene.sound.add.mockReturnValue(mockSound);

      audioSystem.playSound('test_sound');

      expect(mockScene.sound.add).toHaveBeenCalledWith('test_sound', {
        volume: 0.8
      });
      expect(mockSound.play).toHaveBeenCalled();
    });

    it('should not play sounds when disabled', () => {
      audioSystem.updateConfig({ enabled: false });
      audioSystem.playSound('test_sound');

      expect(mockScene.sound.add).not.toHaveBeenCalled();
    });

    it('should play music and stop previous music', () => {
      const mockMusic1 = {
        play: vi.fn(),
        stop: vi.fn(),
        isPlaying: true,
        pause: vi.fn(),
        resume: vi.fn(),
        setVolume: vi.fn()
      };
      const mockMusic2 = {
        play: vi.fn(),
        stop: vi.fn(),
        isPlaying: false,
        pause: vi.fn(),
        resume: vi.fn(),
        setVolume: vi.fn()
      };

      mockScene.sound.add
        .mockReturnValueOnce(mockMusic1)
        .mockReturnValueOnce(mockMusic2);

      audioSystem.playMusic('music1');
      expect(mockMusic1.play).toHaveBeenCalled();

      audioSystem.playMusic('music2');
      expect(mockMusic1.stop).toHaveBeenCalled();
      expect(mockMusic2.play).toHaveBeenCalled();
    });
  });

  describe('volume controls', () => {
    it('should set master volume', () => {
      audioSystem.setMasterVolume(0.5);
      expect(mockScene.sound.volume).toBe(0.5);
    });

    it('should clamp volume values', () => {
      audioSystem.setMasterVolume(-0.5);
      expect(mockScene.sound.volume).toBe(0);

      audioSystem.setMasterVolume(1.5);
      expect(mockScene.sound.volume).toBe(1);
    });

    it('should set music volume', () => {
      const mockMusic = {
        play: vi.fn(),
        stop: vi.fn(),
        isPlaying: true,
        pause: vi.fn(),
        resume: vi.fn(),
        setVolume: vi.fn()
      };
      mockScene.sound.add.mockReturnValue(mockMusic);

      audioSystem.playMusic('test');
      audioSystem.setMusicVolume(0.6);

      expect(mockMusic.setVolume).toHaveBeenCalledWith(0.6);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const mockSound1 = {
        play: vi.fn(),
        stop: vi.fn(),
        isPlaying: true
      };
      const mockSound2 = {
        play: vi.fn(),
        stop: vi.fn(),
        isPlaying: false
      };

      mockScene.sound.add
        .mockReturnValueOnce(mockSound1)
        .mockReturnValueOnce(mockSound2);

      audioSystem.playSound('sound1');
      audioSystem.playSound('sound2');
      audioSystem.destroy();

      expect(mockSound1.stop).toHaveBeenCalled();
      expect(mockSound2.stop).not.toHaveBeenCalled();
    });
  });
});
