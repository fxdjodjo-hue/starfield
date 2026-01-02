import { Component } from '/src/infrastructure/ecs/Component';

/**
 * Componente Transform - gestisce posizione, rotazione e scala
 */
export class Transform extends Component {
  public x: number;
  public y: number;
  public rotation: number;
  public scaleX: number;
  public scaleY: number;

  constructor(
    x: number = 0,
    y: number = 0,
    rotation: number = 0,
    scaleX: number = 1,
    scaleY: number = 1
  ) {
    super();
    this.x = x;
    this.y = y;
    this.rotation = rotation;
    this.scaleX = scaleX;
    this.scaleY = scaleY;
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
