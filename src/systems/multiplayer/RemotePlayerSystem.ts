import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Sprite } from '../../entities/Sprite';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { Velocity } from '../../entities/spatial/Velocity';

/**
 * Sistema per la gestione dei giocatori remoti in multiplayer
 * Gestisce creazione, aggiornamento e rimozione delle entità remote player
 */
export class RemotePlayerSystem extends BaseSystem {
  // Mappa clientId -> entityId per tracciare i giocatori remoti
  private remotePlayers: Map<string, number> = new Map();
  // Mappa clientId -> {nickname, rank} per info visualizzazione
  private remotePlayerInfo: Map<string, {nickname: string, rank: string}> = new Map();

  // Sprite condiviso per tutti i remote player (più efficiente)
  private sharedSprite: Sprite;

  constructor(ecs: ECS, shipImage?: HTMLImageElement | null, shipWidth?: number, shipHeight?: number) {
    super(ecs);
    const width = shipWidth || 32;
    const height = shipHeight || 32;
    // Crea un singolo sprite condiviso per tutti i remote player
    this.sharedSprite = new Sprite(shipImage, width, height);
  }

  /**
   * Aggiorna l'immagine del sprite condiviso (per quando l'immagine viene caricata)
   */
  updateSharedSpriteImage(image: HTMLImageElement | null, width?: number, height?: number): void {
    if (width) this.sharedSprite.width = width;
    if (height) this.sharedSprite.height = height;
    this.sharedSprite.image = image;
  }


  update(_deltaTime: number): void {
    // Per ora non abbiamo logica di update specifica
    // I componenti Velocity vengono gestiti dal MovementSystem
  }

  /**
   * Imposta info nickname e rank per un remote player
   */
  setRemotePlayerInfo(clientId: string, nickname: string, rank: string = 'Recruit'): void {
    this.remotePlayerInfo.set(clientId, { nickname, rank });
  }

  /**
   * Ottiene info di un remote player
   */
  getRemotePlayerInfo(clientId: string): {nickname: string, rank: string} | undefined {
    return this.remotePlayerInfo.get(clientId);
  }

  /**
   * Aggiunge un nuovo giocatore remoto
   */
  addRemotePlayer(clientId: string, position: { x: number; y: number }, rotation: number = 0): number {
    // Rimuovi giocatore esistente se presente
    this.removeRemotePlayer(clientId);

    // Crea una nuova entity per il giocatore remoto
    const entity = this.ecs.createEntity();

    // Aggiungi componenti base
    const transform = new Transform(position.x, position.y, rotation);
    this.ecs.addComponent(entity, Transform, transform);

    // Aggiungi velocità (inizialmente ferma)
    const velocity = new Velocity(0, 0, 0);
    this.ecs.addComponent(entity, Velocity, velocity);

    // Aggiungi salute per mostrare le barre
    const health = new Health(100, 100); // HP completo per giocatori remoti
    this.ecs.addComponent(entity, Health, health);

    // Aggiungi scudo (come player locale)
    const shield = new Shield(50, 50); // Scudo completo per giocatori remoti
    this.ecs.addComponent(entity, Shield, shield);

    // Aggiungi danno (per completezza, anche se non controllato localmente)
    const damage = new Damage(50, 30, 100); // Valori base per giocatori remoti
    this.ecs.addComponent(entity, Damage, damage);

    // Aggiungi il sprite condiviso per il giocatore remoto
    // Tutti i remote player condividono lo stesso sprite per efficienza
    this.ecs.addComponent(entity, Sprite, this.sharedSprite);


    // Registra il giocatore remoto
    this.remotePlayers.set(clientId, entity.id);

    return entity.id;
  }

  /**
   * Aggiorna posizione e rotazione di un giocatore remoto esistente
   */
  updateRemotePlayer(clientId: string, position: { x: number; y: number }, rotation: number = 0): void {
    const entityId = this.remotePlayers.get(clientId);
    if (!entityId) {
      return;
    }

    const entity = this.ecs.getEntity(entityId);
    if (entity) {
      const transform = this.ecs.getComponent(entity, Transform);
      if (transform) {
        transform.x = position.x;
        transform.y = position.y;
        transform.rotation = rotation;

      }
    }
  }

  /**
   * Rimuove un giocatore remoto
   */
  removeRemotePlayer(clientId: string): void {
    const entityId = this.remotePlayers.get(clientId);
    if (entityId) {
      const entity = this.ecs.getEntity(entityId);
      if (entity) {
        this.ecs.removeEntity(entity);
        this.remotePlayers.delete(clientId);
        this.remotePlayerInfo.delete(clientId);
      }
    }
  }

  /**
   * Rimuove tutti i giocatori remoti
   */
  removeAllRemotePlayers(): void {
    for (const clientId of this.remotePlayers.keys()) {
      this.removeRemotePlayer(clientId);
    }
  }

  /**
   * Ottiene l'entity ID di un giocatore remoto
   */
  getRemotePlayerEntity(clientId: string): number | undefined {
    return this.remotePlayers.get(clientId);
  }

  /**
   * Verifica se un clientId corrisponde a un giocatore remoto
   */
  isRemotePlayer(clientId: string): boolean {
    return this.remotePlayers.has(clientId);
  }

  /**
   * Ottiene tutti i client IDs dei giocatori remoti attivi
   */
  getActiveRemotePlayers(): string[] {
    return Array.from(this.remotePlayers.keys());
  }

  /**
   * Ottiene il numero di giocatori remoti attivi
   */
  getRemotePlayerCount(): number {
    return this.remotePlayers.size;
  }
}
