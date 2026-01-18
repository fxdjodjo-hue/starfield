import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { AnimatedSprite } from '../../entities/AnimatedSprite';
import { RemotePlayer } from '../../entities/player/RemotePlayer';
import { EntityFactory } from '../../factories/EntityFactory';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { EntityStateSystem } from '../../core/domain/EntityStateSystem';

/**
 * Sistema per la gestione dei giocatori remoti in multiplayer
 * Usa componenti ECS invece di Map manuale per maggiore robustezza
 */
export class RemotePlayerSystem extends BaseSystem {
  // AnimatedSprite condiviso per tutti i remote player (più efficiente)
  private sharedAnimatedSprite: AnimatedSprite | null;
  // Logging per evitare spam di aggiornamenti posizione
  private lastUpdateLog = new Map<string, number>();
  // Factory per creare entità
  private entityFactory: EntityFactory;

  constructor(ecs: ECS, animatedSprite: AnimatedSprite | null = null) {
    super(ecs);
    // Usa AnimatedSprite condiviso per tutti i remote player
    this.sharedAnimatedSprite = animatedSprite;
    this.entityFactory = new EntityFactory(ecs);
  }

  /**
   * Aggiorna l'AnimatedSprite condiviso (per quando viene caricato)
   */
  updateSharedAnimatedSprite(animatedSprite: AnimatedSprite | null): void {
    this.sharedAnimatedSprite = animatedSprite;
  }


  update(_deltaTime: number): void {
    // Gestisci orientamento dei remote player verso NPC selezionati
    this.faceSelectedNpcsForRemotePlayers();

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

    // Usa EntityFactory per creare il remote player
    const entity = this.entityFactory.createRemotePlayer({
      clientId,
      position: {
        x,
        y,
        rotation
      },
      animatedSprite: this.sharedAnimatedSprite,
      combat: {
        health: { current: 100, max: 100 }, // HP completo per giocatori remoti
        shield: { current: 50, max: 50 },   // Scudo completo per giocatori remoti
        damage: { value: 50, range: 30, cooldown: 100 } // Valori base per giocatori remoti
      },
      interpolation: true // Abilita interpolazione per movimento fluido
    });

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

  /**
   * Fa ruotare i remote player verso i loro NPC selezionati
   * Simile a faceSelectedNpc() nel PlayerControlSystem, ma per remote player
   */
  private faceSelectedNpcsForRemotePlayers(): void {
    // Trova tutti i remote player
    const remotePlayerEntities = this.ecs.getEntitiesWithComponents(RemotePlayer, Transform);

    for (const remotePlayerEntity of remotePlayerEntities) {
      // Verifica se questo remote player ha un NPC selezionato
      // Nota: I remote player potrebbero non avere il componente SelectedNpc localmente
      // perché questo viene gestito lato server. Tuttavia, possiamo assumere che se
      // un remote player sta attaccando (riceve aggiornamenti di combattimento),
      // dovrebbe essere orientato verso il suo target.

      // Per ora, implementiamo una soluzione più semplice:
      // Se il remote player ha un'interpolazione attiva e non si sta muovendo velocemente,
      // potrebbe essere in combattimento e dovrebbe essere orientato verso un target.
      // Questa è una soluzione temporanea - idealmente servirebbe info dal server.

      // TODO: Il server dovrebbe inviare info sui target selezionati dei remote player
      // Per ora, lasciamo questo come placeholder per future implementazioni

      // Esempio di logica futura:
      /*
      const selectedNpcs = this.getSelectedNpcsForRemotePlayer(remotePlayerEntity);
      if (selectedNpcs.length > 0) {
        const selectedNpc = selectedNpcs[0];
        const npcTransform = this.ecs.getComponent(selectedNpc, Transform);
        const playerTransform = this.ecs.getComponent(remotePlayerEntity, Transform);

        if (npcTransform && playerTransform) {
          const dx = npcTransform.x - playerTransform.x;
          const dy = npcTransform.y - playerTransform.y;
          const angle = Math.atan2(dy, dx);
          playerTransform.rotation = angle;
        }
      }
      */
    }
  }

  /**
   * Aggiorna la posizione di un giocatore remoto (usato per respawn)
   */
  updatePlayerPosition(clientId: string, x: number, y: number, rotation: number = 0): void {
    const entity = this.findRemotePlayerEntity(clientId);
    if (!entity) {
      console.warn(`[REMOTE_PLAYER] Cannot update position for unknown player ${clientId}`);
      return;
    }

    const interpolation = this.ecs.getComponent(entity, InterpolationTarget);
    if (interpolation) {
      // Forza la posizione immediatamente per il respawn
      interpolation.updateTarget(x, y, rotation);
      // Anche aggiorna la posizione renderizzata per un respawn istantaneo
      const transform = this.ecs.getComponent(entity, Transform);
      if (transform) {
        transform.x = x;
        transform.y = y;
        transform.rotation = rotation;
      }
    }
  }

  /**
   * Aggiorna le statistiche di salute e scudo di un giocatore remoto
   */
  updatePlayerStats(clientId: string, health: number, maxHealth: number, shield: number, maxShield: number): void {
    const entity = this.findRemotePlayerEntity(clientId);
    if (!entity) {
      console.warn(`[REMOTE_PLAYER] Cannot update stats for unknown player ${clientId}`);
      return;
    }

    // Usa EntityStateSystem per aggiornare lo stato
    EntityStateSystem.updateEntityState(this.ecs, entity, {
      health: {
        current: health,
        max: maxHealth
      },
      shield: {
        current: shield,
        max: maxShield
      }
    });
  }
}
