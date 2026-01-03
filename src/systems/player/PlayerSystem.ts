import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { Sprite } from '../../entities/Sprite';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Credits, Cosmos } from '../../entities/currency/Currency';
import { Experience } from '../../entities/currency/Experience';
import { Honor } from '../../entities/currency/Honor';
import { PlayerStats } from '../../entities/player/PlayerStats';
import { ActiveQuest } from '../../entities/quest/ActiveQuest';
import { getPlayerDefinition } from '../../config/PlayerConfig';

/**
 * Sistema dedicato alla gestione dell'entità giocatore
 * Gestisce creazione, configurazione e stato del player
 */
export class PlayerSystem extends System {
  private playerEntity: any = null;

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Crea e configura l'entità giocatore
   */
  createPlayer(startX: number, startY: number): any {
    // Crea l'entità base
    const entity = this.ecs.createEntity();
    const playerDef = getPlayerDefinition();

    // Aggiungi componenti spaziali
    this.ecs.addComponent(entity, Transform, new Transform(startX, startY));
    this.ecs.addComponent(entity, Velocity, new Velocity(0, 0));

    // Aggiungi componenti visuali
    this.ecs.addComponent(entity, Sprite, new Sprite(null as any)); // Placeholder - sarà impostato dal sistema di caricamento asset

    // Aggiungi componenti combattimento
    this.ecs.addComponent(entity, Health, new Health(playerDef.stats.health, playerDef.stats.health));
    if (playerDef.stats.shield) {
      this.ecs.addComponent(entity, Shield, new Shield(playerDef.stats.shield, playerDef.stats.shield));
    }

    // Aggiungi componenti economici
    this.ecs.addComponent(entity, Credits, new Credits(playerDef.startingResources.credits));
    this.ecs.addComponent(entity, Cosmos, new Cosmos(playerDef.startingResources.cosmos));

    // Aggiungi componenti progresso
    this.ecs.addComponent(entity, Experience, new Experience(0));
    this.ecs.addComponent(entity, Honor, new Honor(0));
    this.ecs.addComponent(entity, PlayerStats, new PlayerStats());

    // Aggiungi componente quest
    this.ecs.addComponent(entity, ActiveQuest, new ActiveQuest());

    this.playerEntity = entity;
    return entity;
  }

  /**
   * Restituisce l'entità giocatore
   */
  getPlayerEntity(): any {
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
