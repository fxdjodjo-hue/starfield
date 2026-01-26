import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente effetto riparazione - gestisce l'animazione della riparazione
 * L'animazione è continua (loop infinito) mentre la riparazione è attiva
 */
export class RepairEffect extends Component {
  public frames: HTMLImageElement[];
  public currentFrame: number;
  public frameTime: number;
  public frameDuration: number; // millisecondi per frame
  public targetEntityId: number; // ID dell'entità che sta riparando (player)
  public repairType: 'hp' | 'shield'; // Tipo di riparazione per gestione visibilità

  constructor(frames: HTMLImageElement[], frameDuration: number = 50, targetEntityId: number, repairType: 'hp' | 'shield' = 'hp') {
    super();
    this.frames = frames;
    this.currentFrame = 0;
    this.frameTime = 0;
    this.frameDuration = frameDuration;
    this.targetEntityId = targetEntityId;
    this.repairType = repairType;
  }

  /**
   * Aggiorna l'animazione della riparazione (loop infinito)
   */
  update(deltaTime: number): void {
    this.frameTime += deltaTime;

    // Passa al frame successivo se è passato abbastanza tempo
    if (this.frameTime >= this.frameDuration) {
      this.currentFrame++;
      this.frameTime = 0;

      // Loop infinito: ricomincia dall'inizio quando finisce
      if (this.currentFrame >= this.frames.length) {
        this.currentFrame = 0;
      }
    }
  }

  /**
   * Ottiene il frame corrente dell'animazione
   */
  getCurrentFrame(): HTMLImageElement | null {
    if (this.currentFrame >= this.frames.length || this.frames.length === 0) {
      return null;
    }
    return this.frames[this.currentFrame];
  }
}
