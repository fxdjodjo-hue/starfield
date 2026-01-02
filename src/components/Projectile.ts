import { Component } from '../ecs/Component';

/**
 * Componente per i proiettili
 */
export class Projectile extends Component {
  public damage: number;
  public speed: number;
  public directionX: number;
  public directionY: number;
  public ownerId: number; // ID dell'entità che ha sparato il proiettile
  public targetId: number; // ID dell'entità bersaglio
  public lifetime: number; // Tempo di vita rimanente in millisecondi
  public maxLifetime: number; // Tempo di vita massimo

  constructor(damage: number, speed: number, directionX: number, directionY: number, ownerId: number, targetId: number, lifetime: number = 5000) {
    super();
    this.damage = damage;
    this.speed = speed;
    this.directionX = directionX;
    this.directionY = directionY;
    this.ownerId = ownerId;
    this.targetId = targetId;
    this.lifetime = lifetime;
    this.maxLifetime = lifetime;
  }
}
