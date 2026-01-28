// Import base EntityFactory
import { EntityFactory } from '../core/architecture/EntityFactory';
import type { BaseEntityConfig, CombatEntityConfig, ProgressionEntityConfig } from '../core/architecture';

// Additional imports for game-specific logic
import { ECS } from '../infrastructure/ecs/ECS';
import { Entity } from '../infrastructure/ecs/Entity';
import { AnimatedSprite } from '../entities/AnimatedSprite';
import { Npc } from '../entities/ai/Npc';
import { RemotePlayer } from '../entities/player/RemotePlayer';
import { PlayerRole } from '../entities/player/PlayerRole';
import { ActiveQuest } from '../entities/quest/ActiveQuest';
import { Transform } from '../entities/spatial/Transform';
import { Sprite } from '../entities/Sprite';
import { Inventory } from '../entities/player/Inventory';

// Config imports
import { getPlayerDefinition } from '../config/PlayerConfig';
import { getNpcDefinition } from '../config/NpcConfig';

// Type definitions for better type safety
export type Vector2 = { x: number; y: number };

/**
 * Configurazione per componenti spaziali
 */
export interface SpatialConfig {
  x: number;
  y: number;
  rotation?: number;
  velocity?: { x: number; y: number };
  sprite?: Sprite;
}

/**
 * Configurazione per componenti di combattimento
 */
export interface CombatConfig {
  health?: { current: number; max: number };
  shield?: { current: number; max: number };
  damage?: { value: number; range: number; cooldown: number };
}

/**
 * Configurazione per componenti di progresso (player)
 */
export interface ProgressionConfig {
  stats?: { kills?: number; deaths?: number; missionsCompleted?: number; playTime?: number };
  upgrades?: { hpUpgrades?: number; shieldUpgrades?: number; speedUpgrades?: number; damageUpgrades?: number; missileDamageUpgrades?: number };
  credits?: number;
  cosmos?: number;
  experience?: number;
  honor?: number;
  isAdministrator?: boolean;
}

/**
 * Configurazione per creazione Player
 */
export interface PlayerConfig {
  position: SpatialConfig;
  combat?: CombatConfig;
  progression?: ProgressionConfig;
  serverAuthoritative?: boolean; // Se true, alcuni valori verranno sovrascritti dal server
}

/**
 * Configurazione per creazione NPC
 */
export interface NpcConfig {
  type: string;
  behavior?: string;
  serverId?: string | null;
  position: SpatialConfig;
  combat?: CombatConfig;
}

/**
 * Configurazione per creazione Remote Player
 */
export interface RemotePlayerConfig {
  clientId: string;
  nickname?: string;
  rank?: string;
  position: SpatialConfig;
  animatedSprite?: AnimatedSprite | null;
  combat?: CombatConfig;
  interpolation?: boolean;
}

/**
 * GameEntityFactory - Specializzazione del gioco che estende EntityFactory base
 * Fornisce metodi specifici per creazione entità di gioco (Player, NPC, RemotePlayer)
 * con logica di caricamento asset e comportamenti specializzati
 */
export class GameEntityFactory extends EntityFactory {
  private assetManager: any = null;
  private kronosAnimatedSprite: AnimatedSprite | null = null;

  constructor(ecs: ECS, assetManager?: any) {
    super(ecs);
    this.assetManager = assetManager || null;
  }

  /**
   * Carica lo spritesheet per Kronos (chiamato una volta all'inizializzazione)
   */
  async loadKronosSprite(): Promise<void> {
    if (this.assetManager && !this.kronosAnimatedSprite) {
      this.kronosAnimatedSprite = await this.assetManager.createAnimatedSprite('assets/npc_ships/kronos/alien90', 0.16);
    }
  }

  /**
   * Crea un'entità Player completa
   */
  createPlayer(config: PlayerConfig): Entity {
    const entity = this.ecs.createEntity();
    const playerDef = getPlayerDefinition();

    // Componenti spaziali - assicurati che la posizione sia sempre valida
    const safePosition = {
      x: (typeof config.position?.x === 'number' && !isNaN(config.position.x)) ? config.position.x : 0,
      y: (typeof config.position?.y === 'number' && !isNaN(config.position.y)) ? config.position.y : 0,
      rotation: (typeof config.position?.rotation === 'number' && !isNaN(config.position.rotation)) ? config.position.rotation : 0
    };

    // Usa metodo della classe base per componenti spaziali
    // Player locale NON deve avere InterpolationTarget per essere gestito dal MovementSystem
    this.addSpatialComponents(entity, safePosition, { x: 0, y: 0 }, config.position?.sprite, false);

    // Componenti di combattimento - range è fisso, non influenzato da upgrade
    this.addCombatComponents(entity, config.combat || {
      health: { current: playerDef.stats.health, max: playerDef.stats.health },
      shield: { current: playerDef.stats.shield || 0, max: playerDef.stats.shield || 0 },
      damage: {
        value: playerDef.stats.damage,
        range: playerDef.stats.range,
        cooldown: playerDef.stats.cooldown,
        missileCooldown: playerDef.stats.missileCooldown
      }
    });

    // Componenti di progresso (inizializzati con valori che verranno sovrascritti dal server se serverAuthoritative)
    // IMPORTANTE: isAdministrator deve essere sempre presente per creare il componente PlayerRole
    const progressionConfig = {
      stats: config.progression?.stats || { kills: 0, deaths: 0, missionsCompleted: 0, playTime: 0 },
      upgrades: config.progression?.upgrades || { hpUpgrades: 0, shieldUpgrades: 0, speedUpgrades: 0, damageUpgrades: 0, missileDamageUpgrades: 0 },
      credits: config.progression?.credits ?? (config.serverAuthoritative ? 0 : playerDef.startingResources.credits),
      cosmos: config.progression?.cosmos ?? (config.serverAuthoritative ? 0 : playerDef.startingResources.cosmos),
      experience: config.progression?.experience ?? (config.serverAuthoritative ? 0 : playerDef.startingResources.experience),
      honor: config.progression?.honor ?? (config.serverAuthoritative ? 0 : playerDef.startingResources.honor),
      isAdministrator: config.progression?.isAdministrator ?? false
    };
    this.addProgressionComponents(entity, progressionConfig);

    // Quest system
    this.ecs.addComponent(entity, ActiveQuest, new ActiveQuest());

    // Inventory system
    this.ecs.addComponent(entity, Inventory, new Inventory());

    return entity;
  }

  /**
   * Crea un'entità NPC generica
   */
  createNpc(config: NpcConfig): Entity {
    const entity = this.ecs.createEntity();
    const npcDef = getNpcDefinition(config.type);

    if (!npcDef) {
      throw new Error(`Unknown NPC type: ${config.type}`);
    }

    // Componenti spaziali - usa metodo della classe base
    this.addSpatialComponents(
      entity,
      { x: config.position.x, y: config.position.y, rotation: config.position.rotation },
      config.position.velocity,
      config.position.sprite
    );

    // Componenti di combattimento (usa valori da config NPC se non specificati)
    const combatConfig = config.combat || {
      health: { current: npcDef.stats.health, max: npcDef.stats.health },
      shield: { current: npcDef.stats.shield, max: npcDef.stats.shield },
      damage: {
        value: npcDef.stats.damage,
        range: npcDef.stats.range,
        cooldown: npcDef.stats.cooldown
      }
    };
    this.addCombatComponents(entity, combatConfig);

    // Componente NPC specifico
    this.ecs.addComponent(entity, Npc, new Npc(
      config.type,
      config.behavior || npcDef.defaultBehavior,
      config.serverId
    ));

    // Per Kronos, usa AnimatedSprite invece di Sprite e imposta scala maggiore
    if (config.type === 'Kronos') {
      // Imposta scala maggiore per Kronos
      const transform = this.ecs.getComponent(entity, Transform);
      if (transform) {
        transform.scaleX = 4.5;
        transform.scaleY = 4.5;
      }

      if (this.kronosAnimatedSprite) {
        // Rimuovi Sprite se presente
        if (this.ecs.hasComponent(entity, Sprite)) {
          this.ecs.removeComponent(entity, Sprite);
        }
        // Aggiungi AnimatedSprite
        this.ecs.addComponent(entity, AnimatedSprite, this.kronosAnimatedSprite);
      }
    }

    // Logica specializzata per tipi specifici
    this.setupSpecializedNpcLogic(entity, npcDef);

    return entity;
  }

  /**
   * Crea un NPC Scouter (metodo specializzato)
   */
  createScouter(position: Vector2): Entity {
    return this.createNpcFromType('Scouter', position);
  }

  /**
   * Crea un NPC Kronos (metodo specializzato)
   */
  createFrigate(position: Vector2): Entity {
    return this.createNpcFromType('Kronos', position);
  }


  /**
   * Metodo helper per creare NPC da tipo
   */
  private createNpcFromType(type: string, position: Vector2): Entity {
    return this.createNpc({
      type,
      position: {
        x: position.x + (Math.random() - 0.5) * 100,
        y: position.y + (Math.random() - 0.5) * 100,
        rotation: 0
      }
    });
  }

  /**
   * Imposta logica specializzata per tipi specifici di NPC
   */
  private setupSpecializedNpcLogic(entity: Entity, npcDef: any): void {
    // Implementazione vuota per ora, estendibile in futuro per comportamenti specifici
  }


  /**
   * Crea un'entità Remote Player
   */
  createRemotePlayer(config: RemotePlayerConfig): Entity {
    const entity = this.ecs.createEntity();

    // Componenti spaziali - usa metodo della classe base
    this.addSpatialComponents(
      entity,
      { x: config.position.x, y: config.position.y, rotation: config.position.rotation },
      config.position.velocity,
      config.animatedSprite || config.position.sprite,
      config.interpolation
    );

    // Se abbiamo AnimatedSprite specifico, sovrascrivi quello della base
    if (config.animatedSprite && this.ecs.hasComponent(entity, Sprite)) {
      this.ecs.removeComponent(entity, Sprite);
      this.ecs.addComponent(entity, AnimatedSprite, config.animatedSprite);
    }

    // Componenti di combattimento (valori base per remote players)
    this.addCombatComponents(entity, config.combat || {
      health: { current: 100, max: 100 },
      shield: { current: 50, max: 50 },
      damage: { value: 50, range: 30, cooldown: 100 }
    });

    // Componente RemotePlayer
    this.ecs.addComponent(entity, RemotePlayer, new RemotePlayer(
      config.clientId,
      config.nickname || '',
      config.rank || 'Recruit'
    ));

    return entity;
  }

}
