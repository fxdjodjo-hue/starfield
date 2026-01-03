import { Component } from '/src/infrastructure/ecs/Component';

/**
 * Componente esplosione - gestisce l'animazione dell'esplosione quando un'entità muore
 * Supporta animazioni a frame multipli, immagini singole e spritesheet
 */
export class Explosion extends Component {
  public spriteSheet: HTMLImageElement | null; // spritesheet singolo
  public frames: HTMLImageElement[]; // per compatibilità con animazioni multiple
  public currentFrame: number;
  public frameTime: number;
  public frameDuration: number; // millisecondi per frame
  public isFinished: boolean;
  public totalFrames: number; // numero totale di frame nello spritesheet
  public frameWidth: number; // larghezza di ogni frame nello spritesheet
  public frameHeight: number; // altezza di ogni frame nello spritesheet
  public framesPerRow: number; // quanti frame per riga nello spritesheet

  constructor(
    spriteSheet: HTMLImageElement,
    totalFrames: number = 8,
    frameDuration: number = 80,
    framesPerRow: number = 8
  ) {
    super();
    this.spriteSheet = spriteSheet;
    this.frames = []; // non usato per spritesheet
    this.currentFrame = 0;
    this.frameTime = 0;
    this.frameDuration = frameDuration;
    this.isFinished = false;
    this.totalFrames = totalFrames;
    this.framesPerRow = framesPerRow;

    // Calcola dimensioni frame dallo spritesheet
    this.frameWidth = spriteSheet.width / framesPerRow;
    this.frameHeight = spriteSheet.height / Math.ceil(totalFrames / framesPerRow);
  }

  // Costruttore alternativo per retrocompatibilità con animazioni multiple
  static fromFrames(frames: HTMLImageElement[], frameDuration: number = 100): Explosion {
    const explosion = new Explosion(frames[0], frames.length, frameDuration, frames.length);
    explosion.frames = frames;
    explosion.spriteSheet = null;
    return explosion;
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
      if (this.currentFrame >= this.totalFrames) {
        this.isFinished = true;
      }
    }
  }

  /**
   * Ottiene l'immagine dello spritesheet (per spritesheet)
   */
  getSpriteSheet(): HTMLImageElement | null {
    return this.spriteSheet;
  }

  /**
   * Ottiene le coordinate del frame corrente nello spritesheet
   */
  getCurrentFrameRect(): { x: number, y: number, width: number, height: number } | null {
    if (this.isFinished || !this.spriteSheet) {
      return null;
    }

    const frame = Math.min(this.currentFrame, this.totalFrames - 1);
    const row = Math.floor(frame / this.framesPerRow);
    const col = frame % this.framesPerRow;

    return {
      x: col * this.frameWidth,
      y: row * this.frameHeight,
      width: this.frameWidth,
      height: this.frameHeight
    };
  }

  /**
   * Ottiene il frame corrente (per retrocompatibilità con animazioni multiple)
   */
  getCurrentFrame(): HTMLImageElement | null {
    if (this.spriteSheet) {
      return this.spriteSheet; // per spritesheet, restituisce l'immagine completa
    }
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
