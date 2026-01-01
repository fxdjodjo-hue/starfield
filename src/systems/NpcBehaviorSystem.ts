import { BaseSystem } from '../ecs/System.js';
import { ECS } from '../ecs/ECS.js';
import { Npc } from '../components/Npc.js';
import { Transform } from '../components/Transform.js';
import { Velocity } from '../components/Velocity.js';

/**
 * Sistema di comportamento NPC - gestisce l'AI semplice degli NPC
 */
export class NpcBehaviorSystem extends BaseSystem {
  private lastBehaviorUpdate = 0;
  private behaviorUpdateInterval = 2000; // Cambia comportamento ogni 2 secondi

  constructor(ecs: ECS) {
    super(ecs);
  }

  update(deltaTime: number): void {
    this.lastBehaviorUpdate += deltaTime;

    // Aggiorna comportamenti periodicamente
    if (this.lastBehaviorUpdate >= this.behaviorUpdateInterval) {
      this.updateBehaviors();
      this.lastBehaviorUpdate = 0;
    }

    // Esegui comportamenti correnti
    this.executeBehaviors(deltaTime);
  }

  /**
   * Aggiorna i comportamenti degli NPC (chiamato periodicamente)
   */
  private updateBehaviors(): void {
    const npcs = this.ecs.getEntitiesWithComponents(Npc, Transform);

    for (const entity of npcs) {
      const npc = this.ecs.getComponent(entity, Npc);
      if (npc) {
        this.updateNpcBehavior(npc);
      }
    }
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
        this.executeNpcBehavior(npc, transform, velocity, deltaTime);
      }
    }
  }

  /**
   * Aggiorna il comportamento di un singolo NPC
   */
  private updateNpcBehavior(npc: Npc): void {
    // AI semplice: cambia comportamento casualmente
    const behaviors = ['idle', 'wander', 'circle'];
    const randomBehavior = behaviors[Math.floor(Math.random() * behaviors.length)];

    npc.setBehavior(randomBehavior);
  }

  /**
   * Esegue il comportamento corrente di un NPC
   */
  private executeNpcBehavior(npc: Npc, transform: Transform, velocity: Velocity, deltaTime: number): void {
    switch (npc.behavior) {
      case 'idle':
        this.executeIdleBehavior(velocity);
        break;
      case 'wander':
        this.executeWanderBehavior(transform, velocity);
        break;
      case 'circle':
        this.executeCircleBehavior(transform, velocity);
        break;
      default:
        this.executeIdleBehavior(velocity);
    }
  }

  /**
   * Comportamento idle - l'NPC sta fermo
   */
  private executeIdleBehavior(velocity: Velocity): void {
    velocity.stop();
  }

  /**
   * Comportamento wander - l'NPC si muove casualmente
   */
  private executeWanderBehavior(transform: Transform, velocity: Velocity): void {
    // Movimento casuale con velocità moderata
    const speed = 50; // pixels per second
    const angle = Math.random() * Math.PI * 2; // Direzione casuale

    velocity.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );
  }

  /**
   * Comportamento circle - l'NPC gira in cerchio
   */
  private executeCircleBehavior(transform: Transform, velocity: Velocity): void {
    // Movimento circolare con velocità costante
    const speed = 80; // pixels per second
    const radius = 100; // raggio del cerchio

    // Calcola la direzione tangente al cerchio
    const centerX = 400; // Centro del cerchio (potrebbe essere relativo alla posizione dell'NPC)
    const centerY = 300;

    const dx = transform.x - centerX;
    const dy = transform.y - centerY;

    // Direzione tangente (perpendicolare al raggio)
    const tangentX = -dy;
    const tangentY = dx;

    // Normalizza e applica velocità
    const length = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
    if (length > 0) {
      velocity.setVelocity(
        (tangentX / length) * speed,
        (tangentY / length) * speed
      );
    }
  }
}
