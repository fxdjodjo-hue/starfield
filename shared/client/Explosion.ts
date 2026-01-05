import { Component } from '../core/infrastructure/ecs/Component';

/**
 * Componente esplosione - gestisce l'animazione dell'esplosione quando un'entità muore
 * L'esplosione è composta da più frame che vengono mostrati in sequenza
 */
export class Explosion extends Component {
  public frames: HTMLImageElement[];
  public currentFrame: number;
  public frameTime: number;
  public frameDuration: number; // millisecondi per frame
  public isFinished: boolean;

  constructor(frames: HTMLImageElement[], frameDuration: number = 100) {
    super();
    this.frames = frames;
    this.currentFrame = 0;
    this.frameTime = 0;
    this.frameDuration = frameDuration;
    this.isFinished = false;
  }

  /**
   * Aggiorna l'animazione dell'esplosione
   */
  update(deltaTime: number): void {
    if (this.isFinished) return;

    this.frameTime += deltaTime;

    // Passa al frame successivo se è passato abbastanza tempo
    if (this.frameTime >= this.frameDuration) {
      this.currentFrame++;
      this.frameTime = 0;

      // Controlla se l'animazione è finita
      if (this.currentFrame >= this.frames.length) {
        this.isFinished = true;
      }
    }
  }

  /**
   * Ottiene il frame corrente dell'animazione
   */
  getCurrentFrame(): HTMLImageElement | null {
    if (this.currentFrame >= this.frames.length) {
      return null;
    }
    return this.frames[this.currentFrame];
  }

  /**
   * Verifica se l'animazione è completa
   */
  isAnimationFinished(): boolean {
    return this.isFinished;
  }
}
