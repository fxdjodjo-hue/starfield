import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente Velocity - gestisce velocità lineare e angolare
 */
export class Velocity extends Component {
  public x: number;
  public y: number;
  public angular: number;

  constructor(
    x: number = 0,
    y: number = 0,
    angular: number = 0
  ) {
    super();
    this.x = x;
    this.y = y;
    this.angular = angular;
  }

  /**
   * Imposta la velocità lineare
   */
  setVelocity(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /**
   * Imposta la velocità angolare
   */
  setAngularVelocity(angular: number): void {
    this.angular = angular;
  }

  /**
   * Ferma il movimento
   */
  stop(): void {
    this.x = 0;
    this.y = 0;
    this.angular = 0;
  }
}
