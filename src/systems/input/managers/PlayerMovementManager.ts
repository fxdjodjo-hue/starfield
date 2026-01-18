import type { ECS } from '../../../infrastructure/ecs/ECS';
import type { Camera } from '../../../entities/spatial/Camera';
import { Transform } from '../../../entities/spatial/Transform';
import { Velocity } from '../../../entities/spatial/Velocity';
import { DisplayManager } from '../../../infrastructure/display';
import { getPlayerDefinition } from '../../../config/PlayerConfig';
import { PlayerUpgrades } from '../../../entities/player/PlayerUpgrades';
import { MathUtils } from '../../../core/utils/MathUtils';

/**
 * Manages player movement (mouse, keyboard, minimap)
 */
export class PlayerMovementManager {
  private minimapTargetX: number | null = null;
  private minimapTargetY: number | null = null;
  private onMinimapMovementComplete?: () => void;

  constructor(
    private readonly ecs: ECS,
    private readonly getPlayerEntity: () => any | null,
    private readonly getCamera: () => Camera | null,
    private readonly getIsMousePressed: () => boolean,
    private readonly getLastMouseX: () => number,
    private readonly getLastMouseY: () => number,
    private readonly getKeysPressed: () => Set<string>,
    private readonly setIsMousePressed: (pressed: boolean) => void
  ) {}

  /**
   * Sets minimap movement complete callback
   */
  setMinimapMovementCompleteCallback(callback: () => void): void {
    this.onMinimapMovementComplete = callback;
  }

  /**
   * Moves player to a world position (used for minimap click-to-move)
   */
  movePlayerTo(worldX: number, worldY: number): void {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return;

    this.minimapTargetX = worldX;
    this.minimapTargetY = worldY;
    this.setIsMousePressed(false);
  }

  /**
   * Moves player towards minimap target
   */
  movePlayerTowardsMinimapTarget(): void {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity || this.minimapTargetX === null || this.minimapTargetY === null) return;

    const transform = this.ecs.getComponent(playerEntity, Transform);
    const velocity = this.ecs.getComponent(playerEntity, Velocity);

    if (!transform || !velocity) return;

    const { distance } = MathUtils.calculateDirection(
      this.minimapTargetX, this.minimapTargetY,
      transform.x, transform.y
    );

    if (distance > 50) {
      const dirX = dx / distance;
      const dirY = dy / distance;

      velocity.setVelocity(dirX * this.getPlayerSpeed(), dirY * this.getPlayerSpeed());

      const angle = Math.atan2(dirY, dirX);
      transform.rotation = angle;
    } else {
      velocity.stop();
      this.minimapTargetX = null;
      this.minimapTargetY = null;

      if (this.onMinimapMovementComplete) {
        this.onMinimapMovementComplete();
      }
    }
  }

  /**
   * Moves player towards mouse position
   */
  movePlayerTowardsMouse(): void {
    const playerEntity = this.getPlayerEntity();
    const camera = this.getCamera();
    if (!playerEntity || !camera) return;

    const transform = this.ecs.getComponent(playerEntity, Transform);
    const velocity = this.ecs.getComponent(playerEntity, Velocity);

    if (!transform || !velocity) return;

    const { width, height } = DisplayManager.getInstance().getLogicalSize();
    const worldMousePos = camera.screenToWorld(this.getLastMouseX(), this.getLastMouseY(), width, height);
    const worldMouseX = worldMousePos.x;
    const worldMouseY = worldMousePos.y;

    const { distance } = MathUtils.calculateDirection(
      worldMouseX, worldMouseY,
      transform.x, transform.y
    );

    if (distance > 10) {
      const dirX = dx / distance;
      const dirY = dy / distance;

      velocity.setVelocity(dirX * this.getPlayerSpeed(), dirY * this.getPlayerSpeed());

      const angle = Math.atan2(dirY, dirX);
      transform.rotation = angle;
    } else {
      velocity.stop();
      this.setIsMousePressed(false);
    }
  }

  /**
   * Moves player with keyboard (WASD)
   */
  movePlayerWithKeyboard(): void {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return;

    const velocity = this.ecs.getComponent(playerEntity, Velocity);
    if (!velocity) return;

    const speed = this.getPlayerSpeed();
    let vx = 0;
    let vy = 0;

    const keysPressed = this.getKeysPressed();
    if (keysPressed.has('w')) vy -= 1;
    if (keysPressed.has('s')) vy += 1;
    if (keysPressed.has('a')) vx -= 1;
    if (keysPressed.has('d')) vx += 1;

    if (vx !== 0 && vy !== 0) {
      const length = Math.sqrt(vx * vx + vy * vy);
      vx /= length;
      vy /= length;
    }

    velocity.setVelocity(vx * speed, vy * speed);

    if (vx !== 0 || vy !== 0) {
      const angle = Math.atan2(vy, vx);
      const transform = this.ecs.getComponent(playerEntity, Transform);
      if (transform) {
        transform.rotation = angle;
      }
    }
  }

  /**
   * Stops player movement
   */
  stopPlayerMovement(): void {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return;

    const velocity = this.ecs.getComponent(playerEntity, Velocity);
    if (velocity) {
      velocity.stop();
    }
  }

  /**
   * Gets player speed calculated with upgrade bonuses
   */
  private getPlayerSpeed(): number {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return 300;

    const playerDef = getPlayerDefinition();
    const playerUpgrades = this.ecs.getComponent(playerEntity, PlayerUpgrades);

    if (playerUpgrades) {
      const speedBonus = playerUpgrades.getSpeedBonus();
      return Math.floor(playerDef.stats.speed * speedBonus);
    }

    return playerDef.stats.speed;
  }

  /**
   * Checks if minimap target is set
   */
  hasMinimapTarget(): boolean {
    return this.minimapTargetX !== null && this.minimapTargetY !== null;
  }

  /**
   * Clears minimap target
   */
  clearMinimapTarget(): void {
    this.minimapTargetX = null;
    this.minimapTargetY = null;
  }
}
