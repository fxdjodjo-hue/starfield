import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';
import { Sprite } from '../../entities/Sprite';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';

/**
 * Sistema per la gestione dei giocatori remoti in multiplayer
 * Gestisce creazione, aggiornamento e rimozione delle entità remote player
 */
export class RemotePlayerSystem extends BaseSystem {
  // Mappa unificata clientId -> {entityId, nickname, rank} per sicurezza e performance
  private remotePlayers: Map<string, {entityId: number, nickname: string, rank: string}> = new Map();

  // Sprite condiviso per tutti i remote player (più efficiente)
  private sharedSprite: Sprite;

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
   * Imposta info nickname e rank per un remote player
   */
  setRemotePlayerInfo(clientId: string, nickname: string, rank: string = 'Recruit'): void {
    const playerData = this.remotePlayers.get(clientId);
    if (playerData) {
      playerData.nickname = nickname;
      playerData.rank = rank;
    }
  }

  /**
   * Ottiene info di un remote player
   */
  getRemotePlayerInfo(clientId: string): {nickname: string, rank: string} | undefined {
    const playerData = this.remotePlayers.get(clientId);
    return playerData ? { nickname: playerData.nickname, rank: playerData.rank } : undefined;
  }

  /**
   * Aggiunge un nuovo giocatore remoto o aggiorna posizione se già esistente
   */
  addRemotePlayer(clientId: string, x: number, y: number, rotation: number = 0): number {

    // Se il giocatore remoto esiste già, aggiorna solo la posizione senza ricreare l'entity
    if (this.remotePlayers.has(clientId)) {
      this.updateRemotePlayer(clientId, x, y, rotation);
      return this.remotePlayers.get(clientId)!.entityId;
    }

    // Crea una nuova entity per il giocatore remoto
    const entity = this.ecs.createEntity();

    // Aggiungi componenti base
    const transform = new Transform(x, y, rotation);
    this.ecs.addComponent(entity, Transform, transform);

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

    // Registra il giocatore remoto nella mappa unificata
    this.remotePlayers.set(clientId, {
      entityId: entity.id,
      nickname: '',
      rank: 'Recruit'
    });

    return entity.id;
  }

  /**
   * Aggiorna posizione e rotazione di un giocatore remoto esistente
   */
  updateRemotePlayer(clientId: string, x: number, y: number, rotation: number = 0): void {
    const playerData = this.remotePlayers.get(clientId);
    if (!playerData) {
      return;
    }

    const entity = this.ecs.getEntity(playerData.entityId);
    if (entity) {
      const interpolation = this.ecs.getComponent(entity, InterpolationTarget);
      if (interpolation) {
        // AGGIORNA SOLO TARGET - Componente rimane PERSISTENTE
        // Eliminazione completa degli scatti attraverso interpolazione continua
        interpolation.updateTarget(x, y, rotation);
      }
    }
  }

  /**
   * Rimuove un giocatore remoto
   */
  removeRemotePlayer(clientId: string): void {
    const playerData = this.remotePlayers.get(clientId);
    if (playerData) {
      const entity = this.ecs.getEntity(playerData.entityId);
      if (entity) {
        this.ecs.removeEntity(entity);
        this.remotePlayers.delete(clientId);
      }
    }
  }

  /**
   * Rimuove tutti i giocatori remoti
   */
  removeAllRemotePlayers(): void {
    // Usa Array.from per iterazione sicura mentre modifichiamo la mappa
    const clientIds = Array.from(this.remotePlayers.keys());
    for (const clientId of clientIds) {
      this.removeRemotePlayer(clientId);
    }
  }

  /**
   * Ottiene l'entity ID di un giocatore remoto
   */
  getRemotePlayerEntity(clientId: string): number | undefined {
    const playerData = this.remotePlayers.get(clientId);
    return playerData ? playerData.entityId : undefined;
  }

  /**
   * Verifica se un clientId corrisponde a un giocatore remoto
   */
  isRemotePlayer(clientId: string): boolean {
    return this.remotePlayers.has(clientId);
  }

  /**
   * Ottiene le posizioni di tutti i giocatori remoti per la minimappa
   */
  getRemotePlayerPositions(): Array<{x: number, y: number}> {
    const positions: Array<{x: number, y: number}> = [];

    for (const [clientId, playerData] of this.remotePlayers) {
      const entity = this.ecs.getEntity(playerData.entityId);
      if (entity) {
        const transform = this.ecs.getComponent(entity, Transform);
        if (transform) {
          positions.push({ x: transform.x, y: transform.y });
        }
      }
    }

    return positions;
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
