import { Component } from '../ecs/Component';

/**
 * Componente Velocity - gestisce velocità lineare e angolare
 */
export class Velocity extends Component {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public angular: number = 0
  ) {
    super();
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
