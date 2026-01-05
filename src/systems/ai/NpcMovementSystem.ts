import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Npc } from '../../entities/ai/Npc';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { CONFIG } from '../../utils/config/Config';
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

    for (const entity of npcs) {
      const npc = this.ecs.getComponent(entity, Npc);
      const transform = this.ecs.getComponent(entity, Transform);
      const velocity = this.ecs.getComponent(entity, Velocity);

      if (npc && transform && velocity) {
        this.executeNpcMovement(npc, transform, velocity, deltaTime, entity.id);
        this.enforceWorldBounds(transform, velocity, entity.id);
      }
    }
  }

  /**
   * Esegue il movimento fisico per un singolo NPC basato sul suo comportamento corrente
   */
  private executeNpcMovement(npc: Npc, transform: Transform, velocity: Velocity, deltaTime: number, entityId?: number): void {
    switch (npc.behavior) {
      case 'idle':
        this.executeIdleMovement(velocity);
        break;
      case 'aggressive':
        this.executeAggressiveMovement(transform, velocity, deltaTime, entityId);
        break;
      case 'flee':
        this.executeFleeMovement(transform, velocity, deltaTime, entityId);
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

  private executeFleeMovement(transform: Transform, velocity: Velocity, deltaTime: number, entityId?: number): void {
    if (!entityId) return;

    // FORZA reset completo della rotazione per NPC in fuga!
    transform.rotation = 0;
    velocity.setAngularVelocity(0);

    // Controlla se abbiamo già una direzione di fuga salvata per questo NPC
    let fleeDirection = this.fleeDirections.get(entityId);

    if (!fleeDirection) {
      // PRIMA volta che fugge - calcola e salva la direzione fissa
      const playerEntities = this.ecs.getEntitiesWithComponents(Transform)
        .filter(playerEntity => !this.ecs.hasComponent(playerEntity, Npc));

      if (playerEntities.length === 0) {
        this.executeCruiseMovement(transform, velocity, deltaTime);
        return;
      }

      const playerTransform = this.ecs.getComponent(playerEntities[0], Transform);
      if (!playerTransform) {
        this.executeCruiseMovement(transform, velocity, deltaTime);
        return;
      }

      // Calcola direzione di fuga (lontano dal player)
      const dx = transform.x - playerTransform.x;
      const dy = transform.y - playerTransform.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        // Normalizza e salva la direzione di fuga FISSA
        fleeDirection = {
          x: dx / distance,
          y: dy / distance
        };
        this.fleeDirections.set(entityId, fleeDirection);
      } else {
        this.executeCruiseMovement(transform, velocity, deltaTime);
        return;
      }
    }

    // Usa SEMPRE la direzione salvata (non ricalcola mai!)
    const baseSpeed = getNpcDefinition('Frigate')?.stats.speed || 150;
    const fleeSpeed = baseSpeed * 1.2;

    velocity.setVelocity(
      fleeDirection.x * fleeSpeed,
      fleeDirection.y * fleeSpeed
    );
  }

  private executeAggressiveMovement(transform: Transform, velocity: Velocity, deltaTime: number, entityId?: number): void {
    velocity.setAngularVelocity(0);

    // Trova il player
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform)
      .filter(playerEntity => !this.ecs.hasComponent(playerEntity, Npc));

    if (playerEntities.length === 0) {
      this.executeIdleMovement(velocity);
      return;
    }

    const playerTransform = this.ecs.getComponent(playerEntities[0], Transform);
    const playerVelocity = this.ecs.getComponent(playerEntities[0], Velocity);
    if (!playerTransform) {
      this.executeIdleMovement(velocity);
      return;
    }

    // Calcola direzione e distanza dal player
    const dx = playerTransform.x - transform.x;
    const dy = playerTransform.y - transform.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      // Normalizza la direzione
      const directionX = dx / distance;
      const directionY = dy / distance;

      // Usa sempre la velocità base dalla configurazione dell'NPC
        const entity = this.ecs.getEntity(entityId!);
        if (!entity) return;
        const currentNpc = this.ecs.getComponent(entity, Npc);
        const npcConfig = getNpcDefinition(currentNpc?.npcType || 'Frigate');
        const baseSpeed = npcConfig?.stats.speed || 150; // Velocità base dal config

        // Logica di movimento semplificata - usa sempre la velocità base
        let targetSpeed = baseSpeed; // Sempre la velocità base dell'NPC
        let movementDirectionX = directionX;
        let movementDirectionY = directionY;

        const attackRange = 300;
        const playerSpeedThreshold = 10;

        const playerIsMoving = playerVelocity && (Math.abs(playerVelocity.x) > playerSpeedThreshold || Math.abs(playerVelocity.y) > playerSpeedThreshold);

        if (playerIsMoving) {
          if (distance > attackRange) {
            // Avvicinati velocemente
          } else if (distance < 200) {
            // Allontanati
            movementDirectionX = -directionX;
            movementDirectionY = -directionY;
          } else {
            // Mantieni posizione lentamente
            targetSpeed = baseSpeed * 0.3;
          }
        } else {
          if (distance <= attackRange) {
            // Nel range - stai fermo
            velocity.setVelocity(0, 0);
            return;
          }
          // Fuori range - avvicinati lentamente
        }

      // Per NPC senza state, usa movimento semplice
      velocity.setVelocity(
        movementDirectionX * targetSpeed,
        movementDirectionY * targetSpeed
      );
    }
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
