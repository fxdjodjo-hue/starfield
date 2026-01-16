/**
 * Manages player engine sound playback
 */
export class PlayerAudioManager {
  private isEnginePlaying: boolean = false;
  private engineSoundPromise: Promise<void> | null = null;

  constructor(
    private readonly getAudioSystem: () => any | null
  ) {}

  /**
   * Starts engine sound with fade in
   */
  async start(): Promise<void> {
    const audioSystem = this.getAudioSystem();
    if (!audioSystem) return;

    try {
      if (this.isEnginePlaying) return;

      this.isEnginePlaying = true;
      audioSystem.playSound('engine', 0, true);
      audioSystem.fadeInSound('engine', 800, 0.05);
    } catch (error) {
      console.warn('PlayerAudioManager: Error starting engine sound:', error);
      this.isEnginePlaying = false;
    }
  }

  /**
   * Stops engine sound with fade out
   */
  async stop(): Promise<void> {
    const audioSystem = this.getAudioSystem();
    if (!audioSystem) return;

    try {
      if (!this.isEnginePlaying) return;

      this.isEnginePlaying = false;
      await audioSystem.fadeOutSound('engine', 500);
    } catch (error) {
      console.warn('PlayerAudioManager: Error stopping engine sound:', error);
      this.isEnginePlaying = false;
    }
  }

  /**
   * Checks if engine sound is currently playing
   */
  isPlaying(): boolean {
    return this.isEnginePlaying;
  }

  /**
   * Sets the engine sound promise (for preventing concurrent calls)
   */
  setEngineSoundPromise(promise: Promise<void> | null): void {
    this.engineSoundPromise = promise;
  }

  /**
   * Gets the current engine sound promise
   */
  getEngineSoundPromise(): Promise<void> | null {
    return this.engineSoundPromise;
  }
}
