import { Component } from '/src/infrastructure/ecs/Component';

/**
 * Componente esplosione - gestisce l'animazione dell'esplosione quando un'entità muore
 * Supporta sia animazioni a frame multipli che immagini singole
 */
export class Explosion extends Component {
  public frames: HTMLImageElement[];
  public currentFrame: number;
  public frameTime: number;
  public frameDuration: number; // millisecondi per frame (o durata totale per immagine singola)
  public isFinished: boolean;
  public isSingleImage: boolean; // true se è una singola immagine, false per animazione

  constructor(frames: HTMLImageElement[], frameDuration: number = 1000, isSingleImage: boolean = false) {
    super();
    this.frames = frames;
    this.currentFrame = 0;
    this.frameTime = 0;
    this.frameDuration = frameDuration;
    this.isFinished = false;
    this.isSingleImage = isSingleImage;

    // Per immagini singole, finisce automaticamente dopo la durata
    if (isSingleImage) {
      this.isFinished = false; // inizia non finito, finisce dopo frameDuration
    }
  }

  /**
   * Aggiorna l'animazione dell'esplosione
   */
  update(deltaTime: number): void {
    if (this.isFinished) return;

    this.frameTime += deltaTime;

    if (this.isSingleImage) {
      // Per immagini singole, aspetta la durata totale poi finisce
      if (this.frameTime >= this.frameDuration) {
        this.isFinished = true;
      }
    } else {
      // Per animazioni multi-frame, passa al frame successivo
      if (this.frameTime >= this.frameDuration) {
        this.currentFrame++;
        this.frameTime = 0;

        // Controlla se l'animazione è finita
        if (this.currentFrame >= this.frames.length) {
          this.isFinished = true;
        }
      }
    }
  }

  /**
   * Ottiene il frame corrente dell'animazione
   */
  getCurrentFrame(): HTMLImageElement | null {
    if (this.isFinished && !this.isSingleImage) {
      return null;
    }
    return this.frames[Math.min(this.currentFrame, this.frames.length - 1)];
  }

  /**
   * Verifica se l'animazione è completa
   */
  isAnimationFinished(): boolean {
    return this.isFinished;
  }
}
