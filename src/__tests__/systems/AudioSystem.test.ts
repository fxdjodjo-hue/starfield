import { describe, it, expect, beforeEach, vi } from 'vitest';
import AudioSystem from '../../systems/audio/AudioSystem';

// Mock di Audio
const mockAudio = {
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  volume: 1.0,
  currentTime: 0,
  loop: false,
  paused: false,
  ended: false,
  addEventListener: vi.fn()
};

describe('AudioSystem', () => {
  let audioSystem: AudioSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock del costruttore Audio
    global.Audio = vi.fn().mockImplementation(() => ({ ...mockAudio })) as any;
    audioSystem = new AudioSystem();
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
      audioSystem = new AudioSystem(customConfig);

      const config = audioSystem.getConfig();
      expect(config.masterVolume).toBe(0.5);
      expect(config.musicVolume).toBe(0.3);
      expect(config.effectsVolume).toBe(0.8); // default
      expect(config.enabled).toBe(false);
    });
  });

  describe('audio playback', () => {
    it('should play sound effects when enabled', () => {
      audioSystem.playSound('effects/laser.wav');

      expect(global.Audio).toHaveBeenCalledWith('/assets/audio/effects/laser.wav');
      expect(mockAudio.play).toHaveBeenCalled();
    });

    it('should not play sounds when disabled', () => {
      audioSystem.updateConfig({ enabled: false });
      audioSystem.playSound('effects/laser.wav');

      expect(global.Audio).not.toHaveBeenCalled();
    });

    it('should play music and stop previous music', () => {
      const mockMusic1 = { ...mockAudio };
      const mockMusic2 = { ...mockAudio };

      (global.Audio as any)
        .mockImplementationOnce(() => mockMusic1)
        .mockImplementationOnce(() => mockMusic2);

      audioSystem.playMusic('music/bgmusic.mp3');
      expect(mockMusic1.play).toHaveBeenCalled();
      expect(mockMusic1.loop).toBe(true);

      audioSystem.playMusic('music/bgmusic.mp3');
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
      const mockMusic = { ...mockAudio };
      (global.Audio as any).mockImplementationOnce(() => mockMusic);

      audioSystem.playMusic('music/bgmusic.mp3');
      audioSystem.setMusicVolume(0.6);

      expect(mockMusic.volume).toBe(0.6);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const mockSound1 = { ...mockAudio, paused: false };
      const mockSound2 = { ...mockAudio, paused: true };

      (global.Audio as any)
        .mockImplementationOnce(() => mockSound1)
        .mockImplementationOnce(() => mockSound2);

      audioSystem.playSound('effects/laser.wav');
      audioSystem.playSound('effects/explosion.wav');
      audioSystem.destroy();

      expect(mockSound1.pause).toHaveBeenCalled();
      expect(mockSound1.currentTime).toBe(0);
      expect(mockSound2.pause).toHaveBeenCalled();
    });
  });
});
