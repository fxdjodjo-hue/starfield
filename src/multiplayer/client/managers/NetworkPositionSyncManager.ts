import { ECS } from '../../../infrastructure/ecs/ECS';
import { Transform } from '../../../entities/spatial/Transform';
import { Velocity } from '../../../entities/spatial/Velocity';
import { Authority } from '../../../entities/spatial/Authority';
import { Health } from '../../../entities/combat/Health';
import { Pet } from '../../../entities/player/Pet';
import { RemotePet } from '../../../entities/player/RemotePet';
import { LocalPetServerState } from '../../../entities/player/LocalPetServerState';
import { NetworkConnectionManager } from './NetworkConnectionManager';
import { RateLimiter, RATE_LIMITS } from './RateLimiter';
import { NetworkTickManager } from './NetworkTickManager';
import { PlayerPositionTracker } from './PlayerPositionTracker';
import { NETWORK_CONFIG, MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * NetworkPositionSyncManager - Sincronizzazione posizione player, validazione, rate limiting
 * Estratto da ClientNetworkSystem per Separation of Concerns
 */
export class NetworkPositionSyncManager {
  private lastInvalidPositionLog = 0;
  private hasReceivedWelcome = false;
  private pendingPosition: { x: number; y: number; rotation: number } | null = null;

  constructor(
    private readonly ecs: ECS | null,
    private readonly connectionManager: NetworkConnectionManager,
    private readonly rateLimiter: RateLimiter,
    private readonly tickManager: NetworkTickManager,
    private readonly positionTracker: PlayerPositionTracker,
    public clientId: string,
    private readonly isClientReady?: () => boolean
  ) { }


  /**
   * Gets the pending position (accumulated before welcome)
   */
  getPendingPosition(): { x: number; y: number; rotation: number } | null {
    return this.pendingPosition;
  }

  /**
   * Clears the pending position
   */
  clearPendingPosition(): void {
    this.pendingPosition = null;
  }

  /**
   * Gets whether welcome message has been received
   */
  getHasReceivedWelcome(): boolean {
    return this.hasReceivedWelcome;
  }

  /**
   * Gets the current local player position using the position tracker
   */
  getLocalPlayerPosition(): { x: number; y: number; rotation: number } {
    return this.positionTracker.getLocalPlayerPosition();
  }

  /**
   * Gets the current player velocity for extrapolation
   */
  getCurrentPlayerVelocity(): { x: number; y: number } {
    try {
      if (!this.ecs) {
        console.warn('[CLIENT] ECS not initialized in getCurrentPlayerVelocity');
        return { x: 0, y: 0 };
      }

      // Find player entity by Authority component with our client ID
      const playerEntity = this.ecs.getEntitiesWithComponents(Transform, Velocity, Authority)
        .find(entity => {
          const authority = this.ecs!.getComponent(entity, Authority);
          return authority && String(authority.ownerId) === String(this.clientId);
        });

      if (playerEntity) {
        const velocity = this.ecs!.getComponent(playerEntity, Velocity);
        if (velocity) {
          return { x: velocity.x, y: velocity.y };
        }
      }
    } catch (error) {
      console.warn('[CLIENT] Error getting player velocity:', error);
    }

    return { x: 0, y: 0 }; // Fallback
  }

  /**
   * Gets the current local pet position for remote synchronization.
   */
  getLocalPetPosition(): { x: number; y: number; rotation: number } | null {
    try {
      if (!this.ecs) {
        return null;
      }

      const petEntity = this.ecs.getEntitiesWithComponents(Pet, Transform)
        .find((entity) => !this.ecs!.hasComponent(entity, RemotePet));

      if (!petEntity) {
        return null;
      }

      const petComponent = this.ecs.getComponent(petEntity, Pet);
      if (petComponent && petComponent.isActive === false) {
        return null;
      }

      const petTransform = this.ecs.getComponent(petEntity, Transform);
      if (!petTransform) {
        return null;
      }

      let normalizedPetRotation = Number.isFinite(petTransform.rotation) ? petTransform.rotation : 0;
      while (normalizedPetRotation > Math.PI) normalizedPetRotation -= 2 * Math.PI;
      while (normalizedPetRotation < -Math.PI) normalizedPetRotation += 2 * Math.PI;

      return {
        x: petTransform.x,
        y: petTransform.y,
        rotation: normalizedPetRotation
      };
    } catch {
      return null;
    }
  }

  /**
   * Synchronizes the player position to the server (called by tick manager)
   */
  sendPlayerPosition(position: { x: number; y: number; rotation: number }): void {
    if (!this.connectionManager.isConnectionActive()) return;

    // 🔴 CRITICAL: Non mandare position updates se il giocatore è morto
    if (this.isPlayerDead()) {
      return; // Non inviare aggiornamenti se morto
    }

    // 🔴 CRITICAL: Non mandare position updates finché non riceviamo il welcome e il clientId persistente
    if (this.isClientReady && !this.isClientReady()) {
      // Accumula la posizione per quando il client sarà pronto
      this.pendingPosition = position;
      return;
    }

    // ✅ FIX: Normalizza la rotazione PRIMA della validazione e invio
    let normalizedRotation = position.rotation;
    while (normalizedRotation > Math.PI) normalizedRotation -= 2 * Math.PI;
    while (normalizedRotation < -Math.PI) normalizedRotation += 2 * Math.PI;

    // OTTIENI VELOCITÀ DAL PLAYER (per extrapolation client-side)
    const velocity = this.getCurrentPlayerVelocity();

    const normalizedPosition = {
      x: position.x,
      y: position.y,
      rotation: normalizedRotation,
      velocityX: velocity.x,
      velocityY: velocity.y
    };

    // RATE LIMITING: Controlla se possiamo inviare aggiornamenti posizione
    if (!this.rateLimiter.canSend('position_update', RATE_LIMITS.POSITION_UPDATE.maxRequests, RATE_LIMITS.POSITION_UPDATE.windowMs)) {
      // Rate limit superato - salta questo aggiornamento per ridurre carico server
      return;
    }

    // CLIENT VALIDATION: usa fallback per dati invalidi
    if (!this.isValidPosition(normalizedPosition)) {
      if (Date.now() - this.lastInvalidPositionLog > 10000) {
        console.warn('[CLIENT] Invalid position data, using fallback:', {
          invalidData: normalizedPosition,
          clientId: this.clientId,
          timestamp: new Date().toISOString()
        });
        this.lastInvalidPositionLog = Date.now();
      }

      // Use safer fallback values instead of hardcoded zeros
      // Use network config fallback position for consistency
      normalizedPosition.x = NETWORK_CONFIG.FALLBACK_POSITION.x;
      normalizedPosition.y = NETWORK_CONFIG.FALLBACK_POSITION.y;
      normalizedPosition.rotation = NETWORK_CONFIG.FALLBACK_POSITION.rotation;
      normalizedPosition.velocityX = 0; // Always reset velocity on invalid data
      normalizedPosition.velocityY = 0;

      // TODO: Consider disconnecting client after multiple consecutive invalid messages
      // This could indicate cheating or serious client-side issues
    }

    this.connectionManager.send(JSON.stringify({
      type: MESSAGE_TYPES.POSITION_UPDATE,
      clientId: this.clientId,
      x: normalizedPosition.x,
      y: normalizedPosition.y,
      rotation: normalizedPosition.rotation,
      velocityX: normalizedPosition.velocityX,
      velocityY: normalizedPosition.velocityY,
      tick: this.tickManager.getTickCounter(),
      t: Date.now() // Client timestamp for accurate interpolation timing
    }));
  }

  /**
   * Stores authoritative local-pet samples from server acknowledgments.
   * LocalPetFollowSystem consumes these samples for soft reconciliation.
   */
  handlePositionAck(message: {
    [key: string]: unknown;
    petPosition?: { x?: number; y?: number; rotation?: number; isAttacking?: boolean; isCollecting?: boolean } | null;
    petServerTime?: number;
    serverTime?: number;
    t?: number;
  }): void {
    try {
      if (!this.ecs) return;

      const petPosition = message?.petPosition;
      if (!petPosition || typeof petPosition !== 'object') return;

      const x = Number(petPosition.x);
      const y = Number(petPosition.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      const isAttacking = !!petPosition.isAttacking;
      const isCollecting = !!petPosition.isCollecting;

      let rotation = Number(petPosition.rotation);
      if (!Number.isFinite(rotation)) rotation = 0;
      while (rotation > Math.PI) rotation -= 2 * Math.PI;
      while (rotation < -Math.PI) rotation += 2 * Math.PI;
      const serverTime = Number.isFinite(Number(message?.petServerTime))
        ? Number(message.petServerTime)
        : (
          Number.isFinite(Number(message?.serverTime))
            ? Number(message.serverTime)
            : (Number.isFinite(Number(message?.t)) ? Number(message.t) : Date.now())
        );

      const petEntity = this.ecs.getEntitiesWithComponents(Pet, Transform)
        .find((entity) => !this.ecs!.hasComponent(entity, RemotePet));
      if (!petEntity) return;

      const petTransform = this.ecs.getComponent(petEntity, Transform);
      if (!petTransform) return;

      let serverState = this.ecs.getComponent(petEntity, LocalPetServerState);
      if (!serverState) {
        this.ecs.addComponent(
          petEntity,
          LocalPetServerState,
          new LocalPetServerState(
            petTransform.x,
            petTransform.y,
            petTransform.rotation,
            isAttacking,
            isCollecting,
            serverTime,
            Date.now()
          )
        );
        serverState = this.ecs.getComponent(petEntity, LocalPetServerState);
      }

      if (serverState) {
        serverState.updateFromServer(x, y, rotation, isAttacking, isCollecting, serverTime, Date.now());
      }
    } catch {
      // Best-effort sync; ignore malformed acknowledgments.
    }
  }

  /**
   * Valida che la posizione sia valida prima dell'invio
   */
  private isValidPosition(pos: {
    x: number;
    y: number;
    rotation: number;
    velocityX?: number;
    velocityY?: number;
  }): boolean {
    // Normalizza la rotation per accettare valori non normalizzati
    let normalizedRotation = pos.rotation;
    while (normalizedRotation > Math.PI) normalizedRotation -= 2 * Math.PI;
    while (normalizedRotation < -Math.PI) normalizedRotation += 2 * Math.PI;

    const velocityX = pos.velocityX ?? 0;
    const velocityY = pos.velocityY ?? 0;

    const playerPositionValid = Number.isFinite(pos.x) &&
      Number.isFinite(pos.y) &&
      Number.isFinite(pos.rotation) &&
      Number.isFinite(velocityX) &&
      Number.isFinite(velocityY) &&
      pos.x >= -15000 && pos.x <= 15000 && // Tighter position bounds for space game
      pos.y >= -15000 && pos.y <= 15000 && // Reasonable space area
      normalizedRotation >= -Math.PI && normalizedRotation <= Math.PI &&
      velocityX >= -500 && velocityX <= 500 && // Reasonable max speed for space ship
      velocityY >= -500 && velocityY <= 500;   // Prevents speed hacking

    return playerPositionValid;
  }

  /**
   * Controlla se il giocatore locale è morto
   */
  private isPlayerDead(): boolean {
    try {
      if (!this.ecs) {
        return false; // Se non abbiamo ECS, assumiamo che non sia morto
      }

      // Trova l'entità del giocatore locale - metodo più semplice
      const entitiesWithHealth = this.ecs.getEntitiesWithComponents(Health);

      for (const entity of entitiesWithHealth) {
        // Controlla se ha Authority con il nostro clientId
        const authority = this.ecs.getComponent(entity, Authority);
        if (authority && String(authority.ownerId) === String(this.clientId)) {
          const health = this.ecs.getComponent(entity, Health);
          if (health && health.isDead()) {
            // console.log(`[CLIENT] Player ${this.clientId} is dead (HP: ${health.current}/${health.max})`);
            return true;
          }
        }
      }


    } catch (error) {
      console.warn('[CLIENT] Error checking if player is dead:', error);
    }

    return false;
  }
}
