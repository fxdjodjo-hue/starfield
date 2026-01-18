import { Component } from '../../infrastructure/ecs/Component';
import { MathUtils } from '../../core/utils/MathUtils';

/**
 * Componente Destination - rappresenta il punto target per il movimento
 */
export class Destination extends Component {
  public x: number;
  public y: number;
  public speed: number;

  constructor(
    x: number,
    y: number,
    speed: number = 200 // pixels per second
  ) {
    super();
    this.x = x;
    this.y = y;
    this.speed = speed;
  }

  /**
   * Imposta una nuova destinazione
   */
  setDestination(x: number, y: number, speed: number = this.speed): void {
    this.x = x;
    this.y = y;
    this.speed = speed;
  }

  /**
   * Calcola la direzione verso la destinazione
   */
  getDirection(fromX: number, fromY: number): { x: number; y: number } {
    const { distance } = MathUtils.calculateDirection(this.x, this.y, fromX, fromY);

    if (distance === 0) {
      return { x: 0, y: 0 };
    }

    return {
      x: dx / distance,
      y: dy / distance
    };
  }

  /**
   * Calcola la distanza dalla posizione corrente
   */
  getDistance(fromX: number, fromY: number): number {
    return MathUtils.calculateDistance(this.x, this.y, fromX, fromY);
  }

  /**
   * Verifica se abbiamo raggiunto la destinazione
   */
  isReached(fromX: number, fromY: number, threshold: number = 5): boolean {
    return this.getDistance(fromX, fromY) < threshold;
  }
}
