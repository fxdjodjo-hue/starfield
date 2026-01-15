import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Npc } from '../../entities/ai/Npc';
import { Transform } from '../../entities/spatial/Transform';
import { DamageTaken } from '../../entities/combat/DamageTaken';
import { Health } from '../../entities/combat/Health';
import { NpcMovementSystem } from './NpcMovementSystem';

/**
 * Sistema di comportamento NPC - gestisce solo la logica decisionale degli NPC
 * Separato dal movimento fisico per architettura multiplayer-ready
 * Il server mantiene autorità su tutte le decisioni comportamentali
 */
export class NpcBehaviorSystem extends BaseSystem {
  private lastBehaviorUpdate = 0;
  private behaviorUpdateInterval = 1000;
  private movementSystem: NpcMovementSystem;

  constructor(ecs: ECS, movementSystem: NpcMovementSystem) {
    super(ecs);
    this.movementSystem = movementSystem;
  }

  update(deltaTime: number): void {
    this.lastBehaviorUpdate += deltaTime;

    // Controllo più frequente per comportamenti critici (fuga per salute bassa)
    const criticalUpdateInterval = 100; // 100ms per controlli critici
    if (this.lastBehaviorUpdate >= criticalUpdateInterval) {
      this.updateBehaviors();
      this.lastBehaviorUpdate = 0;
    }
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
        // Notifica al movement system di pulire direzioni di fuga precedenti
        this.movementSystem.clearFleeDirection(entityId);
      }
      return;
    }

    // Priorità 2: se danneggiato recentemente, diventa aggressivo (tutti)
    if (this.isNpcDamagedRecently(entityId)) {
      if (npc.behavior !== 'aggressive') {
        npc.setBehavior('aggressive');
        // Se stava fuggendo, cancella la direzione di fuga
        this.movementSystem.clearFleeDirection(entityId);
      }
      return;
    }

    // Priorità 3: Kronos diventano aggressive se vedono il player (territoriali)
    if (npc.npcType === 'Kronos' && this.isPlayerVisibleToNpc(entityId)) {
      if (npc.behavior !== 'aggressive') {
        npc.setBehavior('aggressive');
      }
      return;
    }

    // Default: tutti gli NPC non aggressivi rimangono in cruise
    if (npc.behavior !== 'cruise') {
      npc.setBehavior('cruise');
      // Cancella direzione di fuga se presente
      this.movementSystem.clearFleeDirection(entityId);
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

}
