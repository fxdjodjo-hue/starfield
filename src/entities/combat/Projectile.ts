import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente per i proiettili
 */
export class Projectile extends Component {
  public id?: string; // ID univoco per tracking remoto
  public damage: number;
  public speed: number;
  public directionX: number;
  public directionY: number;
  public ownerId: number | string; // ID dell'entita che ha sparato il proiettile
  public targetId: number | string; // ID dell'entita bersaglio (numero per locali, stringa per remoti)
  public lifetime: number; // Tempo di vita rimanente in millisecondi
  public maxLifetime: number; // Tempo di vita massimo
  public playerId?: string; // ID del giocatore/NPC che ha sparato (per rendering remoto)
  public projectileType?: 'laser' | 'pet_laser' | 'npc_laser' | 'missile' | 'lb1' | 'lb2' | 'lb3' | 'm1' | 'm2' | 'm3'; // Tipo di proiettile per rendering
  public isDeterministic: boolean; // Proiettile con hit deciso server-side
  public hitTime?: number; // Timestamp di hit server-side (se deterministico)

  constructor(
    damage: number,
    speed: number,
    directionX: number,
    directionY: number,
    ownerId: number | string,
    targetId: number | string,
    lifetime: number = 5000,
    playerId?: string,
    projectileType: 'laser' | 'pet_laser' | 'npc_laser' | 'missile' | 'lb1' | 'lb2' | 'lb3' | 'm1' | 'm2' | 'm3' = 'laser',
    isDeterministic: boolean = false,
    hitTime?: number
  ) {
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
    this.isDeterministic = isDeterministic;
    this.hitTime = hitTime;
  }
}
