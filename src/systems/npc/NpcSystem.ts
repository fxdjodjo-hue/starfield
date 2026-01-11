import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Sprite } from '../../entities/Sprite';
import { EntityFactory } from '../../factories/EntityFactory';

/**
 * Sistema dedicato alla gestione degli NPC
 * Gestisce creazione, configurazione e logica NPC utilizzando EntityFactory
 */
export class NpcSystem extends System {
  private entityFactory: EntityFactory;

  constructor(ecs: ECS) {
    super(ecs);
    this.entityFactory = new EntityFactory(ecs);
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
    // Posizione casuale distribuita
    const position = {
      x: (Math.random() - 0.5) * 2000,
      y: (Math.random() - 0.5) * 2000,
      rotation: 0,
      velocity: {
        x: (Math.random() - 0.5) * 50,
        y: (Math.random() - 0.5) * 50
      },
      sprite: sprite
    };

    this.entityFactory.createScouter(position);
  }

  /**
   * Crea NPC distribuiti per tipo
   */
  createDistributedNpcs(npcTypes: string[], totalCount: number, sprite: Sprite): void {
    const typesCount = npcTypes.length;
    const countPerType = Math.floor(totalCount / typesCount);
    const remainder = totalCount % typesCount;

    npcTypes.forEach((type, index) => {
      const count = countPerType + (index < remainder ? 1 : 0);
      this.createNpcsOfType(type, count, sprite);
    });
  }

  /**
   * Crea NPC di un tipo specifico
   */
  private createNpcsOfType(type: string, count: number, sprite: Sprite): void {
    for (let i = 0; i < count; i++) {
      const position = {
        x: (Math.random() - 0.5) * 2000,
        y: (Math.random() - 0.5) * 2000,
        rotation: 0,
        velocity: {
          x: (Math.random() - 0.5) * 50,
          y: (Math.random() - 0.5) * 50
        },
        sprite: sprite
      };

      switch (type.toLowerCase()) {
        case 'scouter':
          this.entityFactory.createScouter(position);
          break;
        case 'frigate':
          this.entityFactory.createFrigate(position);
          break;
        default:
          console.warn(`Unknown NPC type: ${type}`);
      }
    }
  }

  update(deltaTime: number): void {
    // Logica specifica NPC se necessaria
    // Per ora delega agli altri sistemi specializzati
  }
}
