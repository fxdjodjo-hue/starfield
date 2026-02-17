import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { AnimatedSprite } from '../../entities/AnimatedSprite';
import { RemotePlayer } from '../../entities/player/RemotePlayer';
import { RemotePet } from '../../entities/player/RemotePet';
import { GameEntityFactory } from '../../factories/GameEntityFactory';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { EntityStateSystem } from '../../core/domain/EntityStateSystem';
import type { AssetManager } from '../../core/services/AssetManager';
import { createPlayerShipAnimatedSprite } from '../../core/services/PlayerShipSpriteFactory';
import { getSelectedPlayerShipSkinId } from '../../config/ShipSkinConfig';
import { getDefaultPlayerPet, getPlayerPetById, type PlayerPetDefinition } from '../../config/PetConfig';

export interface RemotePetStatePayload {
  petId?: string;
  petNickname?: string;
  isActive?: boolean;
}

export interface RemotePetTransformPayload {
  x?: number;
  y?: number;
  rotation?: number;
}

/**
 * Sistema per la gestione dei giocatori remoti in multiplayer
 * Usa componenti ECS invece di Map manuale per maggiore robustezza
 */
export class RemotePlayerSystem extends BaseSystem {
  // AnimatedSprite condiviso per tutti i remote player (più efficiente)
  private sharedAnimatedSprite: AnimatedSprite | null;
  private assetManager: AssetManager | null;
  private remoteShipSpriteCache: Map<string, AnimatedSprite> = new Map();
  private pendingShipSpriteLoads: Map<string, Promise<AnimatedSprite | null>> = new Map();
  private remotePetEntityByClientId: Map<string, number> = new Map();
  private remotePetSpriteCache: Map<string, AnimatedSprite> = new Map();
  private pendingPetSpriteLoads: Map<string, Promise<AnimatedSprite | null>> = new Map();
  // Logging per evitare spam di aggiornamenti posizione
  private lastUpdateLog = new Map<string, number>();
  // Factory per creare entità
  private entityFactory: GameEntityFactory;

  constructor(ecs: ECS, animatedSprite: AnimatedSprite | null = null, assetManager: AssetManager | null = null) {
    super(ecs);
    this.sharedAnimatedSprite = animatedSprite;
    this.assetManager = assetManager;
    this.entityFactory = new GameEntityFactory(ecs);

    const initialSkinId = (animatedSprite as AnimatedSprite & { shipSkinId?: string } | null)?.shipSkinId;
    if (animatedSprite && initialSkinId) {
      this.remoteShipSpriteCache.set(getSelectedPlayerShipSkinId(initialSkinId), animatedSprite);
    }
  }

  /**
   * Aggiorna l'AnimatedSprite condiviso (per quando viene caricato)
   */
  updateSharedAnimatedSprite(animatedSprite: AnimatedSprite | null): void {
    this.sharedAnimatedSprite = animatedSprite;
    const skinId = (animatedSprite as AnimatedSprite & { shipSkinId?: string } | null)?.shipSkinId;
    if (animatedSprite && skinId) {
      this.remoteShipSpriteCache.set(getSelectedPlayerShipSkinId(skinId), animatedSprite);
    }
  }

  private resolveRemoteShipSkinId(shipSkinId?: string | null): string {
    return getSelectedPlayerShipSkinId(shipSkinId || null);
  }

  private getCachedRemoteShipSprite(shipSkinId: string): AnimatedSprite | null {
    return this.remoteShipSpriteCache.get(shipSkinId) || null;
  }

  private applyRemoteShipSprite(entity: Entity, shipSkinId: string, sprite: AnimatedSprite): void {
    (sprite as AnimatedSprite & { shipSkinId?: string }).shipSkinId = shipSkinId;
    this.ecs.addComponent(entity, AnimatedSprite, sprite);

    const remotePlayer = this.ecs.getComponent(entity, RemotePlayer);
    if (remotePlayer) {
      remotePlayer.updateShipSkin(shipSkinId);
    }
  }

  private async loadRemoteShipSprite(shipSkinId: string): Promise<AnimatedSprite | null> {
    const cached = this.getCachedRemoteShipSprite(shipSkinId);
    if (cached) {
      return cached;
    }

    const pending = this.pendingShipSpriteLoads.get(shipSkinId);
    if (pending) {
      return pending;
    }

    if (!this.assetManager) {
      return this.sharedAnimatedSprite;
    }

    const loadPromise = createPlayerShipAnimatedSprite(this.assetManager, shipSkinId)
      .then((sprite) => {
        this.remoteShipSpriteCache.set(shipSkinId, sprite);
        return sprite;
      })
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.warn(`[REMOTE_PLAYER] Failed to load ship skin "${shipSkinId}"`, error);
        }
        return this.sharedAnimatedSprite;
      })
      .finally(() => {
        this.pendingShipSpriteLoads.delete(shipSkinId);
      });

    this.pendingShipSpriteLoads.set(shipSkinId, loadPromise);
    return loadPromise;
  }

  private normalizeRemotePetState(
    remotePetState?: RemotePetStatePayload | null
  ): { petId: string; petNickname: string; isActive: boolean } | null {
    if (!remotePetState || typeof remotePetState !== 'object') {
      return null;
    }

    const fallbackPetDefinition = getDefaultPlayerPet();
    const requestedPetId = String(remotePetState.petId || '').trim();
    const petDefinition = getPlayerPetById(requestedPetId) || fallbackPetDefinition;
    const petId = String(petDefinition?.id || requestedPetId || '').trim();
    if (!petId) {
      return null;
    }

    const normalizedNickname = String(remotePetState.petNickname || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 24)
      .trim();

    return {
      petId,
      petNickname: normalizedNickname || petDefinition?.displayName || petId,
      isActive: remotePetState.isActive !== false
    };
  }

  private getRemotePetDefinition(petId: string): PlayerPetDefinition | null {
    return getPlayerPetById(petId) || getDefaultPlayerPet();
  }

  private findRemotePetEntity(ownerClientId: string): Entity | null {
    const cachedEntityId = this.remotePetEntityByClientId.get(ownerClientId);
    if (cachedEntityId !== undefined) {
      const cachedEntity = this.ecs.getEntity(cachedEntityId);
      if (cachedEntity && this.ecs.hasComponent(cachedEntity, RemotePet)) {
        return cachedEntity;
      }
      this.remotePetEntityByClientId.delete(ownerClientId);
    }

    const remotePetEntities = this.ecs.getEntitiesWithComponents(RemotePet);
    for (const entity of remotePetEntities) {
      const remotePet = this.ecs.getComponent(entity, RemotePet);
      if (remotePet && remotePet.ownerClientId.toString() === ownerClientId.toString()) {
        this.remotePetEntityByClientId.set(ownerClientId, entity.id);
        return entity;
      }
    }

    return null;
  }

  private removeRemotePetEntity(ownerClientId: string): void {
    const entity = this.findRemotePetEntity(ownerClientId);
    if (entity) {
      this.ecs.removeEntity(entity);
    }
    this.remotePetEntityByClientId.delete(ownerClientId);
  }

  private calculateRemotePetAnchor(
    ownerX: number,
    ownerY: number,
    ownerRotation: number,
    petDefinition: PlayerPetDefinition
  ): { x: number; y: number } {
    const safeRotation = Number.isFinite(ownerRotation) ? ownerRotation : 0;
    const forwardX = Math.cos(safeRotation);
    const forwardY = Math.sin(safeRotation);
    const rightX = -forwardY;
    const rightY = forwardX;

    return {
      x: ownerX - forwardX * petDefinition.followDistance + rightX * petDefinition.lateralOffset,
      y: ownerY - forwardY * petDefinition.followDistance + rightY * petDefinition.lateralOffset
    };
  }

  private getCachedRemotePetSprite(petId: string): AnimatedSprite | null {
    return this.remotePetSpriteCache.get(petId) || null;
  }

  private applyRemotePetSprite(entity: Entity, petId: string, sprite: AnimatedSprite): void {
    (sprite as AnimatedSprite & { petId?: string }).petId = petId;
    this.ecs.addComponent(entity, AnimatedSprite, sprite);
  }

  private async loadRemotePetSprite(petId: string): Promise<AnimatedSprite | null> {
    const cached = this.getCachedRemotePetSprite(petId);
    if (cached) {
      return cached;
    }

    const pending = this.pendingPetSpriteLoads.get(petId);
    if (pending) {
      return pending;
    }

    const petDefinition = this.getRemotePetDefinition(petId);
    if (!this.assetManager || !petDefinition?.assetBasePath) {
      return null;
    }

    const loadPromise = this.assetManager.createAnimatedSprite(
      petDefinition.assetBasePath,
      petDefinition.spriteScale
    )
      .then((sprite) => {
        this.remotePetSpriteCache.set(petId, sprite);
        return sprite;
      })
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.warn(`[REMOTE_PET] Failed to load pet sprite "${petId}"`, error);
        }
        return null;
      })
      .finally(() => {
        this.pendingPetSpriteLoads.delete(petId);
      });

    this.pendingPetSpriteLoads.set(petId, loadPromise);
    return loadPromise;
  }

  private createRemotePetEntity(
    ownerClientId: string,
    ownerX: number,
    ownerY: number,
    ownerRotation: number,
    normalizedPetState: { petId: string; petNickname: string; isActive: boolean },
    petDefinition: PlayerPetDefinition,
    remotePetPosition?: RemotePetTransformPayload | null
  ): Entity {
    const anchor = this.calculateRemotePetAnchor(ownerX, ownerY, ownerRotation, petDefinition);
    const initialX = Number.isFinite(Number(remotePetPosition?.x))
      ? Number(remotePetPosition?.x)
      : anchor.x;
    const initialY = Number.isFinite(Number(remotePetPosition?.y))
      ? Number(remotePetPosition?.y)
      : anchor.y;
    const initialRotation = Number.isFinite(Number(remotePetPosition?.rotation))
      ? Number(remotePetPosition?.rotation)
      : ownerRotation;
    const remotePetEntity = this.ecs.createEntity();
    this.remotePetEntityByClientId.set(ownerClientId, remotePetEntity.id);

    this.ecs.addComponent(
      remotePetEntity,
      Transform,
      new Transform(initialX, initialY, initialRotation, 1, 1)
    );
    this.ecs.addComponent(
      remotePetEntity,
      InterpolationTarget,
      new InterpolationTarget(initialX, initialY, initialRotation)
    );
    this.ecs.addComponent(
      remotePetEntity,
      RemotePet,
      new RemotePet(ownerClientId, normalizedPetState.petId, normalizedPetState.petNickname, true)
    );

    return remotePetEntity;
  }

  private ensureRemotePetForPlayer(
    ownerClientId: string,
    ownerX: number,
    ownerY: number,
    ownerRotation: number,
    serverTimestamp?: number,
    remotePetState?: RemotePetStatePayload | null,
    remotePetPosition?: RemotePetTransformPayload | null
  ): void {
    const normalizedPetState = this.normalizeRemotePetState(remotePetState);
    if (!normalizedPetState) {
      return;
    }

    if (!normalizedPetState.isActive) {
      this.removeRemotePetEntity(ownerClientId);
      return;
    }

    const petDefinition = this.getRemotePetDefinition(normalizedPetState.petId);
    if (!petDefinition) {
      return;
    }

    let remotePetEntity = this.findRemotePetEntity(ownerClientId);
    let createdRemotePetEntity = false;
    if (remotePetEntity) {
      const remotePet = this.ecs.getComponent(remotePetEntity, RemotePet);
      const requiresRecreate = !remotePet || remotePet.petId !== normalizedPetState.petId;
      if (requiresRecreate) {
        this.removeRemotePetEntity(ownerClientId);
        remotePetEntity = null;
      }
    }

    if (!remotePetEntity) {
      remotePetEntity = this.createRemotePetEntity(
        ownerClientId,
        ownerX,
        ownerY,
        ownerRotation,
        normalizedPetState,
        petDefinition,
        remotePetPosition
      );
      createdRemotePetEntity = true;
    }

    const remotePet = this.ecs.getComponent(remotePetEntity, RemotePet);
    if (remotePet) {
      remotePet.updateState(
        normalizedPetState.petId,
        normalizedPetState.petNickname,
        normalizedPetState.isActive
      );
    }

    const anchor = this.calculateRemotePetAnchor(ownerX, ownerY, ownerRotation, petDefinition);
    const hasNetworkPetPosition = Number.isFinite(Number(remotePetPosition?.x))
      && Number.isFinite(Number(remotePetPosition?.y));
    const targetX = hasNetworkPetPosition ? Number(remotePetPosition?.x) : anchor.x;
    const targetY = hasNetworkPetPosition ? Number(remotePetPosition?.y) : anchor.y;
    const targetRotation = Number.isFinite(Number(remotePetPosition?.rotation))
      ? Number(remotePetPosition?.rotation)
      : ownerRotation;
    // Use local receipt time to stabilize remote-pet interpolation timeline.
    const effectiveServerTime = Date.now();

    let interpolation = this.ecs.getComponent(remotePetEntity, InterpolationTarget);
    const transform = this.ecs.getComponent(remotePetEntity, Transform);
    if (transform && !interpolation) {
      this.ecs.addComponent(
        remotePetEntity,
        InterpolationTarget,
        new InterpolationTarget(transform.x, transform.y, transform.rotation)
      );
      interpolation = this.ecs.getComponent(remotePetEntity, InterpolationTarget);
    }

    if (hasNetworkPetPosition || createdRemotePetEntity) {
      if (interpolation) {
        interpolation.updateTarget(targetX, targetY, targetRotation, effectiveServerTime);
      } else if (transform) {
        transform.x = targetX;
        transform.y = targetY;
        transform.rotation = targetRotation;
      }
    }

    const currentSprite = this.ecs.getComponent(
      remotePetEntity,
      AnimatedSprite
    ) as (AnimatedSprite & { petId?: string }) | undefined;
    if (currentSprite?.petId === normalizedPetState.petId) {
      return;
    }

    const cachedSprite = this.getCachedRemotePetSprite(normalizedPetState.petId);
    if (cachedSprite) {
      this.applyRemotePetSprite(remotePetEntity, normalizedPetState.petId, cachedSprite);
      return;
    }

    this.loadRemotePetSprite(normalizedPetState.petId).then((loadedSprite) => {
      if (!loadedSprite) return;

      const currentEntity = this.findRemotePetEntity(ownerClientId);
      if (!currentEntity || currentEntity.id !== remotePetEntity.id) return;

      const currentRemotePet = this.ecs.getComponent(currentEntity, RemotePet);
      if (!currentRemotePet) return;

      if (currentRemotePet.petId !== normalizedPetState.petId) return;

      this.applyRemotePetSprite(currentEntity, normalizedPetState.petId, loadedSprite);
    });
  }

  updateRemotePlayerSkin(clientId: string, shipSkinId?: string | null): void {
    const entity = this.findRemotePlayerEntity(clientId);
    if (!entity) {
      return;
    }

    const resolvedSkinId = this.resolveRemoteShipSkinId(shipSkinId);
    const remotePlayer = this.ecs.getComponent(entity, RemotePlayer);
    if (remotePlayer) {
      remotePlayer.updateShipSkin(resolvedSkinId);
    }

    const cachedSprite = this.getCachedRemoteShipSprite(resolvedSkinId);
    if (cachedSprite) {
      this.applyRemoteShipSprite(entity, resolvedSkinId, cachedSprite);
      return;
    }

    if (!this.ecs.hasComponent(entity, AnimatedSprite) && this.sharedAnimatedSprite) {
      this.ecs.addComponent(entity, AnimatedSprite, this.sharedAnimatedSprite);
    }

    this.loadRemoteShipSprite(resolvedSkinId).then((loadedSprite) => {
      if (!loadedSprite) return;

      const currentEntity = this.findRemotePlayerEntity(clientId);
      if (!currentEntity || currentEntity.id !== entity.id) return;

      const currentRemotePlayer = this.ecs.getComponent(currentEntity, RemotePlayer);
      if (!currentRemotePlayer) return;

      const currentSkinId = this.resolveRemoteShipSkinId(currentRemotePlayer.shipSkinId);
      if (currentSkinId !== resolvedSkinId) return;

      this.applyRemoteShipSprite(currentEntity, resolvedSkinId, loadedSprite);
    });
  }


  update(_deltaTime: number): void {
    const now = Date.now();

    // 1. Pulizia player remoti "fantasma" (disconnessi o fuori sync)
    // Se non riceviamo update per > 5 secondi, rimuoviamo l'entità
    const remotePlayerEntities = this.ecs.getEntitiesWithComponents(RemotePlayer);
    for (const entity of remotePlayerEntities) {
      const remotePlayer = this.ecs.getComponent(entity, RemotePlayer);
      if (remotePlayer && (now - remotePlayer.lastSeen > 5000)) {
        this.removeRemotePlayer(remotePlayer.clientId);
      }
    }

    // 2. Gestisci orientamento dei remote player verso NPC selezionati
    this.faceSelectedNpcsForRemotePlayers();

    // I componenti Velocity vengono gestiti dal MovementSystem
  }

  /**
   * Trova l'entità di un giocatore remoto tramite clientId
   */
  public findRemotePlayerEntity(clientId: string): Entity | null {
    const remotePlayerEntities = this.ecs.getEntitiesWithComponents(RemotePlayer);

    for (const entity of remotePlayerEntities) {
      const remotePlayerComponent = this.ecs.getComponent(entity, RemotePlayer);
      // 🚀 FIX ROBUSTEZZA: Forza il confronto tra stringhe per evitare problemi tra number e string (clientId)
      if (remotePlayerComponent && remotePlayerComponent.clientId.toString() === clientId.toString()) {
        return entity;
      }
    }

    return null;
  }

  /**
   * Imposta info nickname e rank per un remote player
   */
  setRemotePlayerInfo(
    clientId: string,
    nickname: string,
    rank: string = 'Basic Space Pilot',
    leaderboardPodiumRank: number = 0,
    shipSkinId?: string | null
  ): void {
    const entity = this.findRemotePlayerEntity(clientId);
    if (entity) {
      const remotePlayerComponent = this.ecs.getComponent(entity, RemotePlayer);
      if (remotePlayerComponent) {
        remotePlayerComponent.updateInfo(nickname, rank, leaderboardPodiumRank);
      }
    }

    if (shipSkinId) {
      this.updateRemotePlayerSkin(clientId, shipSkinId);
    }
  }

  /**
   * Ottiene info di un remote player
   */
  getRemotePlayerInfo(clientId: string): { nickname: string, rank: string, leaderboardPodiumRank: number, shipSkinId: string } | undefined {
    const entity = this.findRemotePlayerEntity(clientId);
    if (entity) {
      const remotePlayerComponent = this.ecs.getComponent(entity, RemotePlayer);
      if (remotePlayerComponent) {
        return {
          nickname: remotePlayerComponent.nickname,
          rank: remotePlayerComponent.rank,
          leaderboardPodiumRank: Number(remotePlayerComponent.leaderboardPodiumRank || 0),
          shipSkinId: remotePlayerComponent.shipSkinId
        };
      }
    }
    return undefined;
  }

  /**
   * Aggiunge un nuovo giocatore remoto o aggiorna posizione se già esistente
   */
  addRemotePlayer(
    clientId: string,
    x: number,
    y: number,
    rotation: number = 0,
    health?: number,
    maxHealth?: number,
    shield?: number,
    maxShield?: number,
    serverTimestamp?: number,
    shipSkinId?: string | null,
    remotePetState?: RemotePetStatePayload | null,
    remotePetPosition?: RemotePetTransformPayload | null
  ): number {
    // Verifica se il giocatore remoto esiste già
    const existingEntity = this.findRemotePlayerEntity(clientId);
    if (existingEntity) {
      // Aggiorna posizione del giocatore esistente
      this.updateRemotePlayer(
        clientId,
        x,
        y,
        rotation,
        health,
        maxHealth,
        shield,
        maxShield,
        serverTimestamp,
        undefined,
        undefined,
        shipSkinId,
        remotePetState,
        remotePetPosition
      );

      // Update stats if provided
      if (health !== undefined || shield !== undefined) {
        this.updatePlayerStats(clientId, health || 0, maxHealth, shield || 0, maxShield);
      }

      return existingEntity.id;
    }

    // Usa EntityFactory per creare il remote player
    const resolvedSkinId = this.resolveRemoteShipSkinId(shipSkinId);
    const initialRemoteSprite = this.getCachedRemoteShipSprite(resolvedSkinId) || this.sharedAnimatedSprite;
    let entity;
    try {
      entity = this.entityFactory.createRemotePlayer({
        clientId,
        shipSkinId: resolvedSkinId,
        position: {
          x,
          y,
          rotation
        },
        animatedSprite: initialRemoteSprite,
        combat: {
          health: {
            current: health !== undefined ? health : 100,
            max: maxHealth !== undefined ? maxHealth : 100
          },
          shield: {
            current: shield !== undefined ? shield : 50,
            max: maxShield !== undefined ? maxShield : 50
          },
          damage: { value: 50, range: 30, cooldown: 100 } // Valori base per giocatori remoti
        },
        interpolation: true // Abilita interpolazione per movimento fluido
      });
    } catch (error) {
      console.error(`[REMOTE_PLAYER] Failed to create remote player ${clientId}: ${(error as Error).message}`);
      // Se l'entità è stata creata parzialmente dalla factory prima dell'errore, rimuovila
      // Nota: findRemotePlayerEntity cerca il componente RemotePlayer, che non è ancora stato aggiunto.
      // Dobbiamo quindi essere sicuri di non lasciare l'ultima entità creata nell'ECS se è orfana.
      return -1;
    }

    this.updateRemotePlayerSkin(clientId, resolvedSkinId);
    this.ensureRemotePetForPlayer(clientId, x, y, rotation, serverTimestamp, remotePetState, remotePetPosition);
    return entity.id;
  }

  /**
   * Aggiorna posizione e rotazione di un giocatore remoto esistente
   */
  updateRemotePlayer(
    clientId: string,
    x: number,
    y: number,
    rotation: number = 0,
    health?: number,
    maxHealth?: number,
    shield?: number,
    maxShield?: number,
    serverTimestamp?: number,
    velocityX?: number,
    velocityY?: number,
    shipSkinId?: string | null,
    remotePetState?: RemotePetStatePayload | null,
    remotePetPosition?: RemotePetTransformPayload | null
  ): void {
    const entity = this.findRemotePlayerEntity(clientId);
    if (!entity) {
      // Player remoto non trovato - potrebbe essere normale se non ancora creato
      // Non logghiamo errori per evitare spam, il sistema si autorecupera
      return;
    }

    // Aggiorna solo target e timestamp di attività
    const interpolation = this.ecs.getComponent(entity, InterpolationTarget);
    const remotePlayer = this.ecs.getComponent(entity, RemotePlayer);

    if (remotePlayer) {
      remotePlayer.lastSeen = Date.now();
    }

    if (interpolation) {
      // AGGIORNA SOLO TARGET - Componente rimane PERSISTENTE
      // FIX: Il server invia Date.now() direttamente, NON un numero di tick.
      // La vecchia riga `* 50` causava un errore di scala temporale di 50x.
      const serverTime = serverTimestamp || Date.now();

      // Passa anche velocità per extrapolazione più precisa (Hermite)
      interpolation.updateTarget(x, y, rotation, serverTime, velocityX, velocityY);
    } else {
      console.warn(`[REMOTE_PLAYER] No interpolation component found for ${clientId} entity ${entity.id}`);
    }

    // Aggiorna anche le statistiche se fornite (per sync in tempo reale)
    if (health !== undefined || shield !== undefined) {
      this.updatePlayerStats(clientId, health || 0, maxHealth, shield || 0, maxShield);
    }

    if (shipSkinId) {
      this.updateRemotePlayerSkin(clientId, shipSkinId);
    }

    if (remotePetState !== undefined || remotePetPosition !== undefined) {
      this.ensureRemotePetForPlayer(clientId, x, y, rotation, serverTimestamp, remotePetState, remotePetPosition);
    }
  }

  /**
   * Rimuove un giocatore remoto
   */
  removeRemotePlayer(clientId: string): void {
    this.removeRemotePetEntity(clientId);
    const entity = this.findRemotePlayerEntity(clientId);
    if (entity) {
      this.ecs.removeEntity(entity);
    }
  }

  /**
   * Rimuove tutti i giocatori remoti
   */
  removeAllRemotePlayers(): void {
    this.remotePetEntityByClientId.clear();
    const remotePlayerEntities = this.ecs.getEntitiesWithComponents(RemotePlayer);
    const remotePetEntities = this.ecs.getEntitiesWithComponents(RemotePet);

    for (const entity of remotePlayerEntities) {
      const remotePlayerComponent = this.ecs.getComponent(entity, RemotePlayer);
      if (remotePlayerComponent) {
        this.ecs.removeEntity(entity);
      }
    }

    for (const entity of remotePetEntities) {
      this.ecs.removeEntity(entity);
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
  getRemotePlayerPositions(): Array<{ x: number, y: number }> {
    const positions: Array<{ x: number, y: number }> = [];
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
   * IMPORTANTE: Usa snapTo() per respawn, che resetta il buffer e forza la posizione.
   */
  updatePlayerPosition(clientId: string, x: number, y: number, rotation: number = 0): void {
    const entity = this.findRemotePlayerEntity(clientId);
    if (!entity) {
      console.warn(`[REMOTE_PLAYER] Cannot update position for unknown player ${clientId}`);
      return;
    }

    const interpolation = this.ecs.getComponent(entity, InterpolationTarget);
    if (interpolation) {
      // Forza la posizione immediatamente per il respawn usando snapTo()
      // Questo resetta il buffer e imposta sia renderX/Y che il primo snapshot.
      // NON scrivere direttamente su Transform - è gestito da InterpolationSystem.render().
      interpolation.snapTo(x, y, rotation);
    }
  }

  /**
   * Aggiorna le statistiche di salute e scudo di un giocatore remoto
   */
  updatePlayerStats(clientId: string, health: number, maxHealth: number | undefined, shield: number, maxShield: number | undefined): void {
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
