import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Npc } from '../../entities/ai/Npc';
import { Transform } from '../../entities/spatial/Transform';
import { Health } from '../../entities/combat/Health';
import { NpcMovementSystem } from './NpcMovementSystem';

/**
 * Sistema di comportamento NPC - gestisce solo comportamenti critici locali
 * Separato dal movimento fisico per architettura multiplayer-ready
 * Il server mantiene autorità su comportamenti aggressive/cruise
 * Client gestisce solo comportamenti locali critici (fuga per salute bassa)
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
    // Solo comportamento critico locale: fuga quando salute molto bassa
    // Il server gestisce tutti gli altri comportamenti (aggressive/cruise)
    if (this.isNpcLowHealth(entityId)) {
      if (npc.behavior !== 'flee') {
        npc.setBehavior('flee');
        // Notifica al movement system di pulire direzioni di fuga precedenti
        this.movementSystem.clearFleeDirection(entityId);
      }
      return;
    }

    // Il server gestisce tutti gli altri comportamenti (aggressive/cruise)
    // Non forzare comportamenti locali - attendi aggiornamenti dal server
  }


  private isNpcLowHealth(entityId: number): boolean {
    const entity = this.ecs.getEntity(entityId);
    if (!entity) return false;

    const health = this.ecs.getComponent(entity, Health);
    if (!health) return false;

    return health.getPercentage() < 0.5; // 50% salute
  }


}
