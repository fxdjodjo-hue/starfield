import { ECS } from '../../../infrastructure/ecs/ECS';
import { Transform } from '../../../entities/spatial/Transform';
import { Velocity } from '../../../entities/spatial/Velocity';
import { Authority } from '../../../entities/spatial/Authority';
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
  ) {}


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
          return authority && authority.ownerId === this.clientId;
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
   * Synchronizes the player position to the server (called by tick manager)
   */
  sendPlayerPosition(position: { x: number; y: number; rotation: number }): void {
    if (!this.connectionManager.isConnectionActive()) return;

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
      rotation: normalizedRotation, // Ora usa la rotazione normalizzata
      velocityX: normalizedPosition.velocityX,
      velocityY: normalizedPosition.velocityY,
      tick: this.tickManager.getTickCounter()
    }));
  }

  /**
   * Valida che la posizione sia valida prima dell'invio
   */
  private isValidPosition(pos: { x: number; y: number; rotation: number; velocityX?: number; velocityY?: number }): boolean {
    // Normalizza la rotation per accettare valori non normalizzati
    let normalizedRotation = pos.rotation;
    while (normalizedRotation > Math.PI) normalizedRotation -= 2 * Math.PI;
    while (normalizedRotation < -Math.PI) normalizedRotation += 2 * Math.PI;

    const velocityX = pos.velocityX ?? 0;
    const velocityY = pos.velocityY ?? 0;

    return Number.isFinite(pos.x) &&
           Number.isFinite(pos.y) &&
           Number.isFinite(pos.rotation) &&
           Number.isFinite(velocityX) &&
           Number.isFinite(velocityY) &&
           pos.x >= -15000 && pos.x <= 15000 && // Tighter position bounds for space game
           pos.y >= -15000 && pos.y <= 15000 && // Reasonable space area
           normalizedRotation >= -Math.PI && normalizedRotation <= Math.PI &&
           velocityX >= -500 && velocityX <= 500 && // Reasonable max speed for space ship
           velocityY >= -500 && velocityY <= 500;   // Prevents speed hacking
  }
}
