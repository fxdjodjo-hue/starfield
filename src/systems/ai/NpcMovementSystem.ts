import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Npc } from '../../entities/ai/Npc';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { CONFIG } from '../../core/utils/config/GameConfig';
import { MathUtils } from '../../core/utils/MathUtils';
import { getNpcDefinition } from '../../config/NpcConfig';

/**
 * Sistema di movimento NPC - gestisce l'esecuzione fisica del movimento
 * Separato dalla logica comportamentale per architettura multiplayer-ready
 * Il server controlla sia logica che movimento, i client ricevono solo aggiornamenti
 */
export class NpcMovementSystem extends BaseSystem {
  // Memoria delle direzioni di fuga per NPC - una volta che fuggono, mantengono direzione fissa!
  private fleeDirections: Map<number, { x: number, y: number }> = new Map();

  constructor(ecs: ECS) {
    super(ecs);
  }

  update(deltaTime: number): void {
    this.executeMovements(deltaTime);
  }

  /**
   * Esegue il movimento fisico di tutti gli NPC basato sui loro comportamenti correnti
   */
  private executeMovements(deltaTime: number): void {
    const npcs = this.ecs.getEntitiesWithComponents(Npc, Transform, Velocity);
    const playerContext = this.resolvePlayerContext();

    for (const entity of npcs) {
      const npc = this.ecs.getComponent(entity, Npc);
      const transform = this.ecs.getComponent(entity, Transform);
      const velocity = this.ecs.getComponent(entity, Velocity);

      if (npc && transform && velocity) {
        this.executeNpcMovement(npc, transform, velocity, deltaTime, entity.id, playerContext);
        // Aggiorna rotazione basandosi sulla velocity (come il player)
        this.updateRotationFromVelocity(transform, velocity);
        this.enforceWorldBounds(transform, velocity, entity.id);
      }
    }
  }

  /**
   * Esegue il movimento fisico per un singolo NPC basato sul suo comportamento corrente
   */
  private executeNpcMovement(
    npc: Npc,
    transform: Transform,
    velocity: Velocity,
    deltaTime: number,
    entityId?: number,
    playerContext?: { transform: Transform; velocity: Velocity | null } | null
  ): void {
    switch (npc.behavior) {
      case 'idle':
        this.executeIdleMovement(velocity);
        break;
      case 'aggressive':
        this.executeAggressiveMovement(npc, transform, velocity, deltaTime, playerContext);
        break;
      case 'flee':
        this.executeFleeMovement(transform, velocity, deltaTime, playerContext, entityId);
        break;
      case 'cruise':
        this.executeCruiseMovement(transform, velocity, deltaTime);
        break;
      default:
        this.executeIdleMovement(velocity);
    }
  }

  private executeIdleMovement(velocity: Velocity): void {
    velocity.setVelocity(0, 0);
    velocity.setAngularVelocity(0);
  }

  private executeCruiseMovement(transform: Transform, velocity: Velocity, deltaTime: number): void {
    velocity.setAngularVelocity(0);
    velocity.setVelocity(50, 0);
  }

  private executeFleeMovement(
    transform: Transform,
    velocity: Velocity,
    deltaTime: number,
    playerContext?: { transform: Transform; velocity: Velocity | null } | null,
    entityId?: number
  ): void {
    if (!entityId) return;

    velocity.setAngularVelocity(0);

    // Controlla se abbiamo già una direzione di fuga salvata per questo NPC
    let fleeDirection = this.fleeDirections.get(entityId);

    if (!fleeDirection) {
      // PRIMA volta che fugge - calcola e salva la direzione fissa
      const playerTransform = playerContext?.transform;
      if (!playerTransform) {
        this.executeCruiseMovement(transform, velocity, deltaTime);
        return;
      }

      // Calcola direzione di fuga (lontano dal player)
      const { direction, distance } = MathUtils.calculateDirection(
        transform.x, transform.y,
        playerTransform.x, playerTransform.y
      );

      if (distance > 0) {
        // Normalizza e salva la direzione di fuga FISSA (opposta al player)
        fleeDirection = {
          x: -direction.x,
          y: -direction.y
        };
        this.fleeDirections.set(entityId, fleeDirection);
      } else {
        this.executeCruiseMovement(transform, velocity, deltaTime);
        return;
      }
    }

    // Usa SEMPRE la direzione salvata (non ricalcola mai!)
    const baseSpeed = getNpcDefinition('Kronos')?.stats.speed || 150;
    const fleeSpeed = baseSpeed * 1.2;

    velocity.setVelocity(
      fleeDirection.x * fleeSpeed,
      fleeDirection.y * fleeSpeed
    );
  }

  private executeAggressiveMovement(
    npc: Npc,
    transform: Transform,
    velocity: Velocity,
    deltaTime: number,
    playerContext?: { transform: Transform; velocity: Velocity | null } | null
  ): void {
    velocity.setAngularVelocity(0);

    const playerTransform = playerContext?.transform;
    if (!playerTransform) {
      this.executeIdleMovement(velocity);
      return;
    }

    const playerVelocity = playerContext?.velocity || null;

    // Verifica se il player si sta muovendo
    const playerSpeedThreshold = 10;
    const playerIsMoving =
      !!playerVelocity &&
      (Math.abs(playerVelocity.x) > playerSpeedThreshold ||
       Math.abs(playerVelocity.y) > playerSpeedThreshold);

    // Se il player è fermo, anche l'NPC rimane fermo
    if (!playerIsMoving) {
      this.executeIdleMovement(velocity);
      return;
    }

    // Se il player si muove, l'NPC lo insegue
    const { direction, distance } = MathUtils.calculateDirection(
      playerTransform.x, playerTransform.y,
      transform.x, transform.y
    );

    if (distance > 0) {
      // Normalizza la direzione verso il player
      const directionX = direction.x;
      const directionY = direction.y;

      // Ottieni la velocità base dalla configurazione dell'NPC
      const npcConfig = getNpcDefinition(npc.npcType || 'Kronos');
      const baseSpeed = npcConfig?.stats.speed || 150;

      // Insegue il player alla velocità base
      velocity.setVelocity(
        directionX * baseSpeed,
        directionY * baseSpeed
      );
    } else {
      // Se già nella stessa posizione, resta fermo
      this.executeIdleMovement(velocity);
    }
  }

  private resolvePlayerContext(): { transform: Transform; velocity: Velocity | null } | null {
    const entitiesWithTransform = this.ecs.getEntitiesWithComponents(Transform);
    for (const entity of entitiesWithTransform) {
      if (this.ecs.hasComponent(entity, Npc)) continue;

      const transform = this.ecs.getComponent(entity, Transform);
      if (!transform) {
        continue;
      }

      return {
        transform,
        velocity: this.ecs.getComponent(entity, Velocity) || null
      };
    }

    return null;
  }

  private enforceWorldBounds(transform: Transform, velocity: Velocity, entityId: number): void {
    const margin = 50;
    const preventionDistance = 200;
    const worldLeft = -CONFIG.WORLD_WIDTH / 2 + margin;
    const worldRight = CONFIG.WORLD_WIDTH / 2 - margin;
    const worldTop = -CONFIG.WORLD_HEIGHT / 2 + margin;
    const worldBottom = CONFIG.WORLD_HEIGHT / 2 - margin;

    // Controllo preventivo: cambia direzione prima di raggiungere i bounds
    if (velocity.x < 0 && transform.x < worldLeft + preventionDistance) {
      velocity.x = Math.abs(velocity.x);
    } else if (velocity.x > 0 && transform.x > worldRight - preventionDistance) {
      velocity.x = -Math.abs(velocity.x);
    }

    if (velocity.y < 0 && transform.y < worldTop + preventionDistance) {
      velocity.y = Math.abs(velocity.y);
    } else if (velocity.y > 0 && transform.y > worldBottom - preventionDistance) {
      velocity.y = -Math.abs(velocity.y);
    }

    // Controllo reattivo: backup se è uscito dai bounds
    if (transform.x < worldLeft) {
      transform.x = worldLeft;
      velocity.x = Math.abs(velocity.x);
    } else if (transform.x > worldRight) {
      transform.x = worldRight;
      velocity.x = -Math.abs(velocity.x);
    }

    if (transform.y < worldTop) {
      transform.y = worldTop;
      velocity.y = Math.abs(velocity.y);
    } else if (transform.y > worldBottom) {
      transform.y = worldBottom;
      velocity.y = -Math.abs(velocity.y);
    }
  }

  /**
   * Aggiorna la rotazione dell'NPC basandosi sulla velocity (stesso sistema del player)
   */
  private updateRotationFromVelocity(transform: Transform, velocity: Velocity): void {
    if (velocity.x !== 0 || velocity.y !== 0) {
      const angle = Math.atan2(velocity.y, velocity.x);
      transform.rotation = angle;
    }
  }

  /**
   * Pulisce le direzioni di fuga quando un NPC cambia comportamento
   */
  clearFleeDirection(entityId: number): void {
    this.fleeDirections.delete(entityId);
  }

  /**
   * Ottiene la direzione di fuga corrente di un NPC (per debug/sincronizzazione)
   */
  getFleeDirection(entityId: number): { x: number, y: number } | undefined {
    return this.fleeDirections.get(entityId);
  }
}
