import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Npc } from '../../entities/ai/Npc';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { DamageTaken } from '../../entities/combat/DamageTaken';
import { Health } from '../../entities/combat/Health';
import { CONFIG } from '../../utils/config/Config';
import { getNpcDefinition } from '../../config/NpcConfig';

/**
 * Sistema di comportamento NPC - gestisce l'AI semplice degli NPC
 */
export class NpcBehaviorSystem extends BaseSystem {
  private lastBehaviorUpdate = 0;
  private behaviorUpdateInterval = 1000;
  // Memoria delle direzioni di fuga per NPC - una volta che fuggono, mantengono direzione fissa!
  private fleeDirections: Map<number, { x: number, y: number }> = new Map();

  constructor(ecs: ECS) {
    super(ecs);
  }

  update(deltaTime: number): void {
    this.lastBehaviorUpdate += deltaTime;

    // Controllo più frequente per comportamenti critici (fuga per salute bassa)
    const criticalUpdateInterval = 100; // 100ms per controlli critici
    if (this.lastBehaviorUpdate >= criticalUpdateInterval) {
      this.updateBehaviors();
      this.lastBehaviorUpdate = 0;
    }

    this.executeBehaviors(deltaTime);
  }

  private updateBehaviors(): void {
    const npcs = this.ecs.getEntitiesWithComponents(Npc, Transform);

    for (const entity of npcs) {
      const npc = this.ecs.getComponent(entity, Npc);
      if (npc) {
        this.updateNpcBehavior(npc, entity.id);
      }
    }
  }

  private updateNpcBehavior(npc: Npc, entityId: number): void {
    const entity = this.ecs.getEntity(entityId);
    const transform = entity ? this.ecs.getComponent(entity, Transform) : null;

    // Priorità 1: se salute molto bassa, fuggi (tutti gli NPC)
    if (this.isNpcLowHealth(entityId)) {
      if (npc.behavior !== 'flee') {
        npc.setBehavior('flee');
        // CRITICO: Reset rotation quando inizia a fuggire per evitare comportamenti strani
        if (transform) transform.rotation = 0;
        // Rimuovi eventuali direzioni di fuga precedenti
        this.fleeDirections.delete(entityId);
      }
      return;
    }

    // Priorità 2: se danneggiato recentemente, diventa aggressivo (tutti)
    if (this.isNpcDamagedRecently(entityId)) {
      if (npc.behavior !== 'aggressive') {
        npc.setBehavior('aggressive');
        // Reset rotation quando diventa aggressivo (verrà impostata dal CombatSystem)
        if (transform) transform.rotation = 0;
        // Se stava fuggendo, cancella la direzione di fuga
        this.fleeDirections.delete(entityId);
      }
      return;
    }

    // Priorità 3: Frigate diventano aggressive se vedono il player (territoriali)
    if (npc.npcType === 'Frigate' && this.isPlayerVisibleToNpc(entityId)) {
      if (npc.behavior !== 'aggressive') {
        npc.setBehavior('aggressive');
        // Reset rotation quando diventa aggressivo
        if (transform) transform.rotation = 0;
      }
      return;
    }

    // Default: tutti gli NPC non aggressivi rimangono in cruise
    if (npc.behavior !== 'cruise') {
      npc.setBehavior('cruise');
      // Reset rotation quando torna a cruise
      if (transform) transform.rotation = 0;
      // Cancella direzione di fuga se presente
      this.fleeDirections.delete(entityId);
    }
  }

  private isNpcDamagedRecently(entityId: number): boolean {
    const entities = this.ecs.getEntitiesWithComponents(DamageTaken);
    const entity = entities.find(e => e.id === entityId);

    if (!entity) return false;

    const damageTaken = this.ecs.getComponent(entity, DamageTaken);
    if (!damageTaken) return false;

    return damageTaken.wasDamagedRecently(Date.now(), 5000); // 5 secondi
  }

  private isNpcLowHealth(entityId: number): boolean {
    const entities = this.ecs.getEntitiesWithComponents(Health);
    const entity = entities.find(e => e.id === entityId);

    if (!entity) return false;

    const health = this.ecs.getComponent(entity, Health);
    if (!health) return false;

    return health.getPercentage() < 0.5; // 50% salute
  }

  /**
   * Esegue i comportamenti correnti degli NPC (chiamato ogni frame)
   */
  private executeBehaviors(deltaTime: number): void {
    const npcs = this.ecs.getEntitiesWithComponents(Npc, Transform, Velocity);

    for (const entity of npcs) {
      const npc = this.ecs.getComponent(entity, Npc);
      const transform = this.ecs.getComponent(entity, Transform);
      const velocity = this.ecs.getComponent(entity, Velocity);

      if (npc && transform && velocity) {
        this.executeNpcBehavior(npc, transform, velocity, deltaTime, entity.id);
        this.enforceWorldBounds(transform, velocity, entity.id);
      }
    }
  }


  /**
   * Verifica se un NPC è stato danneggiato recentemente (negli ultimi 3 secondi)
   */

  /**
   * Esegue il comportamento corrente di un NPC
   */
  private executeNpcBehavior(npc: Npc, transform: Transform, velocity: Velocity, deltaTime: number, entityId?: number): void {
    switch (npc.behavior) {
      case 'idle':
        this.executeIdleBehavior(velocity);
        break;
      case 'aggressive':
        this.executeAggressiveBehavior(transform, velocity, deltaTime, entityId);
        break;
      case 'flee':
        this.executeFleeBehavior(transform, velocity, deltaTime, entityId);
        break;
      case 'cruise':
        this.executeCruiseBehavior(transform, velocity, deltaTime);
        break;
      default:
        this.executeIdleBehavior(velocity);
    }
  }


  private executeIdleBehavior(velocity: Velocity): void {
    velocity.setVelocity(0, 0);
    velocity.setAngularVelocity(0);
  }

  private executeCruiseBehavior(transform: Transform, velocity: Velocity, deltaTime: number): void {
    velocity.setAngularVelocity(0);
    velocity.setVelocity(50, 0);
  }

  private executeFleeBehavior(transform: Transform, velocity: Velocity, deltaTime: number, entityId?: number): void {
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
        this.executeCruiseBehavior(transform, velocity, deltaTime);
        return;
      }

      const playerTransform = this.ecs.getComponent(playerEntities[0], Transform);
      if (!playerTransform) {
        this.executeCruiseBehavior(transform, velocity, deltaTime);
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
        this.executeCruiseBehavior(transform, velocity, deltaTime);
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

  private isPlayerVisibleToNpc(npcEntityId: number): boolean {
    const npcEntity = this.ecs.getEntity(npcEntityId);
    if (!npcEntity) return false;

    const npcTransform = this.ecs.getComponent(npcEntity, Transform);
    if (!npcTransform) return false;

    const playerEntities = this.ecs.getEntitiesWithComponents(Transform)
      .filter(entity => !this.ecs.hasComponent(entity, Npc));

    if (playerEntities.length === 0) return false;

    const playerTransform = this.ecs.getComponent(playerEntities[0], Transform);
    if (!playerTransform) return false;

    const dx = playerTransform.x - npcTransform.x;
    const dy = playerTransform.y - npcTransform.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= 800;
  }

  private executeAggressiveBehavior(transform: Transform, velocity: Velocity, deltaTime: number, entityId?: number): void {
    velocity.setAngularVelocity(0);

    // Trova il player
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform)
      .filter(playerEntity => !this.ecs.hasComponent(playerEntity, Npc));

    if (playerEntities.length === 0) {
      this.executeIdleBehavior(velocity);
      return;
    }

    const playerTransform = this.ecs.getComponent(playerEntities[0], Transform);
    const playerVelocity = this.ecs.getComponent(playerEntities[0], Velocity);
    if (!playerTransform) {
      this.executeIdleBehavior(velocity);
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

}
