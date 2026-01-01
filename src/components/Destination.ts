import { Component } from '../ecs/Component.js';

/**
 * Componente Destination - rappresenta il punto target per il movimento
 */
export class Destination extends Component {
  constructor(
    public x: number,
    public y: number,
    public speed: number = 200 // pixels per second
  ) {
    super();
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
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const distance = Math.sqrt(dx * dx + dy * dy);

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
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Verifica se abbiamo raggiunto la destinazione
   */
  isReached(fromX: number, fromY: number, threshold: number = 5): boolean {
    return this.getDistance(fromX, fromY) < threshold;
  }
}
