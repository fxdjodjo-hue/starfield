import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Sprite } from '../../entities/Sprite';
import { EntityFactory } from '../../factories/EntityFactory';
import { getPlayerDefinition } from '../../config/PlayerConfig';

/**
 * Sistema dedicato alla gestione dell'entità giocatore
 * Gestisce creazione, configurazione e stato del player utilizzando EntityFactory
 */
export class PlayerSystem extends System {
  private playerEntity: Entity | null = null;
  private entityFactory: EntityFactory;

  constructor(ecs: ECS) {
    super(ecs);
    this.entityFactory = new EntityFactory(ecs);
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
        skillPoints: 0,
        credits: 0,
        cosmos: 0,
        experience: 0,
        honor: 0
      },
      upgrades: {
        // Inizializza sempre gli upgrades ECS con valori di default
        // Verranno sovrascritti dal server quando arrivano i dati
        hpUpgrades: 0,
        shieldUpgrades: 0,
        speedUpgrades: 0,
        damageUpgrades: 0
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

  update(deltaTime: number): void {
    // Logica specifica del player se necessaria
    // Per ora delega ai sistemi specializzati
  }
}