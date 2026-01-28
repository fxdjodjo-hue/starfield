import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Sprite } from '../../entities/Sprite';
import { GameEntityFactory } from '../../factories/GameEntityFactory';
import { getPlayerDefinition } from '../../config/PlayerConfig';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { PlayerUpgrades } from '../../entities/player/PlayerUpgrades';
import { Inventory } from '../../entities/player/Inventory';

/**
 * Sistema dedicato alla gestione dell'entità giocatore
 * Gestisce creazione, configurazione e stato del player utilizzando EntityFactory
 */
export class PlayerSystem extends System {
  private playerEntity: Entity | null = null;
  private entityFactory: GameEntityFactory;

  constructor(ecs: ECS) {
    super(ecs);
    this.entityFactory = new GameEntityFactory(ecs);
  }

  /**
   * Crea e configura l'entità giocatore
   */
  createPlayer(startX: number, startY: number, serverAuthoritative: boolean = true): Entity {
    const playerDef = getPlayerDefinition();

    // Crea sprite placeholder
    const playerSprite = new Sprite(null, playerDef.spriteSize.width, playerDef.spriteSize.height);

    // Usa EntityFactory per creare il player
    const entity = this.entityFactory.createPlayer({
      position: {
        x: startX,
        y: startY,
        rotation: 0,
        sprite: playerSprite
      },
      progression: {
        // Inizializza sempre i componenti ECS con valori di default
        // Verranno sovrascritti dal server quando arrivano i dati
        stats: { kills: 0, deaths: 0, missionsCompleted: 0, playTime: 0 },
        upgrades: {
          hpUpgrades: 0,
          shieldUpgrades: 0,
          speedUpgrades: 0,
          damageUpgrades: 0,
          missileDamageUpgrades: 0
        },
        credits: 0,
        cosmos: 0,
        experience: 0,
        honor: 0
      }
    });

    this.playerEntity = entity;
    return entity;
  }

  /**
   * Restituisce l'entità giocatore
   */
  getPlayerEntity(): Entity | null {
    return this.playerEntity;
  }

  /**
   * Verifica se il giocatore esiste
   */
  hasPlayer(): boolean {
    return this.playerEntity !== null;
  }

  /**
   * Distrugge l'entità giocatore
   */
  destroyPlayer(): void {
    if (this.playerEntity) {
      this.ecs.removeEntity(this.playerEntity);
      this.playerEntity = null;
    }
  }

  /**
   * Ricalcola e aggiorna i componenti fisici (Health, Shield, Damage) 
   * basandosi sugli upgrade e gli item equipaggiati.
   */
  refreshPlayerStats(): void {
    if (!this.playerEntity) return;

    const playerDef = getPlayerDefinition();
    const upgrades = this.ecs.getComponent(this.playerEntity, PlayerUpgrades);
    const inventory = this.ecs.getComponent(this.playerEntity, Inventory);
    const health = this.ecs.getComponent(this.playerEntity, Health);
    const shield = this.ecs.getComponent(this.playerEntity, Shield);
    const damage = this.ecs.getComponent(this.playerEntity, Damage);

    if (upgrades) {
      if (health) {
        const oldMax = health.max;
        const newMax = Math.floor(playerDef.stats.health * upgrades.getHPBonus(inventory));
        if (oldMax !== newMax) {
          const ratio = health.current / oldMax;
          health.max = newMax;
          health.current = Math.floor(newMax * ratio);
        }
      }

      if (shield && playerDef.stats.shield) {
        const oldMax = shield.max;
        const newMax = Math.floor(playerDef.stats.shield * upgrades.getShieldBonus(inventory));
        if (oldMax !== newMax) {
          const ratio = shield.max > 0 ? shield.current / shield.max : 1;
          shield.max = newMax;
          shield.current = Math.floor(newMax * ratio);
        }
      }

      if (damage) {
        damage.damage = Math.floor(playerDef.stats.damage * upgrades.getDamageBonus(inventory));
      }
    }
  }

  update(deltaTime: number): void {
    // Logica specifica del player se necessaria
    // Per ora delega ai sistemi specializzati
  }
}