import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { Pet } from '../../entities/player/Pet';
import { PlayerSystem } from '../player/PlayerSystem';
import { getPlayerRangeHeight, getPlayerRangeWidth } from '../../config/PlayerConfig';

interface Point2D {
  x: number;
  y: number;
}

interface OwnerKinematics {
  linearVelocityX: number;
  linearVelocityY: number;
  speed: number;
  turnRate: number;
}

interface PetRuntimeState {
  currentMoveSpeed: number;
  followTargetX: number;
  followTargetY: number;
  stationaryWanderOffsetX: number;
  stationaryWanderOffsetY: number;
  stationaryWanderFromX: number;
  stationaryWanderFromY: number;
  stationaryWanderToX: number;
  stationaryWanderToY: number;
  stationaryWanderMoveSeconds: number;
  stationaryWanderMoveDurationSeconds: number;
  stationaryWanderHoldSeconds: number;
  stationaryWanderCooldownSeconds: number;
  rotationHeadingX: number;
  rotationHeadingY: number;
  collectAnimationTargetX: number;
  collectAnimationTargetY: number;
  collectAnimationRemainingSeconds: number;
}

interface PetCollectAnimationCommand {
  target: Point2D | null;
  durationSeconds: number;
  stop: boolean;
}

export class PetFollowSystem extends BaseSystem {
  public static override readonly Type = 'PetFollowSystem';

  private readonly playerSystem: PlayerSystem;
  private readonly runtimeStateByEntityId: Map<number, PetRuntimeState> = new Map();
  private pendingCollectAnimationCommand: PetCollectAnimationCommand | null = null;
  private petAutoCollectListener: ((event: Event) => void) | null = null;

  private readonly SNAP_DISTANCE_PX = 1600;
  private readonly PET_BASE_SPEED_PX_PER_SECOND = 270;
  private readonly PET_CATCHUP_SPEED_PX_PER_SECOND = 560;
  private readonly PET_CATCHUP_START_RATIO = 0.42;
  private readonly PET_CATCHUP_FULL_RATIO = 0.88;
  private readonly PET_SPEED_RAMP_RATE = 7.5;
  private readonly PET_SLOWDOWN_DISTANCE = 130;
  private readonly PET_STOP_EPSILON = 6;
  private readonly FOLLOW_TARGET_FILTER_MOVING = 15;
  private readonly FOLLOW_TARGET_FILTER_STATIONARY = 9;
  private readonly FOLLOW_TARGET_SNAP_DISTANCE = 900;
  private readonly PET_ROTATION_MOVE_SPEED_THRESHOLD = 14;
  private readonly ROTATION_HEADING_FILTER = 12;
  private readonly ROTATION_HEADING_FILTER_CATCHUP = 24;
  private readonly PET_ROTATION_CATCHUP_LERP_MULTIPLIER = 2.2;
  private readonly PET_ROTATION_CATCHUP_BLEND_THRESHOLD = 0.28;
  private readonly PET_ROTATION_MOONWALK_DOT_THRESHOLD = -0.12;

  private readonly FOLLOW_DISTANCE_EXTRA = 24;
  private readonly LATERAL_OFFSET_MULTIPLIER = 1.1;
  private readonly OWNER_LEAD_TIME = 0.18;

  private readonly OWNER_CLEARANCE_MIN = 130;
  private readonly OWNER_CLEARANCE_MAX = 230;
  private readonly OWNER_CLEARANCE_FOLLOW_MULTIPLIER = 0.82;
  private readonly OWNER_CLEARANCE_SPEED_BONUS = 20;

  private readonly OWNER_STATIONARY_SPEED_THRESHOLD = 28;
  private readonly OWNER_STATIONARY_TURN_RATE_THRESHOLD = 0.22;

  private readonly STATIONARY_WANDER_TRIGGER_RATE = 0.22;
  private readonly STATIONARY_WANDER_MOVE_MIN_SECONDS = 1.4;
  private readonly STATIONARY_WANDER_MOVE_MAX_SECONDS = 2.8;
  private readonly STATIONARY_WANDER_RETURN_MOVE_MIN_SECONDS = 1.0;
  private readonly STATIONARY_WANDER_RETURN_MOVE_MAX_SECONDS = 1.9;
  private readonly STATIONARY_WANDER_HOLD_MIN_SECONDS = 0.55;
  private readonly STATIONARY_WANDER_HOLD_MAX_SECONDS = 1.4;
  private readonly STATIONARY_WANDER_COOLDOWN_MIN_SECONDS = 2.8;
  private readonly STATIONARY_WANDER_COOLDOWN_MAX_SECONDS = 5.2;
  private readonly STATIONARY_WANDER_RANGE_USE_WIDTH_RATIO = 0.9;
  private readonly STATIONARY_WANDER_RANGE_USE_HEIGHT_RATIO = 0.86;
  private readonly STATIONARY_WANDER_MIN_DISTANCE = 180;
  private readonly STATIONARY_WANDER_MAX_ATTEMPTS = 6;

  private readonly OWNER_SAMPLED_VELOCITY_FILTER = 9.5;
  private readonly OWNER_VELOCITY_SNAP_THRESHOLD = 6;
  private readonly OWNER_TURN_RATE_SNAP_THRESHOLD = 0.03;
  private readonly PET_COLLECT_ANIMATION_DURATION_SECONDS = 0.36;
  private readonly PET_COLLECT_SPEED_BOOST = 1;

  private previousOwnerX: number | null = null;
  private previousOwnerY: number | null = null;
  private previousOwnerRotation: number | null = null;
  private filteredSampledOwnerVelocityX = 0;
  private filteredSampledOwnerVelocityY = 0;

  private readonly stationaryWanderHalfRangeX: number;
  private readonly stationaryWanderHalfRangeY: number;

  constructor(ecs: ECS, playerSystem: PlayerSystem) {
    super(ecs);
    this.playerSystem = playerSystem;

    this.stationaryWanderHalfRangeX = Math.max(
      160,
      (getPlayerRangeWidth() * this.STATIONARY_WANDER_RANGE_USE_WIDTH_RATIO) / 2
    );
    this.stationaryWanderHalfRangeY = Math.max(
      120,
      (getPlayerRangeHeight() * this.STATIONARY_WANDER_RANGE_USE_HEIGHT_RATIO) / 2
    );

    this.setupPetAutoCollectListener();
  }

  update(deltaTime: number): void {
    const dtSeconds = Math.max(0, Math.min(0.1, deltaTime / 1000));
    if (dtSeconds <= 0) return;

    const playerEntity = this.playerSystem.getPlayerEntity();
    if (!playerEntity) return;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    if (!playerTransform) return;

    const playerVelocity = this.ecs.getComponent(playerEntity, Velocity) || null;
    const ownerKinematics = this.buildOwnerKinematics(playerTransform, playerVelocity, dtSeconds);
    const pendingCollectCommand = this.consumePendingCollectAnimationCommand();

    const petEntities = this.ecs.getEntitiesWithComponents(Pet, Transform);
    const activePetEntityIds = new Set<number>();

    for (const petEntity of petEntities) {
      activePetEntityIds.add(petEntity.id);

      const pet = this.ecs.getComponent(petEntity, Pet);
      const petTransform = this.ecs.getComponent(petEntity, Transform);
      if (!pet || !petTransform) continue;

      const runtimeState = this.getOrCreateRuntimeState(petEntity.id, petTransform);
      if (pendingCollectCommand?.stop) {
        runtimeState.collectAnimationRemainingSeconds = 0;
        runtimeState.currentMoveSpeed = this.PET_BASE_SPEED_PX_PER_SECOND;
      } else if (pendingCollectCommand?.target) {
        this.startCollectAnimation(
          runtimeState,
          petTransform,
          pendingCollectCommand.target,
          pendingCollectCommand.durationSeconds
        );
      }
      this.updatePetTransform(pet, runtimeState, petTransform, playerTransform, ownerKinematics, dtSeconds);
    }

    for (const entityId of this.runtimeStateByEntityId.keys()) {
      if (!activePetEntityIds.has(entityId)) {
        this.runtimeStateByEntityId.delete(entityId);
      }
    }
  }

  private updatePetTransform(
    pet: Pet,
    runtimeState: PetRuntimeState,
    petTransform: Transform,
    ownerTransform: Transform,
    ownerKinematics: OwnerKinematics,
    dtSeconds: number
  ): void {
    const ownerRotation = Number.isFinite(ownerTransform.rotation) ? ownerTransform.rotation : 0;
    const isOwnerStationary = this.isOwnerStationary(ownerKinematics);
    const collectAnimationTarget = this.updateCollectAnimation(runtimeState, dtSeconds);
    const hasCollectAnimationTarget = !!collectAnimationTarget;

    const formationAnchor = hasCollectAnimationTarget
      ? collectAnimationTarget
      : this.calculateFormationAnchor(ownerTransform, pet, ownerKinematics, ownerRotation, isOwnerStationary);
    const stationaryWanderOffset = hasCollectAnimationTarget
      ? { x: 0, y: 0 }
      : this.updateStationaryWander(runtimeState, isOwnerStationary, dtSeconds);

    const rawTargetX = formationAnchor.x + stationaryWanderOffset.x;
    const rawTargetY = formationAnchor.y + stationaryWanderOffset.y;

    const ownerClearanceRadius = this.computeOwnerClearanceRadius(pet, ownerKinematics.speed);
    const target = hasCollectAnimationTarget
      ? { x: rawTargetX, y: rawTargetY }
      : this.constrainPointOutsideOwner(
        rawTargetX,
        rawTargetY,
        ownerTransform,
        ownerClearanceRadius,
        petTransform
      );
    const smoothedTarget = this.updateSmoothedFollowTarget(runtimeState, target, isOwnerStationary, dtSeconds);

    const previousX = petTransform.x;
    const previousY = petTransform.y;

    const dx = smoothedTarget.x - petTransform.x;
    const dy = smoothedTarget.y - petTransform.y;
    const distance = this.getMagnitude(dx, dy);

    if (!Number.isFinite(distance)) return;

    let catchUpBlendForRotation = 0;

    if (distance > this.SNAP_DISTANCE_PX) {
      petTransform.x = smoothedTarget.x;
      petTransform.y = smoothedTarget.y;
      runtimeState.followTargetX = smoothedTarget.x;
      runtimeState.followTargetY = smoothedTarget.y;
      runtimeState.currentMoveSpeed = this.PET_BASE_SPEED_PX_PER_SECOND;
      this.resetStationaryWanderState(runtimeState);
    } else {
      const isStationaryWanderMoving = runtimeState.stationaryWanderMoveSeconds > 0;

      if (isOwnerStationary && !isStationaryWanderMoving && distance <= this.PET_STOP_EPSILON) {
        petTransform.x = smoothedTarget.x;
        petTransform.y = smoothedTarget.y;
        runtimeState.currentMoveSpeed = this.PET_BASE_SPEED_PX_PER_SECOND;
      } else if (distance > 0.001) {
        const catchUpStartDistance = pet.catchUpDistance * this.PET_CATCHUP_START_RATIO;
        const catchUpFullDistance = pet.catchUpDistance * this.PET_CATCHUP_FULL_RATIO;
        const catchUpBlend = this.clamp01(
          (distance - catchUpStartDistance) / Math.max(1, catchUpFullDistance - catchUpStartDistance)
        );
        catchUpBlendForRotation = hasCollectAnimationTarget ? 1 : catchUpBlend;
        const targetMoveSpeed = this.lerp(
          this.PET_BASE_SPEED_PX_PER_SECOND,
          this.PET_CATCHUP_SPEED_PX_PER_SECOND,
          catchUpBlend
        ) * (hasCollectAnimationTarget ? this.PET_COLLECT_SPEED_BOOST : 1);
        const speedRampAlpha = this.clamp01(1 - Math.exp(-this.PET_SPEED_RAMP_RATE * dtSeconds));
        runtimeState.currentMoveSpeed = this.lerp(runtimeState.currentMoveSpeed, targetMoveSpeed, speedRampAlpha);

        const slowdownFactor = this.clamp01(distance / this.PET_SLOWDOWN_DISTANCE);
        const speedScale = this.lerp(0.35, 1, slowdownFactor);
        const maxStep = runtimeState.currentMoveSpeed * speedScale * dtSeconds;
        const step = Math.min(distance, maxStep);

        petTransform.x += (dx / distance) * step;
        petTransform.y += (dy / distance) * step;
      }
    }

    const frameMoveX = petTransform.x - previousX;
    const frameMoveY = petTransform.y - previousY;
    const frameMoveDistance = this.getMagnitude(frameMoveX, frameMoveY);
    const frameMoveSpeed = dtSeconds > 0 ? frameMoveDistance / dtSeconds : 0;

    const desiredHeading = this.resolveDesiredHeading(
      runtimeState,
      petTransform,
      smoothedTarget,
      frameMoveX,
      frameMoveY,
      frameMoveSpeed,
      isOwnerStationary,
      pet.stopDistance
    );

    this.smoothRotationHeading(runtimeState, desiredHeading, dtSeconds, catchUpBlendForRotation);

    const isCatchUpRotation = catchUpBlendForRotation >= this.PET_ROTATION_CATCHUP_BLEND_THRESHOLD
      && frameMoveSpeed > this.PET_ROTATION_MOVE_SPEED_THRESHOLD
      && frameMoveDistance > 0.001;
    let forceRotationSnap = false;
    if (isCatchUpRotation) {
      const moveHeadingX = frameMoveX / frameMoveDistance;
      const moveHeadingY = frameMoveY / frameMoveDistance;
      const facingX = Math.cos(petTransform.rotation);
      const facingY = Math.sin(petTransform.rotation);
      const facingDotMove = facingX * moveHeadingX + facingY * moveHeadingY;
      if (facingDotMove <= this.PET_ROTATION_MOONWALK_DOT_THRESHOLD) {
        runtimeState.rotationHeadingX = moveHeadingX;
        runtimeState.rotationHeadingY = moveHeadingY;
        forceRotationSnap = true;
      }
    }

    const targetRotation = Math.atan2(runtimeState.rotationHeadingY, runtimeState.rotationHeadingX);
    const catchUpRotationMultiplier = this.lerp(1, this.PET_ROTATION_CATCHUP_LERP_MULTIPLIER, catchUpBlendForRotation);
    const rotationLerpFactor = forceRotationSnap
      ? 1
      : Math.min(1, dtSeconds * pet.rotationFollowSpeed * catchUpRotationMultiplier);
    petTransform.rotation = this.lerpAngle(petTransform.rotation, targetRotation, rotationLerpFactor);
  }

  private calculateFormationAnchor(
    ownerTransform: Transform,
    pet: Pet,
    ownerKinematics: OwnerKinematics,
    ownerRotation: number,
    isOwnerStationary: boolean
  ): Point2D {
    const forwardX = Math.cos(ownerRotation);
    const forwardY = Math.sin(ownerRotation);
    const rightX = -forwardY;
    const rightY = forwardX;

    const leadX = isOwnerStationary ? 0 : ownerKinematics.linearVelocityX * this.OWNER_LEAD_TIME;
    const leadY = isOwnerStationary ? 0 : ownerKinematics.linearVelocityY * this.OWNER_LEAD_TIME;

    const followDistance = pet.followDistance + this.FOLLOW_DISTANCE_EXTRA;
    const lateralOffset = pet.lateralOffset * this.LATERAL_OFFSET_MULTIPLIER;

    return {
      x: ownerTransform.x + leadX - forwardX * followDistance + rightX * lateralOffset,
      y: ownerTransform.y + leadY - forwardY * followDistance + rightY * lateralOffset
    };
  }

  private computeOwnerClearanceRadius(pet: Pet, ownerSpeed: number): number {
    const baseClearance = pet.followDistance * this.OWNER_CLEARANCE_FOLLOW_MULTIPLIER + pet.stopDistance;
    const speedBoost = this.clamp01(ownerSpeed / 760) * this.OWNER_CLEARANCE_SPEED_BONUS;
    return Math.max(this.OWNER_CLEARANCE_MIN, Math.min(this.OWNER_CLEARANCE_MAX, baseClearance + speedBoost));
  }

  private constrainPointOutsideOwner(
    x: number,
    y: number,
    ownerTransform: Transform,
    clearanceRadius: number,
    petTransform: Transform
  ): Point2D {
    const dx = x - ownerTransform.x;
    const dy = y - ownerTransform.y;
    const distance = this.getMagnitude(dx, dy);
    if (distance >= clearanceRadius) return { x, y };

    if (distance > 0.001) {
      return {
        x: ownerTransform.x + (dx / distance) * clearanceRadius,
        y: ownerTransform.y + (dy / distance) * clearanceRadius
      };
    }

    const fallbackX = petTransform.x - ownerTransform.x;
    const fallbackY = petTransform.y - ownerTransform.y;
    const fallbackDistance = this.getMagnitude(fallbackX, fallbackY);
    if (fallbackDistance > 0.001) {
      return {
        x: ownerTransform.x + (fallbackX / fallbackDistance) * clearanceRadius,
        y: ownerTransform.y + (fallbackY / fallbackDistance) * clearanceRadius
      };
    }

    return {
      x: ownerTransform.x + clearanceRadius,
      y: ownerTransform.y
    };
  }

  private updateStationaryWander(
    runtimeState: PetRuntimeState,
    isOwnerStationary: boolean,
    dtSeconds: number
  ): Point2D {
    if (!isOwnerStationary) {
      this.resetStationaryWanderState(runtimeState);
      return { x: 0, y: 0 };
    }

    runtimeState.stationaryWanderMoveSeconds = Math.max(0, runtimeState.stationaryWanderMoveSeconds - dtSeconds);
    runtimeState.stationaryWanderCooldownSeconds = Math.max(0, runtimeState.stationaryWanderCooldownSeconds - dtSeconds);

    if (runtimeState.stationaryWanderMoveSeconds > 0 && runtimeState.stationaryWanderMoveDurationSeconds > 0) {
      const progress = this.clamp01(1 - (runtimeState.stationaryWanderMoveSeconds / runtimeState.stationaryWanderMoveDurationSeconds));
      const easedProgress = progress * (2 - progress);

      runtimeState.stationaryWanderOffsetX = this.lerp(
        runtimeState.stationaryWanderFromX,
        runtimeState.stationaryWanderToX,
        easedProgress
      );
      runtimeState.stationaryWanderOffsetY = this.lerp(
        runtimeState.stationaryWanderFromY,
        runtimeState.stationaryWanderToY,
        easedProgress
      );

      return {
        x: runtimeState.stationaryWanderOffsetX,
        y: runtimeState.stationaryWanderOffsetY
      };
    }

    if (runtimeState.stationaryWanderHoldSeconds > 0) {
      runtimeState.stationaryWanderHoldSeconds = Math.max(0, runtimeState.stationaryWanderHoldSeconds - dtSeconds);
      return {
        x: runtimeState.stationaryWanderOffsetX,
        y: runtimeState.stationaryWanderOffsetY
      };
    }

    const hasOffset = Math.abs(runtimeState.stationaryWanderOffsetX) > 0.001
      || Math.abs(runtimeState.stationaryWanderOffsetY) > 0.001;

    if (hasOffset) {
      runtimeState.stationaryWanderFromX = runtimeState.stationaryWanderOffsetX;
      runtimeState.stationaryWanderFromY = runtimeState.stationaryWanderOffsetY;
      runtimeState.stationaryWanderToX = 0;
      runtimeState.stationaryWanderToY = 0;
      runtimeState.stationaryWanderMoveDurationSeconds = this.randomRange(
        this.STATIONARY_WANDER_RETURN_MOVE_MIN_SECONDS,
        this.STATIONARY_WANDER_RETURN_MOVE_MAX_SECONDS
      );
      runtimeState.stationaryWanderMoveSeconds = runtimeState.stationaryWanderMoveDurationSeconds;

      return {
        x: runtimeState.stationaryWanderOffsetX,
        y: runtimeState.stationaryWanderOffsetY
      };
    }

    if (runtimeState.stationaryWanderCooldownSeconds > 0) {
      return { x: 0, y: 0 };
    }

    const triggerChance = 1 - Math.exp(-this.STATIONARY_WANDER_TRIGGER_RATE * dtSeconds);
    if (Math.random() < triggerChance) {
      const wanderPoint = this.pickStationaryWanderPoint();

      runtimeState.stationaryWanderFromX = 0;
      runtimeState.stationaryWanderFromY = 0;
      runtimeState.stationaryWanderToX = wanderPoint.x;
      runtimeState.stationaryWanderToY = wanderPoint.y;
      runtimeState.stationaryWanderMoveDurationSeconds = this.randomRange(
        this.STATIONARY_WANDER_MOVE_MIN_SECONDS,
        this.STATIONARY_WANDER_MOVE_MAX_SECONDS
      );
      runtimeState.stationaryWanderMoveSeconds = runtimeState.stationaryWanderMoveDurationSeconds;
      runtimeState.stationaryWanderHoldSeconds = this.randomRange(
        this.STATIONARY_WANDER_HOLD_MIN_SECONDS,
        this.STATIONARY_WANDER_HOLD_MAX_SECONDS
      );
      runtimeState.stationaryWanderCooldownSeconds = this.randomRange(
        this.STATIONARY_WANDER_COOLDOWN_MIN_SECONDS,
        this.STATIONARY_WANDER_COOLDOWN_MAX_SECONDS
      );
    }

    return { x: 0, y: 0 };
  }

  private pickStationaryWanderPoint(): Point2D {
    for (let attempt = 0; attempt < this.STATIONARY_WANDER_MAX_ATTEMPTS; attempt++) {
      const x = this.randomRange(-this.stationaryWanderHalfRangeX, this.stationaryWanderHalfRangeX);
      const y = this.randomRange(-this.stationaryWanderHalfRangeY, this.stationaryWanderHalfRangeY);
      if (this.getMagnitude(x, y) >= this.STATIONARY_WANDER_MIN_DISTANCE) {
        return { x, y };
      }
    }

    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.cos(angle) * this.STATIONARY_WANDER_MIN_DISTANCE,
      y: Math.sin(angle) * this.STATIONARY_WANDER_MIN_DISTANCE
    };
  }

  private updateSmoothedFollowTarget(
    runtimeState: PetRuntimeState,
    target: Point2D,
    isOwnerStationary: boolean,
    dtSeconds: number
  ): Point2D {
    const dx = target.x - runtimeState.followTargetX;
    const dy = target.y - runtimeState.followTargetY;
    const distance = this.getMagnitude(dx, dy);
    if (!Number.isFinite(distance)) {
      runtimeState.followTargetX = target.x;
      runtimeState.followTargetY = target.y;
      return { x: target.x, y: target.y };
    }

    if (distance > this.FOLLOW_TARGET_SNAP_DISTANCE) {
      runtimeState.followTargetX = target.x;
      runtimeState.followTargetY = target.y;
      return { x: target.x, y: target.y };
    }

    const filterRate = isOwnerStationary
      ? this.FOLLOW_TARGET_FILTER_STATIONARY
      : this.FOLLOW_TARGET_FILTER_MOVING;
    const alpha = this.clamp01(1 - Math.exp(-filterRate * dtSeconds));
    runtimeState.followTargetX = this.lerp(runtimeState.followTargetX, target.x, alpha);
    runtimeState.followTargetY = this.lerp(runtimeState.followTargetY, target.y, alpha);

    return {
      x: runtimeState.followTargetX,
      y: runtimeState.followTargetY
    };
  }

  private resolveDesiredHeading(
    runtimeState: PetRuntimeState,
    petTransform: Transform,
    target: Point2D,
    frameMoveX: number,
    frameMoveY: number,
    frameMoveSpeed: number,
    isOwnerStationary: boolean,
    stopDistance: number
  ): Point2D {
    if (frameMoveSpeed > this.PET_ROTATION_MOVE_SPEED_THRESHOLD) {
      const moveLength = this.getMagnitude(frameMoveX, frameMoveY);
      if (moveLength > 0.001) {
        return {
          x: frameMoveX / moveLength,
          y: frameMoveY / moveLength
        };
      }
    }

    const toTargetX = target.x - petTransform.x;
    const toTargetY = target.y - petTransform.y;
    const toTargetDistance = this.getMagnitude(toTargetX, toTargetY);
    if (!isOwnerStationary && toTargetDistance > stopDistance + 22) {
      return {
        x: toTargetX / Math.max(0.001, toTargetDistance),
        y: toTargetY / Math.max(0.001, toTargetDistance)
      };
    }

    return {
      x: runtimeState.rotationHeadingX,
      y: runtimeState.rotationHeadingY
    };
  }

  private smoothRotationHeading(
    runtimeState: PetRuntimeState,
    desiredHeading: Point2D,
    dtSeconds: number,
    catchUpBlend: number
  ): void {
    const filterRate = this.lerp(this.ROTATION_HEADING_FILTER, this.ROTATION_HEADING_FILTER_CATCHUP, catchUpBlend);
    const alpha = this.clamp01(1 - Math.exp(-filterRate * dtSeconds));
    runtimeState.rotationHeadingX = this.lerp(runtimeState.rotationHeadingX, desiredHeading.x, alpha);
    runtimeState.rotationHeadingY = this.lerp(runtimeState.rotationHeadingY, desiredHeading.y, alpha);

    const headingMagnitude = this.getMagnitude(runtimeState.rotationHeadingX, runtimeState.rotationHeadingY);
    if (headingMagnitude <= 0.001) {
      runtimeState.rotationHeadingX = desiredHeading.x;
      runtimeState.rotationHeadingY = desiredHeading.y;
      return;
    }

    runtimeState.rotationHeadingX /= headingMagnitude;
    runtimeState.rotationHeadingY /= headingMagnitude;
  }

  private updateCollectAnimation(
    runtimeState: PetRuntimeState,
    dtSeconds: number
  ): Point2D | null {
    if (runtimeState.collectAnimationRemainingSeconds <= 0) return null;

    runtimeState.collectAnimationRemainingSeconds = Math.max(
      0,
      runtimeState.collectAnimationRemainingSeconds - dtSeconds
    );

    const targetX = runtimeState.collectAnimationTargetX;
    const targetY = runtimeState.collectAnimationTargetY;
    this.resetStationaryWanderState(runtimeState);
    return { x: targetX, y: targetY };
  }

  private startCollectAnimation(
    runtimeState: PetRuntimeState,
    petTransform: Transform,
    target: Point2D,
    durationSeconds?: number
  ): void {
    const dx = target.x - petTransform.x;
    const dy = target.y - petTransform.y;
    const distance = this.getMagnitude(dx, dy);
    if (!Number.isFinite(distance)) return;

    const normalizedDuration = Number.isFinite(Number(durationSeconds))
      ? Math.max(0.1, Number(durationSeconds))
      : this.PET_COLLECT_ANIMATION_DURATION_SECONDS;

    runtimeState.collectAnimationTargetX = target.x;
    runtimeState.collectAnimationTargetY = target.y;
    runtimeState.collectAnimationRemainingSeconds = normalizedDuration;
    this.resetStationaryWanderState(runtimeState);
  }

  private setupPetAutoCollectListener(): void {
    if (typeof document === 'undefined' || this.petAutoCollectListener) return;

    this.petAutoCollectListener = (event: Event) => {
      const customEvent = event as CustomEvent<{ x?: number; y?: number; durationMs?: number; stop?: boolean }>;
      const detail = customEvent?.detail;
      if (detail?.stop === true) {
        this.pendingCollectAnimationCommand = {
          target: null,
          durationSeconds: 0,
          stop: true
        };
        return;
      }

      const point = this.parseCollectTargetPoint(detail);
      if (!point) return;

      const durationSeconds = this.parseCollectDurationSeconds(detail?.durationMs)
        ?? this.PET_COLLECT_ANIMATION_DURATION_SECONDS;
      this.pendingCollectAnimationCommand = {
        target: point,
        durationSeconds,
        stop: false
      };
    };

    document.addEventListener('pet:auto-collect', this.petAutoCollectListener);
  }

  private parseCollectTargetPoint(rawPoint: unknown): Point2D | null {
    if (!rawPoint || typeof rawPoint !== 'object') return null;
    const source = rawPoint as Record<string, unknown>;
    const x = Number(source.x);
    const y = Number(source.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  private parseCollectDurationSeconds(rawDurationMs: unknown): number | null {
    const parsedDurationMs = Number(rawDurationMs);
    if (!Number.isFinite(parsedDurationMs)) return null;

    const boundedDurationMs = Math.max(100, Math.min(6000, Math.floor(parsedDurationMs)));
    return boundedDurationMs / 1000;
  }

  private consumePendingCollectAnimationCommand(): PetCollectAnimationCommand | null {
    const command = this.pendingCollectAnimationCommand;
    this.pendingCollectAnimationCommand = null;
    return command;
  }

  private getOrCreateRuntimeState(entityId: number, petTransform: Transform): PetRuntimeState {
    const existingState = this.runtimeStateByEntityId.get(entityId);
    if (existingState) {
      return existingState;
    }

    const initialRotation = Number.isFinite(petTransform.rotation) ? petTransform.rotation : 0;
    const initialState: PetRuntimeState = {
      currentMoveSpeed: this.PET_BASE_SPEED_PX_PER_SECOND,
      followTargetX: petTransform.x,
      followTargetY: petTransform.y,
      stationaryWanderOffsetX: 0,
      stationaryWanderOffsetY: 0,
      stationaryWanderFromX: 0,
      stationaryWanderFromY: 0,
      stationaryWanderToX: 0,
      stationaryWanderToY: 0,
      stationaryWanderMoveSeconds: 0,
      stationaryWanderMoveDurationSeconds: 0,
      stationaryWanderHoldSeconds: 0,
      stationaryWanderCooldownSeconds: 0,
      rotationHeadingX: Math.cos(initialRotation),
      rotationHeadingY: Math.sin(initialRotation),
      collectAnimationTargetX: petTransform.x,
      collectAnimationTargetY: petTransform.y,
      collectAnimationRemainingSeconds: 0
    };

    this.runtimeStateByEntityId.set(entityId, initialState);
    return initialState;
  }

  private resetStationaryWanderState(runtimeState: PetRuntimeState): void {
    runtimeState.stationaryWanderOffsetX = 0;
    runtimeState.stationaryWanderOffsetY = 0;
    runtimeState.stationaryWanderFromX = 0;
    runtimeState.stationaryWanderFromY = 0;
    runtimeState.stationaryWanderToX = 0;
    runtimeState.stationaryWanderToY = 0;
    runtimeState.stationaryWanderMoveSeconds = 0;
    runtimeState.stationaryWanderMoveDurationSeconds = 0;
    runtimeState.stationaryWanderHoldSeconds = 0;
    runtimeState.stationaryWanderCooldownSeconds = 0;
  }

  private isOwnerStationary(ownerKinematics: OwnerKinematics): boolean {
    return ownerKinematics.speed <= this.OWNER_STATIONARY_SPEED_THRESHOLD
      && Math.abs(ownerKinematics.turnRate) <= this.OWNER_STATIONARY_TURN_RATE_THRESHOLD;
  }

  private buildOwnerKinematics(
    ownerTransform: Transform,
    ownerVelocityComponent: Velocity | null,
    dtSeconds: number
  ): OwnerKinematics {
    const currentX = Number(ownerTransform.x || 0);
    const currentY = Number(ownerTransform.y || 0);
    const currentRotation = Number(ownerTransform.rotation || 0);

    let sampledVelocityX = 0;
    let sampledVelocityY = 0;
    let sampledTurnRate = 0;

    if (this.previousOwnerX !== null && this.previousOwnerY !== null && dtSeconds > 0) {
      sampledVelocityX = (currentX - this.previousOwnerX) / dtSeconds;
      sampledVelocityY = (currentY - this.previousOwnerY) / dtSeconds;
    }

    if (this.previousOwnerRotation !== null && dtSeconds > 0) {
      sampledTurnRate = this.normalizeAngle(currentRotation - this.previousOwnerRotation) / dtSeconds;
    }

    this.previousOwnerX = currentX;
    this.previousOwnerY = currentY;
    this.previousOwnerRotation = currentRotation;

    const sampledFilterAlpha = this.clamp01(1 - Math.exp(-this.OWNER_SAMPLED_VELOCITY_FILTER * dtSeconds));
    this.filteredSampledOwnerVelocityX = this.lerp(this.filteredSampledOwnerVelocityX, sampledVelocityX, sampledFilterAlpha);
    this.filteredSampledOwnerVelocityY = this.lerp(this.filteredSampledOwnerVelocityY, sampledVelocityY, sampledFilterAlpha);

    if (this.getMagnitude(this.filteredSampledOwnerVelocityX, this.filteredSampledOwnerVelocityY) <= this.OWNER_VELOCITY_SNAP_THRESHOLD) {
      this.filteredSampledOwnerVelocityX = 0;
      this.filteredSampledOwnerVelocityY = 0;
    }

    const componentVelocityX = Number(ownerVelocityComponent?.x || 0);
    const componentVelocityY = Number(ownerVelocityComponent?.y || 0);
    const componentSpeed = this.getMagnitude(componentVelocityX, componentVelocityY);

    const velocityBlend = componentSpeed > 0.01 ? 0.62 : 0;
    const linearVelocityX = this.lerp(this.filteredSampledOwnerVelocityX, componentVelocityX, velocityBlend);
    const linearVelocityY = this.lerp(this.filteredSampledOwnerVelocityY, componentVelocityY, velocityBlend);
    const speed = this.getMagnitude(linearVelocityX, linearVelocityY);

    if (Math.abs(sampledTurnRate) <= this.OWNER_TURN_RATE_SNAP_THRESHOLD) {
      sampledTurnRate = 0;
    }

    return {
      linearVelocityX,
      linearVelocityY,
      speed,
      turnRate: sampledTurnRate
    };
  }

  private getMagnitude(x: number, y: number): number {
    return Math.hypot(x, y);
  }

  private lerp(start: number, end: number, factor: number): number {
    const safeFactor = this.clamp01(factor);
    return start + (end - start) * safeFactor;
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  private randomRange(min: number, max: number): number {
    if (max <= min) return min;
    return min + Math.random() * (max - min);
  }

  private lerpAngle(current: number, target: number, factor: number): number {
    const normalizedCurrent = Number.isFinite(current) ? current : 0;
    const normalizedTarget = Number.isFinite(target) ? target : 0;
    const wrappedDelta = this.normalizeAngle(normalizedTarget - normalizedCurrent);
    return normalizedCurrent + wrappedDelta * this.clamp01(factor);
  }

  private normalizeAngle(angle: number): number {
    const twoPi = Math.PI * 2;
    let normalized = angle % twoPi;
    if (normalized > Math.PI) normalized -= twoPi;
    if (normalized < -Math.PI) normalized += twoPi;
    return normalized;
  }

  override destroy(): void {
    if (typeof document !== 'undefined' && this.petAutoCollectListener) {
      document.removeEventListener('pet:auto-collect', this.petAutoCollectListener);
    }
    this.petAutoCollectListener = null;
    this.pendingCollectAnimationCommand = null;
    this.runtimeStateByEntityId.clear();
  }
}
