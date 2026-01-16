import { ECS } from '../infrastructure/ecs/ECS';
import { Entity } from '../infrastructure/ecs/Entity';

// Component imports
import { Transform } from '../entities/spatial/Transform';
import { Velocity } from '../entities/spatial/Velocity';
import { Sprite } from '../entities/Sprite';
import { AnimatedSprite } from '../entities/AnimatedSprite';
import { Health } from '../entities/combat/Health';
import { Shield } from '../entities/combat/Shield';
import { Damage } from '../entities/combat/Damage';
import { Npc } from '../entities/ai/Npc';
import { RemotePlayer } from '../entities/player/RemotePlayer';
import { PlayerStats } from '../entities/player/PlayerStats';
import { PlayerUpgrades } from '../entities/player/PlayerUpgrades';
import { PlayerRole } from '../entities/player/PlayerRole';
import { SkillPoints } from '../entities/currency/SkillPoints';
import { Credits } from '../entities/currency/Currency';
import { Cosmos } from '../entities/currency/Currency';
import { Experience } from '../entities/currency/Experience';
import { Honor } from '../entities/currency/Honor';
import { ActiveQuest } from '../entities/quest/ActiveQuest';
import { InterpolationTarget } from '../entities/spatial/InterpolationTarget';

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
  upgrades?: { hpUpgrades?: number; shieldUpgrades?: number; speedUpgrades?: number; damageUpgrades?: number };
  skillPoints?: number;
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
 * Factory centralizzata per la creazione di tutte le entità del gioco
 * Implementa il pattern Factory con builder per garantire consistenza e centralizzazione
 */
export class EntityFactory {
  private assetManager: any = null;
  private kronosAnimatedSprite: AnimatedSprite | null = null;

  constructor(private ecs: ECS, assetManager?: any) {
    this.assetManager = assetManager || null;
  }

  /**
   * Carica lo spritesheet per Kronos (chiamato una volta all'inizializzazione)
   */
  async loadKronosSprite(): Promise<void> {
    if (this.assetManager && !this.kronosAnimatedSprite) {
      this.kronosAnimatedSprite = await this.assetManager.createAnimatedSprite('/assets/npc_ships/kronos/alien90', 0.16);
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

    this.addSpatialComponents(entity, {
      ...safePosition,
      sprite: config.position?.sprite, // Player sprite fornito dal chiamante
      velocity: { x: 0, y: 0 } // Aggiungi Velocity iniziale per permettere il movimento
    });

    // Componenti di combattimento
    this.addCombatComponents(entity, config.combat || {
      health: { current: playerDef.stats.health, max: playerDef.stats.health },
      shield: { current: playerDef.stats.shield || 0, max: playerDef.stats.shield || 0 },
      damage: { value: playerDef.stats.damage, range: playerDef.stats.range, cooldown: playerDef.stats.cooldown }
    });

    // Componenti di progresso (inizializzati con valori che verranno sovrascritti dal server se serverAuthoritative)
    this.addProgressionComponents(entity, config.progression || {
      stats: { kills: 0, deaths: 0, missionsCompleted: 0, playTime: 0 },
      upgrades: { hpUpgrades: 0, shieldUpgrades: 0, speedUpgrades: 0, damageUpgrades: 0 },
      skillPoints: config.serverAuthoritative ? 0 : playerDef.startingResources.skillPoints,
      credits: config.serverAuthoritative ? 0 : playerDef.startingResources.credits,
      cosmos: config.serverAuthoritative ? 0 : playerDef.startingResources.cosmos,
      experience: config.serverAuthoritative ? 0 : playerDef.startingResources.experience,
      honor: config.serverAuthoritative ? 0 : playerDef.startingResources.honor
    });

    // Quest system
    this.ecs.addComponent(entity, ActiveQuest, new ActiveQuest());

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

    // Componenti spaziali
    this.addSpatialComponents(entity, config.position);

    // Componenti di combattimento (usa valori da config NPC se non specificati)
    const combatConfig = config.combat || {
      health: { current: npcDef.stats.health, max: npcDef.stats.health },
      shield: { current: npcDef.stats.shield, max: npcDef.stats.shield },
      damage: { value: npcDef.stats.damage, range: npcDef.stats.range, cooldown: npcDef.stats.cooldown }
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
   * Crea un'entità Remote Player
   */
  createRemotePlayer(config: RemotePlayerConfig): Entity {
    const entity = this.ecs.createEntity();

    // Componenti spaziali
    this.addSpatialComponents(entity, config.position);

    // Aggiungi AnimatedSprite se fornito (rimuovi Sprite se presente)
    if (this.ecs.hasComponent(entity, Sprite)) {
      this.ecs.removeComponent(entity, Sprite);
    }
    if (config.animatedSprite) {
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

    // Interpolazione per movimento fluido (se richiesta)
    if (config.interpolation) {
      this.ecs.addComponent(entity, InterpolationTarget, new InterpolationTarget(
        config.position.x,
        config.position.y,
        config.position.rotation || 0
      ));
    }

    return entity;
  }

  /**
   * Aggiunge componenti spaziali a un'entità
   */
  private addSpatialComponents(entity: Entity, config: SpatialConfig): void {
    // Transform obbligatorio
    this.ecs.addComponent(entity, Transform, new Transform(
      config.x,
      config.y,
      config.rotation || 0
    ));

    // Velocity opzionale
    if (config.velocity) {
      this.ecs.addComponent(entity, Velocity, new Velocity(
        config.velocity.x,
        config.velocity.y
      ));
    }

    // Sprite opzionale
    if (config.sprite) {
      this.ecs.addComponent(entity, Sprite, config.sprite);
    }
  }

  /**
   * Aggiunge componenti di combattimento a un'entità
   */
  private addCombatComponents(entity: Entity, config: CombatConfig): void {
    // Health component - supporta sia il formato annidato che diretto
    if (config.health) {
      this.ecs.addComponent(entity, Health, new Health(
        config.health.current || config.health,
        config.health.max || config.health
      ));
    } else if (config.stats?.health) {
      // Formato diretto per player (da playerDef.stats)
      this.ecs.addComponent(entity, Health, new Health(
        config.stats.health,
        config.stats.health
      ));
    }

    // Shield component - supporta sia il formato annidato che diretto
    if (config.shield) {
      this.ecs.addComponent(entity, Shield, new Shield(
        config.shield.current || config.shield,
        config.shield.max || config.shield
      ));
    } else if (config.stats?.shield) {
      // Formato diretto per player (da playerDef.stats)
      this.ecs.addComponent(entity, Shield, new Shield(
        config.stats.shield,
        config.stats.shield
      ));
    }

    // Damage component - supporta sia il formato diretto (stats) che il formato annidato (damage)
    if (config.damage) {
      this.ecs.addComponent(entity, Damage, new Damage(
        config.damage.value || config.damage,
        config.damage.range || config.stats?.range || 600,
        config.damage.cooldown || config.stats?.cooldown || 1000
      ));
    } else if (config.stats?.damage) {
      // Formato diretto per player (da playerDef.stats)
      this.ecs.addComponent(entity, Damage, new Damage(
        config.stats.damage,
        config.stats.range,
        config.stats.cooldown
      ));
    }
  }

  /**
   * Aggiunge componenti di progresso a un'entità (principalmente per player)
   */
  private addProgressionComponents(entity: Entity, config: ProgressionConfig): void {
    if (config.stats) {
      this.ecs.addComponent(entity, PlayerStats, new PlayerStats(
        config.stats.kills || 0,
        config.stats.deaths || 0,
        config.stats.missionsCompleted || 0,
        config.stats.playTime || 0
      ));
    }

    if (config.upgrades) {
      const upgrades = new PlayerUpgrades();
      upgrades.setUpgrades(
        config.upgrades.hpUpgrades || 0,
        config.upgrades.shieldUpgrades || 0,
        config.upgrades.speedUpgrades || 0,
        config.upgrades.damageUpgrades || 0
      );
      this.ecs.addComponent(entity, PlayerUpgrades, upgrades);
    }

    if (config.skillPoints !== undefined) {
      this.ecs.addComponent(entity, SkillPoints, new SkillPoints(config.skillPoints));
    }

    // Risorse economiche
    this.ecs.addComponent(entity, Credits, new Credits(config.credits || 0));
    this.ecs.addComponent(entity, Cosmos, new Cosmos(config.cosmos || 0));
    this.ecs.addComponent(entity, Experience, new Experience(config.experience || 0));
    this.ecs.addComponent(entity, Honor, new Honor(config.honor || 0));
    
    // Ruoli del giocatore
    this.ecs.addComponent(entity, PlayerRole, new PlayerRole(config.isAdministrator || false));
  }
}
