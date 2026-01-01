import { Component } from '../ecs/Component';

/**
 * Componente Transform - gestisce posizione, rotazione e scala
 */
export class Transform extends Component {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public rotation: number = 0,
    public scaleX: number = 1,
    public scaleY: number = 1
  ) {
    super();
  }

  /**
   * Imposta la posizione
   */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /**
   * Trasla la posizione
   */
  translate(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }
}
