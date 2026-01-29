import type { ECS } from '../../../infrastructure/ecs/ECS';
import type { Camera } from '../../../entities/spatial/Camera';
import { Transform } from '../../../entities/spatial/Transform';
import { Velocity } from '../../../entities/spatial/Velocity';
import { DisplayManager } from '../../../infrastructure/display';
import { getPlayerDefinition } from '../../../config/PlayerConfig';
import { PlayerUpgrades } from '../../../entities/player/PlayerUpgrades';
import { Inventory } from '../../../entities/player/Inventory';
import { MathUtils } from '../../../core/utils/MathUtils';
import gameConfig from '../../../config/gameConfig.json';

/**
 * Manages player movement (mouse, keyboard, minimap)
 */
export class PlayerMovementManager {
  private minimapTargetX: number | null = null;
  private minimapTargetY: number | null = null;
  private onMinimapMovementComplete?: () => void;
  private faceTargetX: number | null = null;
  private faceTargetY: number | null = null;

  private isAttackActivated: () => boolean = () => false;

  constructor(
    private readonly ecs: ECS,
    private readonly getPlayerEntity: () => any | null,
    private readonly getCamera: () => Camera | null,
    private readonly getIsMousePressed: () => boolean,
    private readonly getLastMouseX: () => number,
    private readonly getLastMouseY: () => number,
    private readonly getKeysPressed: () => Set<string>,
    private readonly setIsMousePressed: (pressed: boolean) => void
  ) { }

  /**
   * Imposta il callback per sapere se l'attacco è attivo
   */
  setAttackActivatedCallback(callback: () => boolean): void {
    this.isAttackActivated = callback;
  }


  /**
   * Sets minimap movement complete callback
   */
  setMinimapMovementCompleteCallback(callback: () => void): void {
    this.onMinimapMovementComplete = callback;
  }

  /**
   * Imposta un punto target verso cui la nave deve "guardare" (ruotare)
   * Questo è generico e può essere usato per NPC, punti di interesse, ecc.
   */
  setFaceTarget(x: number, y: number): void {
    this.faceTargetX = x;
    this.faceTargetY = y;
  }

  /**
   * Rimuove il target di face-up
   */
  clearFaceTarget(): void {
    this.faceTargetX = null;
    this.faceTargetY = null;
  }

  /**
   * Helper to smoothly rotate entity towards target angle
   */
  private smoothRotate(transform: Transform, targetAngle: number, deltaTime: number): void {
    const playerDef = getPlayerDefinition();
    const rotationSpeed = playerDef.rotationSpeed || 5; // Default to 5 from config if missing

    // Calculate t for lerp based on time and speed
    // factor = 1 - e^(-speed * dt) gives framerate independent smoothing
    // or simple linear interpolation: t = speed * dt
    const t = rotationSpeed * (deltaTime / 1000);

    transform.rotation = MathUtils.lerpAngle(transform.rotation, targetAngle, t);

    // Snap to target if very close to avoid asymptotic drift
    if (Math.abs(MathUtils.angleDifference(transform.rotation, targetAngle)) < 0.05) {
      transform.rotation = targetAngle;
    }
  }

  /**
   * Ruota la nave verso il target impostato (se presente)
   */
  faceTowardsTarget(deltaTime: number): void {
    if (this.faceTargetX === null || this.faceTargetY === null) return;

    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return;

    const transform = this.ecs.getComponent(playerEntity, Transform);
    if (!transform) return;

    const angle = Math.atan2(this.faceTargetY - transform.y, this.faceTargetX - transform.x);
    this.smoothRotate(transform, angle, deltaTime);
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
   * Applies velocity change using Exponential Smoothing (Damping)
   * This provides a "snappy but smooth" feel: swift initial response, smooth settling.
   * Eliminates "strange arcs" (Polar) and "rubbery" feel (Linear).
   */
  private applyVelocityChange(velocity: Velocity, targetVx: number, targetVy: number, deltaTime: number): void {
    const dt = deltaTime / 1000;

    // Choose sharpness based on whether we are accelerating (input) or Stopping
    // Check if we have an active target velocity (Moving) or zero (Stopping)
    const isMoving = Math.abs(targetVx) > 0.1 || Math.abs(targetVy) > 0.1;

    let sharpness = 5.0; // Default fallback
    const maxSpeed = this.getPlayerSpeed(); // Use actual current max speed (with upgrades)

    if (maxSpeed > 0) {
      if (isMoving) {
        // Accelerating / Turning
        // Interpret config "Acceleration" as response speed scaling
        sharpness = gameConfig.gameplay.player.acceleration / maxSpeed;
        sharpness *= 1.5;
      } else {
        // Decelerating
        sharpness = gameConfig.gameplay.player.deceleration / maxSpeed;
        sharpness *= 1.5;
      }
    }

    // Apply Damping (Frame-rate independent lerp)
    const blend = 1.0 - Math.exp(-sharpness * dt);

    velocity.x = velocity.x + (targetVx - velocity.x) * blend;
    velocity.y = velocity.y + (targetVy - velocity.y) * blend;

    // Clean zeroing to prevent micro-drift
    if (Math.abs(velocity.x) < 1) velocity.x = 0;
    if (Math.abs(velocity.y) < 1) velocity.y = 0;
  }

  /**
   * Moves player towards minimap target
   */
  movePlayerTowardsMinimapTarget(deltaTime: number): void {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity || this.minimapTargetX === null || this.minimapTargetY === null) return;

    const transform = this.ecs.getComponent(playerEntity, Transform);
    const velocity = this.ecs.getComponent(playerEntity, Velocity);

    if (!transform || !velocity) return;

    const { direction, distance } = MathUtils.calculateDirection(
      transform.x, transform.y,
      this.minimapTargetX, this.minimapTargetY
    );

    if (distance > 80) {
      const dirX = direction.x;
      const dirY = direction.y;
      const speed = this.getPlayerSpeed();

      this.applyVelocityChange(velocity, dirX * speed, dirY * speed, deltaTime);

      // Imposta rotazione solo se non siamo in combattimento attivo
      if (!this.isAttackActivated()) {
        const angle = Math.atan2(dirY, dirX);
        this.smoothRotate(transform, angle, deltaTime);
      }
    } else {
      this.stopPlayerMovement(deltaTime);
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
  movePlayerTowardsMouse(deltaTime: number): void {
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

    const { direction, distance } = MathUtils.calculateDirection(
      transform.x, transform.y,
      worldMouseX, worldMouseY
    );

    // Keep moving if distance > 80, otherwise stop
    if (distance > 80) {
      const dirX = direction.x;
      const dirY = direction.y;
      const speed = this.getPlayerSpeed();

      this.applyVelocityChange(velocity, dirX * speed, dirY * speed, deltaTime);

      // Imposta rotazione solo se non siamo in combattimento attivo
      if (!this.isAttackActivated()) {
        const angle = Math.atan2(dirY, dirX);
        this.smoothRotate(transform, angle, deltaTime);
      }
    } else {
      this.stopPlayerMovement(deltaTime);
      // Don't unpress mouse automatically here, as dragging might continue
    }
  }

  /**
   * Moves player with keyboard (WASD)
   */
  movePlayerWithKeyboard(deltaTime: number): void {
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

    // Apply acceleration towards input direction
    this.applyVelocityChange(velocity, vx * speed, vy * speed, deltaTime);

    if (vx !== 0 || vy !== 0) {
      // Imposta rotazione solo se non siamo in combattimento attivo
      if (!this.isAttackActivated()) {
        const angle = Math.atan2(vy, vx);
        const transform = this.ecs.getComponent(playerEntity, Transform);
        if (transform) {
          this.smoothRotate(transform, angle, deltaTime);
        }
      }
    }
  }

  /**
   * Stops player movement (Deceleration)
   */
  stopPlayerMovement(deltaTime: number): void {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return;

    const velocity = this.ecs.getComponent(playerEntity, Velocity);
    if (velocity) {
      // Apply deceleration towards 0,0
      const dt = deltaTime / 1000;
      const deceleration = gameConfig.gameplay.player.deceleration;

      velocity.x = MathUtils.moveTowards(velocity.x, 0, deceleration * dt);
      velocity.y = MathUtils.moveTowards(velocity.y, 0, deceleration * dt);
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
      const inventory = this.ecs.getComponent(playerEntity, Inventory) as Inventory | undefined;
      const speedBonus = playerUpgrades.getSpeedBonus(inventory);
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
