// EntityFactory - Creazione entità iniziali del gioco
// Responsabilità: Creare player, portali, NPC, background
// Dipendenze: ECS, GameContext, CreatedSystems, AnimatedSprite

import { ECS } from '../../infrastructure/ecs/ECS';
import { GameContext } from '../../infrastructure/engine/GameContext';
import type { CreatedSystems } from './SystemFactory';
import { Authority, AuthorityLevel } from '../../entities/spatial/Authority';
import { Sprite } from '../../entities/Sprite';
import { AnimatedSprite } from '../../entities/AnimatedSprite';
import { Transform } from '../../entities/spatial/Transform';

export interface EntityFactoryDependencies {
  ecs: ECS;
  context: GameContext;
  systems: CreatedSystems;
}

export class EntityFactory {
  /**
   * Crea le entità principali del gioco (player, portali)
   * Restituisce il player entity creato
   */
  static async createGameEntities(deps: EntityFactoryDependencies): Promise<any> {
    const { ecs, context, systems } = deps;
    const { assets, playerSystem } = systems;

    // Crea il player usando il PlayerSystem
    const worldCenterX = 0;
    const worldCenterY = 0;
    const playerEntity = playerSystem.createPlayer(worldCenterX, worldCenterY);

    // Aggiungi autorità multiplayer al player (client può predire, server corregge)
    const playerAuthority = new Authority(context.localClientId, AuthorityLevel.CLIENT_PREDICTIVE);
    ecs.addComponent(playerEntity, Authority, playerAuthority);

    // Rimuovi il vecchio Sprite statico e usa AnimatedSprite per spritesheet
    if (ecs.hasComponent(playerEntity, Sprite)) {
      ecs.removeComponent(playerEntity, Sprite);
    }
    ecs.addComponent(playerEntity, AnimatedSprite, assets.playerSprite);

    // Crea portale a X=9000, Y=0
    EntityFactory.createTeleport(ecs, 9000, 0, assets.teleportAnimatedSprite);

    return playerEntity;
  }

  /**
   * Crea un'entità portale statica
   */
  static createTeleport(ecs: ECS, x: number, y: number, animatedSprite: AnimatedSprite): void {
    const entity = ecs.createEntity();
    
    // Componenti spaziali
    ecs.addComponent(entity, Transform, new Transform(x, y, 0, 1, 1));
    
    // Componente visivo
    ecs.addComponent(entity, AnimatedSprite, animatedSprite);
    
    // Autorità: entità statica, nessuna autorità necessaria
    // Il portale è puramente visivo per ora, senza logica
  }

  /**
   * Imposta il riferimento al player in tutti i sistemi che ne hanno bisogno
   */
  static setPlayerEntityInSystems(playerEntity: any, systems: CreatedSystems): void {
    const {
      playerControlSystem, economySystem, rankSystem, rewardSystem,
      boundsSystem, questTrackingSystem, playerStatusDisplaySystem,
      playerSystem, uiSystem
    } = systems;

    playerControlSystem.setPlayerEntity(playerEntity);
    economySystem.setPlayerEntity(playerEntity);
    rankSystem.setPlayerEntity(playerEntity);
    rewardSystem.setPlayerEntity(playerEntity);
    boundsSystem.setPlayerEntity(playerEntity);
    questTrackingSystem.setPlayerEntity(playerEntity);
    playerStatusDisplaySystem.setPlayerEntity(playerEntity);

    // Imposta il riferimento al PlayerSystem nel UiSystem (per pannelli che ne hanno bisogno)
    if (uiSystem) {
      uiSystem.setPlayerSystem(playerSystem);
    }
  }
}
