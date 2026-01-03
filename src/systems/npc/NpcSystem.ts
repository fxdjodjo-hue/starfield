import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { Sprite } from '../../entities/Sprite';
import { Npc } from '../../entities/ai/Npc';
import { Health } from '../../entities/combat/Health';

/**
 * Sistema dedicato alla gestione degli NPC
 * Gestisce creazione, configurazione e logica NPC
 */
export class NpcSystem extends System {
  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Crea NPC Scouter distribuiti nel mondo
   */
  createScouters(count: number, sprite: Sprite): void {
    for (let i = 0; i < count; i++) {
      this.createScouter(sprite);
    }
  }

  /**
   * Crea un singolo NPC Scouter
   */
  private createScouter(sprite: Sprite): void {
    const npc = this.ecs.createEntity();

    // Posizione casuale distribuita
    const x = (Math.random() - 0.5) * 2000;
    const y = (Math.random() - 0.5) * 2000;

    // Aggiungi componenti NPC
    this.ecs.addComponent(npc, Transform, new Transform(x, y));
    this.ecs.addComponent(npc, Velocity, new Velocity(
      (Math.random() - 0.5) * 50,
      (Math.random() - 0.5) * 50
    ));
    this.ecs.addComponent(npc, Sprite, sprite);
    this.ecs.addComponent(npc, Npc, new Npc('scouter'));
    this.ecs.addComponent(npc, Health, new Health(50, 50));
  }

  update(deltaTime: number): void {
    // Logica specifica NPC se necessaria
    // Per ora delega agli altri sistemi specializzati
  }
}
