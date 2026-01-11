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
  handleUpdate(clientId: string, position: any, rotation: number, nickname?: string, rank?: string): void {
    if (!this.remotePlayerSystem.isRemotePlayer(clientId)) {
      // Create new remote player
      this.createRemotePlayer(clientId, position.x, position.y, rotation || 0);
      // Set info if provided
      if (nickname) {
        this.setPlayerInfo(clientId, nickname, rank || 'Recruit');
      }
    } else {
      // Update existing remote player
      this.updateRemotePlayer(clientId, position.x, position.y, rotation || 0);
      // Update info if provided
      if (nickname) {
        this.setPlayerInfo(clientId, nickname, rank || 'Recruit');
      }
    }
  }

  /**
   * Creates a new remote player entity
   */
  private createRemotePlayer(clientId: string, x: number, y: number, rotation: number): void {
    this.remotePlayerSystem.addRemotePlayer(clientId, x, y, rotation);
  }

  /**
   * Updates an existing remote player position
   */
  private updateRemotePlayer(clientId: string, x: number, y: number, rotation: number): void {
    this.remotePlayerSystem.updateRemotePlayer(clientId, x, y, rotation);
  }

  /**
   * Sets nickname and rank info for a remote player
   */
  setPlayerInfo(clientId: string, nickname: string, rank: string): void {
    this.remotePlayerSystem.setRemotePlayerInfo(clientId, nickname, rank);
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
    // This would need to be implemented in RemotePlayerSystem
    // For now, return 0
    return 0;
  }
}
