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
import { Asteroid } from '../../entities/spatial/Asteroid';
import { ResourceNode } from '../../entities/spatial/ResourceNode';
import { PlayerRole } from '../../entities/player/PlayerRole';
import { CONFIG } from '../../core/utils/config/GameConfig';
import asteroidConfig from '../../../shared/asteroid-config.json';

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

    // 🔧 FIX: Apply pending administrator status from welcome message
    if (context.pendingAdministrator !== null) {
      const playerRole = ecs.getComponent(playerEntity, PlayerRole);
      if (playerRole) {
        playerRole.setAdministrator(context.pendingAdministrator);
        // console.log(`[EntityFactory] Applied pending admin status: ${context.pendingAdministrator}`);
      }
      // Clear pending status after applying
      context.pendingAdministrator = null;
    }

    // Rimuovi il vecchio Sprite statico e usa AnimatedSprite per spritesheet
    if (ecs.hasComponent(playerEntity, Sprite)) {
      ecs.removeComponent(playerEntity, Sprite);
    }
    ecs.addComponent(playerEntity, AnimatedSprite, assets.playerSprite);

    // Crea il background della mappa come entità parallax
    await EntityFactory.createMapBackground(ecs, context);

    // Crea le entità specifiche della mappa (Portali, Stazioni, Asteroidi)
    EntityFactory.createMapEntities(ecs, assets, context.currentMapId);

    return playerEntity;
  }

  /**
   * Crea le entità specifiche di una mappa
   */
  static createMapEntities(ecs: ECS, assets: any, mapId: string): void {
    // console.log(`[EntityFactory] Creating map entities for: ${mapId}`);
    if (mapId === 'palantir') {
      // Crea portale a X=9000, Y=0 (per Singularity)
      EntityFactory.createTeleport(ecs, 9000, 0, assets.teleportAnimatedSprite);

      // Crea space station a X=0, Y=0
      EntityFactory.createSpaceStation(ecs, 0, 0, assets.spaceStationSprite);
    } else if (mapId === 'singularity') {
      // Crea portale a X=-9000, Y=0 (per tornare a Palantir)
      EntityFactory.createTeleport(ecs, -9000, 0, assets.teleportAnimatedSprite);

      // Magari una stazione diversa o nessuna
    } else {
      console.warn(`[EntityFactory] No specific entities for mapId: ${mapId}`);
    }

    // Crea asteroidi dalla configurazione (possono essere diversi per mappa in futuro)
    EntityFactory.createAsteroidsFromConfig(ecs, assets.asteroidSprite);
  }

  /**
   * Rimuove tutte le entità statiche della mappa per prepararsi a un cambio mappa o ricaricamento
   */
  static cleanupMapEntities(ecs: ECS): void {
    // console.log('[EntityFactory] Cleaning up map entities...');

    const entitiesToRemove = [
      ...ecs.getEntitiesWithComponents(ParallaxLayer),
      ...ecs.getEntitiesWithComponents(Portal),
      ...ecs.getEntitiesWithComponents(SpaceStation),
      ...ecs.getEntitiesWithComponents(Asteroid),
      ...ecs.getEntitiesWithComponents(ResourceNode)
    ];

    entitiesToRemove.forEach(entity => {
      // Nota: getEntitiesWithComponents ritorna entità che hanno ALMENO uno dei componenti
      // ecs.removeEntity è idempotente se l'entità è già stata rimossa
      ecs.removeEntity(entity);
    });

    // console.log(`[EntityFactory] Removed ${entitiesToRemove.length} map entities.`);
  }

  /**
   * Crea un'entità portale statica
   */
  static createTeleport(ecs: ECS, x: number, y: number, animatedSprite: AnimatedSprite): void {
    // console.log(`[EntityFactory] Creating teleport at: ${x}, ${y}`);
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
   * Crea un'entità asteroide con movimento
   */
  static createAsteroid(
    ecs: ECS,
    x: number,
    y: number,
    sprite: Sprite,
    scale: number = 1,
    rotation: number = 0,
    velocityX: number = 0,
    velocityY: number = 0,
    rotationSpeed: number = 0
  ): void {
    const entity = ecs.createEntity();

    // Componenti spaziali con scala e rotazione configurabili
    ecs.addComponent(entity, Transform, new Transform(x, y, rotation * Math.PI / 180, scale, scale));

    // Componente visivo
    ecs.addComponent(entity, Sprite, sprite);

    // Componente Asteroid con velocità e rotazione
    ecs.addComponent(entity, Asteroid, new Asteroid(scale, velocityX, velocityY, rotationSpeed));
  }

  /**
   * Crea tutti gli asteroidi dalla configurazione
   */
  static createAsteroidsFromConfig(ecs: ECS, asteroidSprite: Sprite): void {
    if (!asteroidConfig || !asteroidConfig.asteroids) {
      console.warn('[EntityFactory] No asteroid configuration found');
      return;
    }

    for (const asteroid of asteroidConfig.asteroids) {
      EntityFactory.createAsteroid(
        ecs,
        asteroid.x,
        asteroid.y,
        asteroidSprite,
        asteroid.scale || 1,
        asteroid.rotation || 0,
        asteroid.velocityX || 0,
        asteroid.velocityY || 0,
        asteroid.rotationSpeed || 0
      );
    }

    // console.log(`[EntityFactory] Created ${asteroidConfig.asteroids.length} asteroids`);
  }

  /**
   * Crea il background della mappa come entità parallax
   */
  static async createMapBackground(ecs: ECS, context: GameContext): Promise<void> {
    try {
      // Mappatura tra mapId del server e cartella degli asset
      const mapIdToFolder: Record<string, string> = {
        'palantir': 'palantir',
        'singularity': 'singularity'
      };

      const assetFolder = mapIdToFolder[context.currentMapId] || context.currentMapId;
      // console.log(`[EntityFactory] Loading background for mapId: ${context.currentMapId}, folder: ${assetFolder}`);

      // Prova prima bg1forse.jpg se esiste (potrebbe essere più grande), altrimenti bg.jpg
      let mapPath = `assets/maps/${assetFolder}/bg1forse.jpg`;
      let backgroundSprite: Sprite | null = null;

      try {
        backgroundSprite = await context.assetManager.createSprite(mapPath);
      } catch (e) {
        // Fallback a bg.jpg nella stessa cartella
        mapPath = `assets/maps/${assetFolder}/bg.jpg`;
        try {
          backgroundSprite = await context.assetManager.createSprite(mapPath);
        } catch (e2) {
          // ULTIMATE FALLBACK: Usa il background di default (palantir)
          console.warn(`[EntityFactory] Assets for ${assetFolder} not found, falling back to palantir`);
          mapPath = `assets/maps/palantir/bg.jpg`;
          backgroundSprite = await context.assetManager.createSprite(mapPath);
        }
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

      // Background visivo: mantiene dimensione originale senza scaling
      const scaleX = 1.0;
      const scaleY = 1.0;

      // Componenti spaziali
      ecs.addComponent(entity, Transform, new Transform(worldCenterX, worldCenterY, 0, scaleX, scaleY));

      // Componente parallax - speedX/Y = 0.1 per effetto parallax (muove al 10% della camera)
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
