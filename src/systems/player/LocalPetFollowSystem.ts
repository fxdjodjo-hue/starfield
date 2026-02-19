import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { Authority } from '../../entities/spatial/Authority';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';
import { Npc } from '../../entities/ai/Npc';
import { RemotePlayer } from '../../entities/player/RemotePlayer';
import { Pet } from '../../entities/player/Pet';
import { RemotePet } from '../../entities/player/RemotePet';
import { LocalPetServerState } from '../../entities/player/LocalPetServerState';
import type { Entity } from '../../infrastructure/ecs/Entity';
import SHARED_PET_MOVEMENT_TUNING from '../../../shared/pet-movement-tuning.json';

interface LocalPetRuntimeState {
  x: number;
  y: number;
  rotation: number;
  currentMoveSpeed: number;
  followTargetX: number;
  followTargetY: number;
}

function readTuningNumber(source: Record<string, unknown>, key: string, fallback: number, min?: number): number {
  const raw = Number(source[key]);
  if (!Number.isFinite(raw)) return fallback;
  if (Number.isFinite(min as number)) return Math.max(min as number, raw);
  return raw;
}

const SHARED_TUNING = (SHARED_PET_MOVEMENT_TUNING && typeof SHARED_PET_MOVEMENT_TUNING === 'object')
  ? (SHARED_PET_MOVEMENT_TUNING as Record<string, unknown>)
  : {};

const PET_TUNING = {
  SNAP_DISTANCE_PX: readTuningNumber(SHARED_TUNING, 'snapDistancePx', 1600, 100),
  PET_BASE_SPEED_PX_PER_SECOND: readTuningNumber(SHARED_TUNING, 'petBaseSpeedPxPerSecond', 270, 10),
  PET_CATCHUP_SPEED_PX_PER_SECOND: readTuningNumber(SHARED_TUNING, 'petCatchUpSpeedPxPerSecond', 560, 10),
  PET_CATCHUP_START_RATIO: readTuningNumber(SHARED_TUNING, 'petCatchUpStartRatio', 0.42, 0),
  PET_CATCHUP_FULL_RATIO: readTuningNumber(SHARED_TUNING, 'petCatchUpFullRatio', 0.88, 0),
  PET_SPEED_RAMP_RATE: readTuningNumber(SHARED_TUNING, 'petSpeedRampRate', 7.5, 0.01),
  PET_SLOWDOWN_DISTANCE: readTuningNumber(SHARED_TUNING, 'petSlowdownDistance', 130, 1),
  PET_STOP_EPSILON: readTuningNumber(SHARED_TUNING, 'petStopEpsilon', 6, 0),
  FOLLOW_TARGET_FILTER_MOVING: readTuningNumber(SHARED_TUNING, 'followTargetFilterMoving', 15, 0.01),
  FOLLOW_TARGET_FILTER_STATIONARY: readTuningNumber(SHARED_TUNING, 'followTargetFilterStationary', 9, 0.01),
  FOLLOW_TARGET_SNAP_DISTANCE: readTuningNumber(SHARED_TUNING, 'followTargetSnapDistance', 900, 1),
  FOLLOW_DISTANCE_EXTRA: readTuningNumber(SHARED_TUNING, 'followDistanceExtra', 24),
  LATERAL_OFFSET_MULTIPLIER: readTuningNumber(SHARED_TUNING, 'lateralOffsetMultiplier', 1.1, 0),
  OWNER_LEAD_TIME: readTuningNumber(SHARED_TUNING, 'ownerLeadTime', 0.18, 0),
  OWNER_CLEARANCE_MIN: readTuningNumber(SHARED_TUNING, 'ownerClearanceMin', 130, 1),
  OWNER_CLEARANCE_MAX: readTuningNumber(SHARED_TUNING, 'ownerClearanceMax', 230, 1),
  OWNER_CLEARANCE_FOLLOW_MULTIPLIER: readTuningNumber(SHARED_TUNING, 'ownerClearanceFollowMultiplier', 0.82, 0),
  OWNER_CLEARANCE_SPEED_BONUS: readTuningNumber(SHARED_TUNING, 'ownerClearanceSpeedBonus', 20, 0),
  OWNER_STATIONARY_SPEED_THRESHOLD: readTuningNumber(SHARED_TUNING, 'ownerStationarySpeedThreshold', 28, 0)
} as const;

export class LocalPetFollowSystem extends BaseSystem {
  public static override readonly Type = 'LocalPetFollowSystem';

  private readonly runtimeByEntityId = new Map<number, LocalPetRuntimeState>();

  private readonly SNAP_DISTANCE_PX = PET_TUNING.SNAP_DISTANCE_PX;
  private readonly PET_BASE_SPEED_PX_PER_SECOND = PET_TUNING.PET_BASE_SPEED_PX_PER_SECOND;
  private readonly PET_CATCHUP_SPEED_PX_PER_SECOND = PET_TUNING.PET_CATCHUP_SPEED_PX_PER_SECOND;
  private readonly PET_CATCHUP_START_RATIO = PET_TUNING.PET_CATCHUP_START_RATIO;
  private readonly PET_CATCHUP_FULL_RATIO = Math.max(PET_TUNING.PET_CATCHUP_START_RATIO, PET_TUNING.PET_CATCHUP_FULL_RATIO);
  private readonly PET_SPEED_RAMP_RATE = PET_TUNING.PET_SPEED_RAMP_RATE;
  private readonly PET_SLOWDOWN_DISTANCE = PET_TUNING.PET_SLOWDOWN_DISTANCE;
  private readonly PET_STOP_EPSILON = PET_TUNING.PET_STOP_EPSILON;
  private readonly FOLLOW_TARGET_FILTER_MOVING = PET_TUNING.FOLLOW_TARGET_FILTER_MOVING;
  private readonly FOLLOW_TARGET_FILTER_STATIONARY = PET_TUNING.FOLLOW_TARGET_FILTER_STATIONARY;
  private readonly FOLLOW_TARGET_SNAP_DISTANCE = PET_TUNING.FOLLOW_TARGET_SNAP_DISTANCE;

  private readonly FOLLOW_DISTANCE_EXTRA = PET_TUNING.FOLLOW_DISTANCE_EXTRA;
  private readonly LATERAL_OFFSET_MULTIPLIER = PET_TUNING.LATERAL_OFFSET_MULTIPLIER;
  private readonly OWNER_LEAD_TIME = PET_TUNING.OWNER_LEAD_TIME;

  private readonly OWNER_CLEARANCE_MIN = PET_TUNING.OWNER_CLEARANCE_MIN;
  private readonly OWNER_CLEARANCE_MAX = Math.max(PET_TUNING.OWNER_CLEARANCE_MIN, PET_TUNING.OWNER_CLEARANCE_MAX);
  private readonly OWNER_CLEARANCE_FOLLOW_MULTIPLIER = PET_TUNING.OWNER_CLEARANCE_FOLLOW_MULTIPLIER;
  private readonly OWNER_CLEARANCE_SPEED_BONUS = PET_TUNING.OWNER_CLEARANCE_SPEED_BONUS;
  private readonly OWNER_STATIONARY_SPEED_THRESHOLD = PET_TUNING.OWNER_STATIONARY_SPEED_THRESHOLD;

  private readonly SERVER_CONVERGENCE_RATE = 15;
  private readonly SERVER_HARD_SNAP_DISTANCE = 300;
  private readonly SERVER_STATE_MAX_AGE_MS = 600;

  constructor(ecs: ECS) {
    super(ecs);
  }

  update(deltaTime: number): void {
    const dtSeconds = this.resolveDeltaSeconds(deltaTime);
    if (dtSeconds <= 0) return;

    const playerEntity = this.findLocalPlayerEntity();
    const petEntity = this.findLocalPetEntity();

    if (!playerEntity || !petEntity) {
      this.runtimeByEntityId.clear();
      return;
    }

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    const playerVelocity = this.ecs.getComponent(playerEntity, Velocity);
    const petTransform = this.ecs.getComponent(petEntity, Transform);
    const petComponent = this.ecs.getComponent(petEntity, Pet);

    if (!playerTransform || !petTransform || !petComponent) return;
    if (petComponent.isActive === false) {
      this.runtimeByEntityId.delete(petEntity.id);
      return;
    }

    // Local pet is now simulated client-side and reconciled with server samples.
    if (this.ecs.hasComponent(petEntity, InterpolationTarget)) {
      this.ecs.removeComponent(petEntity, InterpolationTarget);
    }

    const runtime = this.getOrCreateRuntimeState(petEntity.id, petTransform);
    const ownerVelocityX = Number.isFinite(playerVelocity?.x) ? Number(playerVelocity?.x) : 0;
    const ownerVelocityY = Number.isFinite(playerVelocity?.y) ? Number(playerVelocity?.y) : 0;
    const ownerSpeed = this.getMagnitude(ownerVelocityX, ownerVelocityY);
    const ownerIsStationary = ownerSpeed <= this.OWNER_STATIONARY_SPEED_THRESHOLD;

    const previousX = runtime.x;
    const previousY = runtime.y;

    const freshServerState = this.getFreshServerState(petEntity);

    if (freshServerState) {
      // SERVER-AUTHORITATIVE: server knows about collect, defense, and all special modes.
      // Lerp directly toward server position — no local simulation fighting it.
      const dx = freshServerState.x - runtime.x;
      const dy = freshServerState.y - runtime.y;
      const dist = this.getMagnitude(dx, dy);
      if (dist > this.SERVER_HARD_SNAP_DISTANCE) {
        runtime.x = freshServerState.x;
        runtime.y = freshServerState.y;
        runtime.followTargetX = freshServerState.x;
        runtime.followTargetY = freshServerState.y;
      } else if (dist > 1) {
        const alpha = this.clamp01(1 - Math.exp(-this.SERVER_CONVERGENCE_RATE * dtSeconds));
        runtime.x += dx * alpha;
        runtime.y += dy * alpha;
      }
    } else {
      // FALLBACK: no server state available — simulate follow locally.
      const target = this.resolveFollowTarget(
        playerTransform.x,
        playerTransform.y,
        playerTransform.rotation,
        ownerVelocityX,
        ownerVelocityY,
        ownerSpeed,
        ownerIsStationary,
        petComponent
      );
      const smoothedTarget = this.updateSmoothedTarget(runtime, target, dtSeconds, ownerIsStationary);
      this.moveTowardsTarget(runtime, smoothedTarget, petComponent, dtSeconds);
    }

    // Rotation: always derived from ACTUAL frame displacement so it matches what the player sees.
    const actualMoveX = runtime.x - previousX;
    const actualMoveY = runtime.y - previousY;
    const actualMoveDistance = this.getMagnitude(actualMoveX, actualMoveY);
    const actualMoveSpeed = dtSeconds > 0 ? actualMoveDistance / dtSeconds : 0;

    let targetRotation = runtime.rotation;
    // When owner is stationary, ignore tiny drifts from follow-target shifting with ship rotation.
    const rotationThreshold = ownerIsStationary ? 20 : 1;
    if (actualMoveSpeed > rotationThreshold && actualMoveDistance > 0.5) {
      targetRotation = Math.atan2(actualMoveY, actualMoveX);
    }

    runtime.rotation = this.rotateTowardsLikePlayer(
      runtime.rotation,
      targetRotation,
      petComponent.rotationFollowSpeed,
      dtSeconds
    );

    petTransform.x = runtime.x;
    petTransform.y = runtime.y;
    petTransform.rotation = runtime.rotation;

    this.cleanupRuntime(petEntity.id);
  }

  private resolveDeltaSeconds(deltaTimeMs: number): number {
    const safeDeltaMs = Number.isFinite(Number(deltaTimeMs)) ? Number(deltaTimeMs) : 16.67;
    if (safeDeltaMs <= 0) return 0;
    return Math.max(0.01, Math.min(0.1, safeDeltaMs / 1000));
  }

  private findLocalPlayerEntity(): Entity | null {
    const candidates = this.ecs.getEntitiesWithComponents(Transform, Velocity, Authority);
    for (const entity of candidates) {
      if (this.ecs.hasComponent(entity, Npc)) continue;
      if (this.ecs.hasComponent(entity, RemotePlayer)) continue;
      if (this.ecs.hasComponent(entity, InterpolationTarget)) continue;
      return entity;
    }
    return null;
  }

  private findLocalPetEntity(): Entity | null {
    const petEntities = this.ecs.getEntitiesWithComponents(Pet, Transform);
    for (const entity of petEntities) {
      if (this.ecs.hasComponent(entity, RemotePet)) continue;
      return entity;
    }
    return null;
  }

  private getOrCreateRuntimeState(entityId: number, transform: Transform): LocalPetRuntimeState {
    const existing = this.runtimeByEntityId.get(entityId);
    if (existing) {
      const dx = transform.x - existing.x;
      const dy = transform.y - existing.y;
      // If an external system moved the pet far away, re-seed runtime to avoid long pull-back.
      if (dx * dx + dy * dy > 1200 * 1200) {
        existing.x = transform.x;
        existing.y = transform.y;
        existing.rotation = Number.isFinite(transform.rotation) ? transform.rotation : 0;
        existing.followTargetX = existing.x;
        existing.followTargetY = existing.y;
      }
      return existing;
    }

    const runtime: LocalPetRuntimeState = {
      x: transform.x,
      y: transform.y,
      rotation: Number.isFinite(transform.rotation) ? transform.rotation : 0,
      currentMoveSpeed: this.PET_BASE_SPEED_PX_PER_SECOND,
      followTargetX: transform.x,
      followTargetY: transform.y
    };
    this.runtimeByEntityId.set(entityId, runtime);
    return runtime;
  }

  private resolveFollowTarget(
    ownerX: number,
    ownerY: number,
    ownerRotationRaw: number,
    ownerVelocityX: number,
    ownerVelocityY: number,
    ownerSpeed: number,
    ownerIsStationary: boolean,
    pet: Pet
  ): { x: number; y: number } {
    const ownerRotation = Number.isFinite(ownerRotationRaw) ? ownerRotationRaw : 0;
    const forwardX = Math.cos(ownerRotation);
    const forwardY = Math.sin(ownerRotation);
    const rightX = -forwardY;
    const rightY = forwardX;
    const leadX = ownerIsStationary ? 0 : ownerVelocityX * this.OWNER_LEAD_TIME;
    const leadY = ownerIsStationary ? 0 : ownerVelocityY * this.OWNER_LEAD_TIME;

    const followDistance = pet.followDistance + this.FOLLOW_DISTANCE_EXTRA;
    const lateralOffset = pet.lateralOffset * this.LATERAL_OFFSET_MULTIPLIER;

    const rawTargetX = ownerX + leadX - (forwardX * followDistance) + (rightX * lateralOffset);
    const rawTargetY = ownerY + leadY - (forwardY * followDistance) + (rightY * lateralOffset);

    const ownerClearanceRadius = this.computeOwnerClearanceRadius(pet, ownerSpeed);
    return this.constrainPointOutsideOwner(rawTargetX, rawTargetY, ownerX, ownerY, ownerClearanceRadius);
  }

  private computeOwnerClearanceRadius(pet: Pet, ownerSpeed: number): number {
    const baseClearance = pet.followDistance * this.OWNER_CLEARANCE_FOLLOW_MULTIPLIER + pet.stopDistance;
    const speedBoost = this.clamp01(ownerSpeed / 760) * this.OWNER_CLEARANCE_SPEED_BONUS;
    return Math.max(this.OWNER_CLEARANCE_MIN, Math.min(this.OWNER_CLEARANCE_MAX, baseClearance + speedBoost));
  }

  private constrainPointOutsideOwner(targetX: number, targetY: number, ownerX: number, ownerY: number, clearanceRadius: number): { x: number; y: number } {
    const dx = targetX - ownerX;
    const dy = targetY - ownerY;
    const distance = this.getMagnitude(dx, dy);
    if (distance >= clearanceRadius) {
      return { x: targetX, y: targetY };
    }

    if (distance > 0.001) {
      return {
        x: ownerX + (dx / distance) * clearanceRadius,
        y: ownerY + (dy / distance) * clearanceRadius
      };
    }

    return {
      x: ownerX + clearanceRadius,
      y: ownerY
    };
  }

  private updateSmoothedTarget(
    runtime: LocalPetRuntimeState,
    target: { x: number; y: number },
    dtSeconds: number,
    ownerIsStationary: boolean
  ): { x: number; y: number } {
    const dx = target.x - runtime.followTargetX;
    const dy = target.y - runtime.followTargetY;
    const distance = this.getMagnitude(dx, dy);

    if (!Number.isFinite(distance) || distance > this.FOLLOW_TARGET_SNAP_DISTANCE) {
      runtime.followTargetX = target.x;
      runtime.followTargetY = target.y;
      return { x: target.x, y: target.y };
    }

    const filterRate = ownerIsStationary ? this.FOLLOW_TARGET_FILTER_STATIONARY : this.FOLLOW_TARGET_FILTER_MOVING;
    const alpha = this.clamp01(1 - Math.exp(-filterRate * dtSeconds));
    runtime.followTargetX = this.lerp(runtime.followTargetX, target.x, alpha);
    runtime.followTargetY = this.lerp(runtime.followTargetY, target.y, alpha);

    return {
      x: runtime.followTargetX,
      y: runtime.followTargetY
    };
  }

  private moveTowardsTarget(
    runtime: LocalPetRuntimeState,
    target: { x: number; y: number },
    pet: Pet,
    dtSeconds: number
  ): void {
    const dx = target.x - runtime.x;
    const dy = target.y - runtime.y;
    const distance = this.getMagnitude(dx, dy);
    if (!Number.isFinite(distance)) return;

    if (distance > this.SNAP_DISTANCE_PX) {
      runtime.x = target.x;
      runtime.y = target.y;
      runtime.followTargetX = target.x;
      runtime.followTargetY = target.y;
      runtime.currentMoveSpeed = this.PET_BASE_SPEED_PX_PER_SECOND;
      return;
    }

    if (distance <= this.PET_STOP_EPSILON) {
      runtime.x = target.x;
      runtime.y = target.y;
      runtime.currentMoveSpeed = this.PET_BASE_SPEED_PX_PER_SECOND;
      return;
    }

    const catchUpStartDistance = pet.catchUpDistance * this.PET_CATCHUP_START_RATIO;
    const catchUpFullDistance = pet.catchUpDistance * this.PET_CATCHUP_FULL_RATIO;
    const catchUpBlend = this.clamp01(
      (distance - catchUpStartDistance) / Math.max(1, catchUpFullDistance - catchUpStartDistance)
    );

    const targetMoveSpeed = this.lerp(
      this.PET_BASE_SPEED_PX_PER_SECOND,
      this.PET_CATCHUP_SPEED_PX_PER_SECOND,
      catchUpBlend
    );

    const speedRampAlpha = this.clamp01(1 - Math.exp(-this.PET_SPEED_RAMP_RATE * dtSeconds));
    runtime.currentMoveSpeed = this.lerp(runtime.currentMoveSpeed, targetMoveSpeed, speedRampAlpha);

    const slowdownFactor = this.clamp01(distance / this.PET_SLOWDOWN_DISTANCE);
    const speedScale = this.lerp(0.35, 1, slowdownFactor);
    const maxStep = runtime.currentMoveSpeed * speedScale * dtSeconds;
    const step = Math.min(distance, maxStep);

    runtime.x += (dx / distance) * step;
    runtime.y += (dy / distance) * step;
  }

  private getFreshServerState(petEntity: Entity): LocalPetServerState | null {
    const serverState = this.ecs.getComponent(petEntity, LocalPetServerState);
    if (!serverState) return null;
    const sampleAge = Date.now() - serverState.receivedAt;
    if (!Number.isFinite(sampleAge) || sampleAge > this.SERVER_STATE_MAX_AGE_MS) return null;
    return serverState;
  }

  // Reconciliation is no longer called — server-authoritative lerp is inlined in update().
  // Kept as a no-op to avoid breaking any external call sites that may reference it.
  private applyServerReconciliation(_runtime: LocalPetRuntimeState, _serverState: LocalPetServerState | null, _dtSeconds: number): boolean {
    return false;
  }

  private rotateTowardsLikePlayer(currentAngle: number, targetAngle: number, rotationSpeed: number, dtSeconds: number): number {
    const safeCurrentAngle = Number.isFinite(currentAngle) ? currentAngle : 0;
    const safeTargetAngle = Number.isFinite(targetAngle) ? targetAngle : safeCurrentAngle;
    const safeRotationSpeed = Number.isFinite(rotationSpeed) ? rotationSpeed : 5;

    if (safeRotationSpeed > 20) {
      return safeTargetAngle;
    }

    const t = Math.max(0, safeRotationSpeed * dtSeconds);
    const nextAngle = this.lerpAngle(safeCurrentAngle, safeTargetAngle, t);
    const remainingDelta = this.normalizeAngle(safeTargetAngle - nextAngle);
    if (Math.abs(remainingDelta) < 0.05) {
      return safeTargetAngle;
    }

    return nextAngle;
  }

  private cleanupRuntime(activePetEntityId: number): void {
    for (const entityId of this.runtimeByEntityId.keys()) {
      if (entityId !== activePetEntityId) {
        this.runtimeByEntityId.delete(entityId);
      }
    }
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
}
