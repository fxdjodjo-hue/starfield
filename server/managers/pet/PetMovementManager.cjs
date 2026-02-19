const sharedPetConfig = require('../../../shared/pets.json');
const sharedPetMovementTuning = require('../../../shared/pet-movement-tuning.json');
const { normalizePlayerPetState } = require('../../config/PetCatalog.cjs');

const RAW_PET_DEFINITIONS = Array.isArray(sharedPetConfig?.pets) ? sharedPetConfig.pets : [];
const PET_DEFINITION_BY_ID = new Map();

for (const rawDefinition of RAW_PET_DEFINITIONS) {
  const petId = String(rawDefinition?.id || '').trim();
  if (!petId) continue;

  PET_DEFINITION_BY_ID.set(petId, {
    id: petId,
    followDistance: Number.isFinite(Number(rawDefinition?.followDistance))
      ? Math.max(40, Math.floor(Number(rawDefinition.followDistance)))
      : 172,
    lateralOffset: Number.isFinite(Number(rawDefinition?.lateralOffset))
      ? Number(rawDefinition.lateralOffset)
      : 92,
    stopDistance: Number.isFinite(Number(rawDefinition?.stopDistance))
      ? Math.max(0, Math.floor(Number(rawDefinition.stopDistance)))
      : 26,
    catchUpDistance: Number.isFinite(Number(rawDefinition?.catchUpDistance))
      ? Math.max(200, Math.floor(Number(rawDefinition.catchUpDistance)))
      : 760,
    rotationFollowSpeed: Number.isFinite(Number(rawDefinition?.rotationFollowSpeed))
      ? Math.max(0.1, Number(rawDefinition.rotationFollowSpeed))
      : 8,
    hoverAmplitude: Number.isFinite(Number(rawDefinition?.hoverAmplitude))
      ? Math.max(0, Number(rawDefinition.hoverAmplitude))
      : 12,
    hoverFrequency: Number.isFinite(Number(rawDefinition?.hoverFrequency))
      ? Math.max(0, Number(rawDefinition.hoverFrequency))
      : 2.2
  });
}

function resolvePetDefinition(petId) {
  const normalizedPetId = String(petId || '').trim();
  const direct = PET_DEFINITION_BY_ID.get(normalizedPetId);
  if (direct) return direct;

  const first = PET_DEFINITION_BY_ID.values().next();
  if (!first.done) return first.value;

  return {
    id: normalizedPetId || 'pet',
    followDistance: 172,
    lateralOffset: 92,
    stopDistance: 26,
    catchUpDistance: 760,
    rotationFollowSpeed: 8,
    hoverAmplitude: 12,
    hoverFrequency: 2.2
  };
}

function readTuningNumber(source, key, fallback, min = null) {
  const raw = Number(source?.[key]);
  if (!Number.isFinite(raw)) return fallback;
  if (Number.isFinite(min)) return Math.max(min, raw);
  return raw;
}

class PetMovementManager {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.runtimeByPlayerId = new Map();
    this.lastUpdateAt = 0;

    const tuning = (sharedPetMovementTuning && typeof sharedPetMovementTuning === 'object')
      ? sharedPetMovementTuning
      : {};

    this.SNAP_DISTANCE_PX = readTuningNumber(tuning, 'snapDistancePx', 1600, 100);
    this.PET_BASE_SPEED_PX_PER_SECOND = readTuningNumber(tuning, 'petBaseSpeedPxPerSecond', 270, 10);
    this.PET_CATCHUP_SPEED_PX_PER_SECOND = readTuningNumber(tuning, 'petCatchUpSpeedPxPerSecond', 560, 10);
    this.PET_CATCHUP_START_RATIO = readTuningNumber(tuning, 'petCatchUpStartRatio', 0.42, 0);
    this.PET_CATCHUP_FULL_RATIO = Math.max(
      this.PET_CATCHUP_START_RATIO,
      readTuningNumber(tuning, 'petCatchUpFullRatio', 0.88, 0)
    );
    this.PET_SPEED_RAMP_RATE = readTuningNumber(tuning, 'petSpeedRampRate', 7.5, 0.01);
    this.PET_SLOWDOWN_DISTANCE = readTuningNumber(tuning, 'petSlowdownDistance', 130, 1);
    this.PET_STOP_EPSILON = readTuningNumber(tuning, 'petStopEpsilon', 6, 0);
    this.FOLLOW_TARGET_FILTER_MOVING = readTuningNumber(tuning, 'followTargetFilterMoving', 15, 0.01);
    this.FOLLOW_TARGET_FILTER_STATIONARY = readTuningNumber(tuning, 'followTargetFilterStationary', 9, 0.01);
    this.FOLLOW_TARGET_SNAP_DISTANCE = readTuningNumber(tuning, 'followTargetSnapDistance', 900, 1);

    this.FOLLOW_DISTANCE_EXTRA = readTuningNumber(tuning, 'followDistanceExtra', 24);
    this.LATERAL_OFFSET_MULTIPLIER = readTuningNumber(tuning, 'lateralOffsetMultiplier', 1.1, 0);
    this.OWNER_LEAD_TIME = readTuningNumber(tuning, 'ownerLeadTime', 0.18, 0);

    this.OWNER_CLEARANCE_MIN = readTuningNumber(tuning, 'ownerClearanceMin', 130, 1);
    this.OWNER_CLEARANCE_MAX = readTuningNumber(tuning, 'ownerClearanceMax', 230, this.OWNER_CLEARANCE_MIN);
    this.OWNER_CLEARANCE_FOLLOW_MULTIPLIER = readTuningNumber(tuning, 'ownerClearanceFollowMultiplier', 0.82, 0);
    this.OWNER_CLEARANCE_SPEED_BONUS = readTuningNumber(tuning, 'ownerClearanceSpeedBonus', 20, 0);
    this.OWNER_STATIONARY_SPEED_THRESHOLD = readTuningNumber(tuning, 'ownerStationarySpeedThreshold', 28, 0);

    this.PET_DEFENSE_SPEED_BOOST = readTuningNumber(tuning, 'petDefenseSpeedBoost', 1.28, 0.1);
    this.PET_DEFENSE_TARGET_FILTER = readTuningNumber(tuning, 'petDefenseTargetFilter', 26, 0.01);
    this.PET_DEFENSE_SLOWDOWN_DISTANCE = readTuningNumber(tuning, 'petDefenseSlowdownDistance', 92, 1);
    this.PET_DEFENSE_ORBIT_RADIUS = readTuningNumber(tuning, 'petDefenseOrbitRadius', 260, 1);
  }

  update(now = Date.now()) {
    const dtSeconds = this.resolveDeltaSeconds(now);
    if (dtSeconds <= 0) return;

    const players = this.mapServer?.players;
    if (!(players instanceof Map) || players.size === 0) return;

    const activePlayerIds = new Set();

    for (const [clientId, playerData] of players.entries()) {
      const playerId = this.resolvePlayerId(clientId, playerData);
      if (!playerId) continue;

      activePlayerIds.add(playerId);
      this.updatePlayerPetPosition(playerId, playerData, dtSeconds);
    }

    for (const trackedPlayerId of this.runtimeByPlayerId.keys()) {
      if (!activePlayerIds.has(trackedPlayerId)) {
        this.runtimeByPlayerId.delete(trackedPlayerId);
      }
    }
  }

  removePlayer(clientId) {
    const normalizedClientId = String(clientId || '').trim();
    if (!normalizedClientId) return;

    this.runtimeByPlayerId.delete(normalizedClientId);

    const players = this.mapServer?.players;
    if (!(players instanceof Map)) return;
    for (const [candidateClientId, playerData] of players.entries()) {
      if (String(candidateClientId || '').trim() !== normalizedClientId) continue;
      const normalizedPlayerId = String(playerData?.clientId || '').trim();
      if (normalizedPlayerId) {
        this.runtimeByPlayerId.delete(normalizedPlayerId);
      }
      break;
    }
  }

  resolveDeltaSeconds(now) {
    const safeNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    if (!Number.isFinite(this.lastUpdateAt) || this.lastUpdateAt <= 0) {
      this.lastUpdateAt = safeNow;
      return 0.05;
    }

    const deltaMs = safeNow - this.lastUpdateAt;
    this.lastUpdateAt = safeNow;
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0.05;
    return Math.max(0.01, Math.min(0.1, deltaMs / 1000));
  }

  resolvePlayerId(clientId, playerData) {
    const byPlayerData = String(playerData?.clientId || '').trim();
    if (byPlayerData) return byPlayerData;

    const byClientId = String(clientId || '').trim();
    if (byClientId) return byClientId;
    return null;
  }

  updatePlayerPetPosition(playerId, playerData, dtSeconds) {
    if (!playerData || typeof playerData !== 'object') return;

    const normalizedPetState = normalizePlayerPetState(playerData.petState);
    playerData.petState = normalizedPetState;

    const petId = String(normalizedPetState?.petId || '').trim();
    const petIsActive = petId.length > 0 && normalizedPetState.isActive !== false && !playerData.isDead;
    if (!petIsActive) {
      playerData.petPosition = null;
      this.runtimeByPlayerId.delete(playerId);
      return;
    }

    const playerPosition = this.resolvePlayerPosition(playerData);
    if (!playerPosition) return;

    const petDefinition = resolvePetDefinition(petId);
    const runtime = this.getOrCreateRuntimeState(playerId, playerData.petPosition, playerPosition, petDefinition);
    const targetState = this.resolvePetTargetState(playerId, playerData, playerPosition, petDefinition);
    const smoothedTarget = this.updateSmoothedTarget(
      runtime,
      targetState.target,
      dtSeconds,
      targetState.isDefense,
      targetState.ownerIsStationary
    );

    const previousX = runtime.x;
    const previousY = runtime.y;

    this.moveTowardsTarget(runtime, smoothedTarget, petDefinition, dtSeconds, targetState.isDefense);

    const frameMoveX = runtime.x - previousX;
    const frameMoveY = runtime.y - previousY;
    const frameMoveDistance = this.getMagnitude(frameMoveX, frameMoveY);
    const frameMoveSpeed = dtSeconds > 0 ? frameMoveDistance / dtSeconds : 0;

    let targetRotation = runtime.rotation;
    if (targetState.lookAt) {
      const lookDx = targetState.lookAt.x - runtime.x;
      const lookDy = targetState.lookAt.y - runtime.y;
      if (this.getMagnitude(lookDx, lookDy) > 0.001) {
        targetRotation = Math.atan2(lookDy, lookDx);
      }
    } else if (!targetState.ownerIsStationary && frameMoveSpeed > 1 && frameMoveDistance > 0.001) {
      targetRotation = Math.atan2(frameMoveY, frameMoveX);
    }

    runtime.rotation = this.rotateTowardsLikePlayer(
      runtime.rotation,
      targetRotation,
      petDefinition.rotationFollowSpeed,
      dtSeconds
    );

    runtime.rotationHeadingX = Math.cos(runtime.rotation);
    runtime.rotationHeadingY = Math.sin(runtime.rotation);

    playerData.petPosition = {
      x: runtime.x,
      y: runtime.y,
      rotation: runtime.rotation
    };
  }

  resolvePlayerPosition(playerData) {
    const x = Number(playerData?.position?.x ?? playerData?.x);
    const y = Number(playerData?.position?.y ?? playerData?.y);
    const rotation = Number(playerData?.position?.rotation ?? playerData?.rotation);
    const velocityX = Number(playerData?.position?.velocityX ?? playerData?.velocityX ?? 0);
    const velocityY = Number(playerData?.position?.velocityY ?? playerData?.velocityY ?? 0);

    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    return {
      x,
      y,
      rotation: Number.isFinite(rotation) ? rotation : 0,
      velocityX: Number.isFinite(velocityX) ? velocityX : 0,
      velocityY: Number.isFinite(velocityY) ? velocityY : 0
    };
  }

  getOrCreateRuntimeState(playerId, rawPetPosition, playerPosition, petDefinition) {
    const existing = this.runtimeByPlayerId.get(playerId);
    if (existing) return existing;

    const initial = this.resolveInitialPetPosition(rawPetPosition, playerPosition, petDefinition);
    const initialRotation = Number.isFinite(initial.rotation) ? initial.rotation : playerPosition.rotation;
    const runtime = {
      x: initial.x,
      y: initial.y,
      rotation: initialRotation,
      currentMoveSpeed: this.PET_BASE_SPEED_PX_PER_SECOND,
      followTargetX: initial.x,
      followTargetY: initial.y,
      rotationHeadingX: Math.cos(initialRotation),
      rotationHeadingY: Math.sin(initialRotation)
    };

    this.runtimeByPlayerId.set(playerId, runtime);
    return runtime;
  }

  resolveInitialPetPosition(rawPetPosition, playerPosition, petDefinition) {
    const petX = Number(rawPetPosition?.x);
    const petY = Number(rawPetPosition?.y);
    const petRotation = Number(rawPetPosition?.rotation);
    if (Number.isFinite(petX) && Number.isFinite(petY)) {
      return {
        x: petX,
        y: petY,
        rotation: Number.isFinite(petRotation) ? petRotation : playerPosition.rotation
      };
    }

    const ownerRotation = Number.isFinite(playerPosition.rotation) ? playerPosition.rotation : 0;
    const forwardX = Math.cos(ownerRotation);
    const forwardY = Math.sin(ownerRotation);
    const rightX = -forwardY;
    const rightY = forwardX;

    const followDistance = petDefinition.followDistance + this.FOLLOW_DISTANCE_EXTRA;
    const lateralOffset = petDefinition.lateralOffset * this.LATERAL_OFFSET_MULTIPLIER;

    return {
      x: playerPosition.x - (forwardX * followDistance) + (rightX * lateralOffset),
      y: playerPosition.y - (forwardY * followDistance) + (rightY * lateralOffset),
      rotation: ownerRotation
    };
  }

  resolvePetTargetState(playerId, playerData, playerPosition, petDefinition) {
    const ownerVelocityX = Number.isFinite(playerPosition.velocityX) ? playerPosition.velocityX : 0;
    const ownerVelocityY = Number.isFinite(playerPosition.velocityY) ? playerPosition.velocityY : 0;
    const ownerSpeed = this.getMagnitude(ownerVelocityX, ownerVelocityY);
    const isOwnerStationary = ownerSpeed <= this.OWNER_STATIONARY_SPEED_THRESHOLD;

    const defenseNpcId = this.mapServer?.petModuleManager?.getDefenseTargetNpcId?.(playerId);
    if (defenseNpcId) {
      const defenseNpc = this.mapServer?.npcManager?.getNpc?.(defenseNpcId);
      if (defenseNpc?.position) {
        const npcX = Number(defenseNpc.position.x);
        const npcY = Number(defenseNpc.position.y);
        if (Number.isFinite(npcX) && Number.isFinite(npcY)) {
          const awayX = playerPosition.x - npcX;
          const awayY = playerPosition.y - npcY;
          const awayLength = this.getMagnitude(awayX, awayY);
          const safeLength = awayLength > 0.001 ? awayLength : 1;

          return {
            target: {
              x: npcX + (awayX / safeLength) * this.PET_DEFENSE_ORBIT_RADIUS,
              y: npcY + (awayY / safeLength) * this.PET_DEFENSE_ORBIT_RADIUS
            },
            lookAt: { x: npcX, y: npcY },
            isDefense: true,
            ownerIsStationary: isOwnerStationary
          };
        }
      }
    }

    const collectTarget = this.resolveCollectTarget(playerData);
    if (collectTarget) {
      return {
        target: collectTarget,
        lookAt: null,
        isDefense: false,
        ownerIsStationary: isOwnerStationary
      };
    }

    const ownerRotation = Number.isFinite(playerPosition.rotation) ? playerPosition.rotation : 0;

    const forwardX = Math.cos(ownerRotation);
    const forwardY = Math.sin(ownerRotation);
    const rightX = -forwardY;
    const rightY = forwardX;
    const leadX = isOwnerStationary ? 0 : ownerVelocityX * this.OWNER_LEAD_TIME;
    const leadY = isOwnerStationary ? 0 : ownerVelocityY * this.OWNER_LEAD_TIME;

    const followDistance = petDefinition.followDistance + this.FOLLOW_DISTANCE_EXTRA;
    const lateralOffset = petDefinition.lateralOffset * this.LATERAL_OFFSET_MULTIPLIER;

    const rawTargetX = playerPosition.x + leadX - (forwardX * followDistance) + (rightX * lateralOffset);
    const rawTargetY = playerPosition.y + leadY - (forwardY * followDistance) + (rightY * lateralOffset);

    const ownerClearanceRadius = this.computeOwnerClearanceRadius(petDefinition, ownerSpeed);
    let constrainedTarget = this.constrainPointOutsideOwner(
      rawTargetX,
      rawTargetY,
      playerPosition.x,
      playerPosition.y,
      ownerClearanceRadius
    );

    if (isOwnerStationary && petDefinition.hoverAmplitude > 0 && petDefinition.hoverFrequency > 0) {
      const idleOscillation = Math.sin(Date.now() * 0.001 * petDefinition.hoverFrequency);
      const idleOffset = idleOscillation * Math.min(10, petDefinition.hoverAmplitude * 0.5);
      constrainedTarget = this.constrainPointOutsideOwner(
        constrainedTarget.x + (rightX * idleOffset),
        constrainedTarget.y + (rightY * idleOffset),
        playerPosition.x,
        playerPosition.y,
        ownerClearanceRadius
      );
    }

    return {
      target: constrainedTarget,
      lookAt: null,
      isDefense: false,
      ownerIsStationary: isOwnerStationary
    };
  }

  resolveCollectTarget(playerData) {
    const resourceManager = this.mapServer?.resourceManager;
    if (!resourceManager || typeof resourceManager.getPetAutoCollectTarget !== 'function') {
      return null;
    }

    const collectTarget = resourceManager.getPetAutoCollectTarget(playerData);
    const targetX = Number(collectTarget?.x);
    const targetY = Number(collectTarget?.y);
    if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
      return null;
    }

    return {
      x: targetX,
      y: targetY
    };
  }

  computeOwnerClearanceRadius(petDefinition, ownerSpeed) {
    const baseClearance = petDefinition.followDistance * this.OWNER_CLEARANCE_FOLLOW_MULTIPLIER + petDefinition.stopDistance;
    const speedBoost = this.clamp01(ownerSpeed / 760) * this.OWNER_CLEARANCE_SPEED_BONUS;
    return Math.max(this.OWNER_CLEARANCE_MIN, Math.min(this.OWNER_CLEARANCE_MAX, baseClearance + speedBoost));
  }

  constrainPointOutsideOwner(targetX, targetY, ownerX, ownerY, clearanceRadius) {
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

  updateSmoothedTarget(runtime, target, dtSeconds, isDefenseTarget, ownerIsStationary) {
    const dx = target.x - runtime.followTargetX;
    const dy = target.y - runtime.followTargetY;
    const distance = this.getMagnitude(dx, dy);

    if (!Number.isFinite(distance) || distance > this.FOLLOW_TARGET_SNAP_DISTANCE) {
      runtime.followTargetX = target.x;
      runtime.followTargetY = target.y;
      return { x: target.x, y: target.y };
    }

    const stationaryOwner = ownerIsStationary === true;
    const filterRate = isDefenseTarget
      ? this.PET_DEFENSE_TARGET_FILTER
      : (stationaryOwner ? this.FOLLOW_TARGET_FILTER_STATIONARY : this.FOLLOW_TARGET_FILTER_MOVING);
    const alpha = this.clamp01(1 - Math.exp(-filterRate * dtSeconds));

    runtime.followTargetX = this.lerp(runtime.followTargetX, target.x, alpha);
    runtime.followTargetY = this.lerp(runtime.followTargetY, target.y, alpha);
    return {
      x: runtime.followTargetX,
      y: runtime.followTargetY
    };
  }

  moveTowardsTarget(runtime, target, petDefinition, dtSeconds, isDefenseTarget) {
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

    const catchUpStartDistance = petDefinition.catchUpDistance * this.PET_CATCHUP_START_RATIO;
    const catchUpFullDistance = petDefinition.catchUpDistance * this.PET_CATCHUP_FULL_RATIO;
    const catchUpBlend = this.clamp01(
      (distance - catchUpStartDistance) / Math.max(1, catchUpFullDistance - catchUpStartDistance)
    );

    const moveSpeedBoost = isDefenseTarget ? this.PET_DEFENSE_SPEED_BOOST : 1;
    const targetMoveSpeed = this.lerp(
      this.PET_BASE_SPEED_PX_PER_SECOND,
      this.PET_CATCHUP_SPEED_PX_PER_SECOND,
      catchUpBlend
    ) * moveSpeedBoost;

    const speedRampAlpha = this.clamp01(1 - Math.exp(-this.PET_SPEED_RAMP_RATE * dtSeconds));
    runtime.currentMoveSpeed = this.lerp(runtime.currentMoveSpeed, targetMoveSpeed, speedRampAlpha);

    const slowdownDistance = isDefenseTarget ? this.PET_DEFENSE_SLOWDOWN_DISTANCE : this.PET_SLOWDOWN_DISTANCE;
    const slowdownFactor = this.clamp01(distance / slowdownDistance);
    const speedScale = this.lerp(0.35, 1, slowdownFactor);
    const maxStep = runtime.currentMoveSpeed * speedScale * dtSeconds;
    const step = Math.min(distance, maxStep);

    runtime.x += (dx / distance) * step;
    runtime.y += (dy / distance) * step;
  }

  rotateTowardsLikePlayer(currentAngle, targetAngle, rotationSpeed, dtSeconds) {
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

  getMagnitude(x, y) {
    return Math.hypot(x, y);
  }

  lerp(start, end, factor) {
    const safeFactor = this.clamp01(factor);
    return start + (end - start) * safeFactor;
  }

  clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  lerpAngle(current, target, factor) {
    const normalizedCurrent = Number.isFinite(current) ? current : 0;
    const normalizedTarget = Number.isFinite(target) ? target : 0;
    const wrappedDelta = this.normalizeAngle(normalizedTarget - normalizedCurrent);
    return normalizedCurrent + wrappedDelta * this.clamp01(factor);
  }

  normalizeAngle(angle) {
    const twoPi = Math.PI * 2;
    let normalized = angle % twoPi;
    if (normalized > Math.PI) normalized -= twoPi;
    if (normalized < -Math.PI) normalized += twoPi;
    return normalized;
  }
}

module.exports = PetMovementManager;
