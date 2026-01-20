import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente per i proiettili
 */
export class Projectile extends Component {
  public damage: number;
  public speed: number;
  public directionX: number;
  public directionY: number;
  public ownerId: number; // ID dell'entità che ha sparato il proiettile
  public targetId: number | string; // ID dell'entità bersaglio (numero per locali, stringa per remoti)
  public lifetime: number; // Tempo di vita rimanente in millisecondi
  public maxLifetime: number; // Tempo di vita massimo
  public playerId?: string; // ID del giocatore/NPC che ha sparato (per rendering remoto)
  public projectileType?: 'laser' | 'npc_laser'; // Tipo di proiettile per rendering

  constructor(damage: number, speed: number, directionX: number, directionY: number, ownerId: number, targetId: number | string, lifetime: number = 5000, playerId?: string, projectileType: 'laser' | 'npc_laser' = 'laser') {
    super();
    this.damage = damage;
    this.speed = speed;
    this.directionX = directionX;
    this.directionY = directionY;
    this.ownerId = ownerId;
    this.targetId = targetId;
    this.lifetime = lifetime;
    this.maxLifetime = lifetime;
    this.playerId = playerId;
    this.projectileType = projectileType;
  }
}
