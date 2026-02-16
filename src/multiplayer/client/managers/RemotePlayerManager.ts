import { ECS } from '../../../infrastructure/ecs/ECS';
import { Transform } from '../../../entities/spatial/Transform';
import { Velocity } from '../../../entities/spatial/Velocity';
import { Health } from '../../../entities/combat/Health';
import { Sprite } from '../../../entities/Sprite';
import { RemotePlayerSystem } from '../../../systems/multiplayer/RemotePlayerSystem';

/**
 * Manages remote player entities
 * Handles creation, updates, and removal of remote players
 */
export class RemotePlayerManager {
  private readonly ecs: ECS;
  private readonly remotePlayerSystem: RemotePlayerSystem;

  constructor(ecs: ECS, remotePlayerSystem: RemotePlayerSystem) {
    this.ecs = ecs;
    this.remotePlayerSystem = remotePlayerSystem;
  }
  /**
   * Handles remote player update
   * Creates new remote player if doesn't exist, otherwise updates existing one
   */
  handleUpdate(
    clientId: string,
    position: { x: number; y: number; velocityX?: number; velocityY?: number },
    rotation: number = 0,
    health?: number,
    maxHealth?: number,
    shield?: number,
    maxShield?: number,
    nickname?: string,
    rank?: string,
    leaderboardPodiumRank?: number,
    serverTick?: number,
    shipSkinId?: string
  ): void {
    if (!this.remotePlayerSystem.isRemotePlayer(clientId)) {
      // Create new remote player
      this.remotePlayerSystem.addRemotePlayer(
        clientId,
        position.x,
        position.y,
        rotation,
        health,
        maxHealth,
        shield,
        maxShield,
        serverTick,
        shipSkinId
      );
      // Set info if provided
      if (nickname) {
        this.setPlayerInfo(clientId, nickname, rank || 'Recruit', Number(leaderboardPodiumRank || 0), shipSkinId);
      }
    } else {
      // Update existing remote player with velocity for better extrapolation
      this.remotePlayerSystem.updateRemotePlayer(
        clientId,
        position.x,
        position.y,
        rotation,
        health,
        maxHealth,
        shield,
        maxShield,
        serverTick,
        position.velocityX,
        position.velocityY,
        shipSkinId
      );
    }

    // Update stats if provided (legacy call, kept for robustness)
    if (health !== undefined || shield !== undefined) {
      this.remotePlayerSystem.updatePlayerStats(clientId, health || 0, maxHealth, shield || 0, maxShield);
    }
  }

  /**
   * Sets nickname and rank info for a remote player
   */
  setPlayerInfo(clientId: string, nickname: string, rank: string, leaderboardPodiumRank: number = 0, shipSkinId?: string): void {
    this.remotePlayerSystem.setRemotePlayerInfo(clientId, nickname, rank, leaderboardPodiumRank, shipSkinId);
  }

  /**
   * Removes a remote player from the game
   */
  removePlayer(clientId: string): void {
    this.remotePlayerSystem.removeRemotePlayer(clientId);
  }

  /**
   * Checks if a player is a remote player
   */
  isRemotePlayer(clientId: string): boolean {
    return this.remotePlayerSystem.isRemotePlayer(clientId);
  }

  /**
   * Gets the number of remote players
   */
  getRemotePlayerCount(): number {
    return this.remotePlayerSystem.getRemotePlayerCount();
  }
}
