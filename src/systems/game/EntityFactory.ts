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
import { ParallaxLayer } from '../../entities/spatial/ParallaxLayer';
import { Portal } from '../../entities/spatial/Portal';
import { SpaceStation } from '../../entities/spatial/SpaceStation';
import { CONFIG } from '../../utils/config/Config';

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

    // Crea space station a X=0, Y=0
    EntityFactory.createSpaceStation(ecs, 0, 0, assets.spaceStationSprite);

    // Crea background della mappa come entità parallax
    await EntityFactory.createMapBackground(ecs, context);

    return playerEntity;
  }

  /**
   * Crea un'entità portale statica
   */
  static createTeleport(ecs: ECS, x: number, y: number, animatedSprite: AnimatedSprite): void {
    const entity = ecs.createEntity();
    
    // Componenti spaziali - scala aumentata per renderlo più visibile (2.5x)
    ecs.addComponent(entity, Transform, new Transform(x, y, 0, 2.5, 2.5));
    
    // Componente visivo
    ecs.addComponent(entity, AnimatedSprite, animatedSprite);
    
    // Componente Portal per identificare questa entità come portale
    ecs.addComponent(entity, Portal, new Portal());
    
    // Autorità: entità statica, nessuna autorità necessaria
    // Il portale è puramente visivo per ora, senza logica
  }

  /**
   * Crea un'entità space station statica
   */
  static createSpaceStation(ecs: ECS, x: number, y: number, sprite: Sprite): void {
    const entity = ecs.createEntity();
    
    // Componenti spaziali
    ecs.addComponent(entity, Transform, new Transform(x, y, 0, 1, 1));
    
    // Componente visivo
    ecs.addComponent(entity, Sprite, sprite);
    
    // Componente SpaceStation per identificare questa entità come space station
    ecs.addComponent(entity, SpaceStation, new SpaceStation());
    
  }

  /**
   * Crea il background della mappa come entità parallax
   */
  static async createMapBackground(ecs: ECS, context: GameContext): Promise<void> {
    try {
      // Prova prima bg1forse.jpg se esiste (potrebbe essere più grande), altrimenti bg.jpg
      let mapPath = `/assets/maps/${CONFIG.CURRENT_MAP}/bg1forse.jpg`;
      let backgroundSprite: Sprite | null = null;
      
      try {
        backgroundSprite = await context.assetManager.createSprite(mapPath);
      } catch {
        // Fallback a bg.jpg
        mapPath = `/assets/maps/${CONFIG.CURRENT_MAP}/bg.jpg`;
        backgroundSprite = await context.assetManager.createSprite(mapPath);
      }
      
      if (!backgroundSprite) {
        console.warn('[EntityFactory] No background image found');
        return;
      }
      
      // Crea entità per il background
      const entity = ecs.createEntity();
      
      // Posiziona il background al centro del mondo (0, 0)
      const worldCenterX = 0;
      const worldCenterY = 0;
      
      // Background visivo: mantiene dimensione originale (2400x1500) senza scaling
      // Mappa logica: 21000x13100 (coordinate mondo per oggetti)
      // Scala gli oggetti, non lo sfondo - questo evita sgranatura mantenendo qualità
      const imgWidth = backgroundSprite.width || CONFIG.WORLD_WIDTH;
      const imgHeight = backgroundSprite.height || CONFIG.WORLD_HEIGHT;
      const scaleX = 1.0; // Nessuno scaling, dimensione originale
      const scaleY = 1.0; // Nessuno scaling, dimensione originale
      
      // Componenti spaziali
      ecs.addComponent(entity, Transform, new Transform(worldCenterX, worldCenterY, 0, scaleX, scaleY));
      
      // Componente parallax - velocità molto bassa (0.1) per sembrare lontano
      // zIndex negativo per essere renderizzato prima delle stelle
      ecs.addComponent(entity, ParallaxLayer, new ParallaxLayer(0.1, 0.1, 0, 0, -1));
      
      // Componente visivo
      ecs.addComponent(entity, Sprite, backgroundSprite);
      
    } catch (error) {
      console.warn('[EntityFactory] Failed to create map background:', error);
      // Non bloccare il gioco se il background non può essere caricato
    }
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
