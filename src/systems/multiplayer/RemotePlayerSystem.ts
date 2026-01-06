import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';
import { Sprite } from '../../entities/Sprite';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { RemotePlayer } from '../../entities/player/RemotePlayer';

/**
 * Sistema per la gestione dei giocatori remoti in multiplayer
 * Usa componenti ECS invece di Map manuale per maggiore robustezza
 */
export class RemotePlayerSystem extends BaseSystem {
  // Sprite condiviso per tutti i remote player (più efficiente)
  private sharedSprite: Sprite;
  // Logging per evitare spam di aggiornamenti posizione
  private lastUpdateLog = new Map<string, number>();

  constructor(ecs: ECS, shipImage: HTMLImageElement | null = null, shipWidth?: number, shipHeight?: number) {
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
   * Trova l'entità di un giocatore remoto tramite clientId
   */
  private findRemotePlayerEntity(clientId: string): Entity | null {
    const remotePlayerEntities = this.ecs.getEntitiesWithComponents(RemotePlayer);

    for (const entity of remotePlayerEntities) {
      const remotePlayerComponent = this.ecs.getComponent(entity, RemotePlayer);
      if (remotePlayerComponent && remotePlayerComponent.clientId === clientId) {
        return entity;
      }
    }

    return null;
  }

  /**
   * Imposta info nickname e rank per un remote player
   */
  setRemotePlayerInfo(clientId: string, nickname: string, rank: string = 'Recruit'): void {
    const entity = this.findRemotePlayerEntity(clientId);
    if (entity) {
      const remotePlayerComponent = this.ecs.getComponent(entity, RemotePlayer);
      if (remotePlayerComponent) {
        remotePlayerComponent.updateInfo(nickname, rank);
      }
    }
  }

  /**
   * Ottiene info di un remote player
   */
  getRemotePlayerInfo(clientId: string): {nickname: string, rank: string} | undefined {
    const entity = this.findRemotePlayerEntity(clientId);
    if (entity) {
      const remotePlayerComponent = this.ecs.getComponent(entity, RemotePlayer);
      if (remotePlayerComponent) {
        return {
          nickname: remotePlayerComponent.nickname,
          rank: remotePlayerComponent.rank
        };
      }
    }
    return undefined;
  }

  /**
   * Aggiunge un nuovo giocatore remoto o aggiorna posizione se già esistente
   */
  addRemotePlayer(clientId: string, x: number, y: number, rotation: number = 0): number {
    // Verifica se il giocatore remoto esiste già
    const existingEntity = this.findRemotePlayerEntity(clientId);
    if (existingEntity) {
      // Aggiorna posizione del giocatore esistente
      this.updateRemotePlayer(clientId, x, y, rotation);
      return existingEntity.id;
    }

    // Crea una nuova entity per il giocatore remoto
    const entity = this.ecs.createEntity();

    // Aggiungi componenti base
    const transform = new Transform(x, y, rotation);
    this.ecs.addComponent(entity, Transform, transform);

    // Aggiungi il componente identificativo del giocatore remoto
    const remotePlayerComponent = new RemotePlayer(clientId, '', 'Recruit');
    this.ecs.addComponent(entity, RemotePlayer, remotePlayerComponent);

    // Nota: Non aggiungiamo Velocity ai remote player per evitare conflitti
    // con il MovementSystem durante l'interpolazione

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

    // AGGIUNGI INTERPOLAZIONE PERSISTENTE
    // Componente rimane attivo per sempre - interpolazione continua
    const interpolation = new InterpolationTarget(x, y, rotation);
    this.ecs.addComponent(entity, InterpolationTarget, interpolation);

    console.log(`[REMOTE_PLAYER] Created new remote player ${clientId} -> entity ${entity.id}`);

    return entity.id;
  }

  /**
   * Aggiorna posizione e rotazione di un giocatore remoto esistente
   */
  updateRemotePlayer(clientId: string, x: number, y: number, rotation: number = 0): void {
    const entity = this.findRemotePlayerEntity(clientId);
    if (!entity) {
      // Player remoto non trovato - potrebbe essere normale se non ancora creato
      // Non logghiamo errori per evitare spam, il sistema si autorecupera
      return;
    }

    const interpolation = this.ecs.getComponent(entity, InterpolationTarget);
    if (interpolation) {
      // Log aggiornamenti posizione ogni 5 secondi per evitare spam
      const now = Date.now();
      if (!this.lastUpdateLog[clientId] || now - this.lastUpdateLog[clientId] > 5000) {
        console.log(`[REMOTE_PLAYER] Updated ${clientId}: (${x.toFixed(1)}, ${y.toFixed(1)}) -> entity ${entity.id}`);
        this.lastUpdateLog[clientId] = now;
      }

      // AGGIORNA SOLO TARGET - Componente rimane PERSISTENTE
      // Eliminazione completa degli scatti attraverso interpolazione continua
      interpolation.updateTarget(x, y, rotation);
    } else {
      console.warn(`[REMOTE_PLAYER] No interpolation component found for ${clientId} entity ${entity.id}`);
    }
  }

  /**
   * Rimuove un giocatore remoto
   */
  removeRemotePlayer(clientId: string): void {
    const entity = this.findRemotePlayerEntity(clientId);
    if (entity) {
      this.ecs.removeEntity(entity);
      console.log(`[REMOTE_PLAYER] Removed remote player ${clientId} -> entity ${entity.id}`);
    }
  }

  /**
   * Rimuove tutti i giocatori remoti
   */
  removeAllRemotePlayers(): void {
    const remotePlayerEntities = this.ecs.getEntitiesWithComponents(RemotePlayer);

    for (const entity of remotePlayerEntities) {
      const remotePlayerComponent = this.ecs.getComponent(entity, RemotePlayer);
      if (remotePlayerComponent) {
        console.log(`[REMOTE_PLAYER] Removing all remote players: ${remotePlayerComponent.clientId} -> entity ${entity.id}`);
        this.ecs.removeEntity(entity);
      }
    }
  }

  /**
   * Ottiene l'entity ID di un giocatore remoto
   */
  getRemotePlayerEntity(clientId: string): number | undefined {
    const entity = this.findRemotePlayerEntity(clientId);
    return entity ? entity.id : undefined;
  }

  /**
   * Verifica se un clientId corrisponde a un giocatore remoto
   */
  isRemotePlayer(clientId: string): boolean {
    return this.findRemotePlayerEntity(clientId) !== null;
  }

  /**
   * Ottiene le posizioni di tutti i giocatori remoti per la minimappa
   */
  getRemotePlayerPositions(): Array<{x: number, y: number}> {
    const positions: Array<{x: number, y: number}> = [];
    const remotePlayerEntities = this.ecs.getEntitiesWithComponents(RemotePlayer, Transform);

    for (const entity of remotePlayerEntities) {
      const transform = this.ecs.getComponent(entity, Transform);
      if (transform) {
        positions.push({ x: transform.x, y: transform.y });
      }
    }

    return positions;
  }

  /**
   * Ottiene tutti i client IDs dei giocatori remoti attivi
   */
  getActiveRemotePlayers(): string[] {
    const remotePlayerEntities = this.ecs.getEntitiesWithComponents(RemotePlayer);
    return remotePlayerEntities
      .map(entity => {
        const component = this.ecs.getComponent(entity, RemotePlayer);
        return component ? component.clientId : null;
      })
      .filter(clientId => clientId !== null) as string[];
  }

  /**
   * Ottiene il numero di giocatori remoti attivi
   */
  getRemotePlayerCount(): number {
    return this.ecs.getEntitiesWithComponents(RemotePlayer).length;
  }
}
