import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { AnimatedSprite } from '../../entities/AnimatedSprite';
import { ResourceNode } from '../../entities/spatial/ResourceNode';
import { ResourceCollectEffect } from '../../entities/spatial/ResourceCollectEffect';
import { ProjectileVisualState } from '../../entities/combat/ProjectileVisualState';
import { getResourceDefinition } from '../../config/ResourceConfig';
import type { ClientNetworkSystem } from '../../multiplayer/client/ClientNetworkSystem';

export interface ResourceNodeSnapshot {
  id: string;
  resourceType: string;
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
}

interface ResourceCollectEffectState {
  entity: Entity;
  elapsedMs: number;
  durationMs: number;
  frameDurationMs: number;
  resourceId: string | null;
}

interface PendingResourceRemovalState {
  entity: Entity;
  elapsedMs: number;
  durationMs: number;
}

export class ResourceInteractionSystem extends BaseSystem {
  private readonly resourceEntities: Map<string, Entity> = new Map();
  private readonly resourceSprites: Map<string, AnimatedSprite> = new Map();
  private readonly pendingCollectRequests: Map<string, number> = new Map();
  private readonly activeCollectEffects: Map<number, ResourceCollectEffectState> = new Map();
  private readonly collectEffectByResourceId: Map<string, number> = new Map();
  private readonly completedCollectionResourceIds: Set<string> = new Set();
  private readonly pendingResourceRemovals: Map<string, PendingResourceRemovalState> = new Map();
  private clientNetworkSystem: ClientNetworkSystem | null = null;
  private movePlayerToCallback: ((worldX: number, worldY: number, stopDistancePx?: number) => void) | null = null;
  private stopPlayerMovementCallback: (() => void) | null = null;
  private playerPositionResolver: (() => { x: number; y: number } | null) | null = null;
  private collectEffectSprite: AnimatedSprite | null = null;
  private activeCollectTargetResourceId: string | null = null;
  private collectMovementLockResourceId: string | null = null;
  private collectMovementLockUntilMs: number = 0;
  private lastMoveCommandAtMs: number = 0;

  private readonly PENDING_REQUEST_TTL_MS = 1600;
  private readonly RESOURCE_ROTATION_TARGET_FPS = 24;
  private readonly COLLECT_EFFECT_FRAME_DURATION_MS = 55;
  private readonly MOVE_COMMAND_INTERVAL_MS = 220;
  private readonly ALIGNMENT_DISTANCE_PX = 1;
  private readonly RESOURCE_APPROACH_STOP_DISTANCE_PX = 8;
  private readonly COLLECT_DISTANCE_TOLERANCE_PX = 8;
  private readonly RESOURCE_COLLECT_ANCHOR_OFFSET_Y = 100;
  private readonly RESOURCE_COLLECT_CHANNEL_EFFECT_SCALE = 1.6;
  private readonly RESOURCE_COLLECT_CHANNEL_EFFECT_MIDPOINT_RATIO = 0.5;
  private readonly COLLECT_MOVEMENT_LOCK_DURATION_MS = 2400;
  private readonly RESOURCE_REMOVAL_FADE_DURATION_MS = 260;

  constructor(ecs: ECS) {
    super(ecs);
  }

  update(deltaTime: number): void {
    this.animateResourceNodes(deltaTime);
    this.animateCargoBoxes(deltaTime);
    this.processActiveCollectTarget();
    this.processActiveCargoBoxCollectTarget();
    this.animateCollectEffects(deltaTime);
    this.processPendingResourceRemovals(deltaTime);
    this.cleanupPendingCollectRequests();
  }

  setClientNetworkSystem(clientNetworkSystem: ClientNetworkSystem | null): void {
    this.clientNetworkSystem = clientNetworkSystem;
  }

  setMovePlayerToCallback(callback: ((worldX: number, worldY: number, stopDistancePx?: number) => void) | null): void {
    this.movePlayerToCallback = callback;
  }

  setStopPlayerMovementCallback(callback: (() => void) | null): void {
    this.stopPlayerMovementCallback = callback;
  }

  setPlayerPositionResolver(resolver: (() => { x: number; y: number } | null) | null): void {
    this.playerPositionResolver = resolver;
  }

  setCollectEffectSprite(sprite: AnimatedSprite | null): void {
    this.collectEffectSprite = sprite;
  }

  isResourceHovered(worldX: number, worldY: number): boolean {
    return !!this.findClosestResource(worldX, worldY);
  }

  registerResourceSprite(resourceType: string, sprite: AnimatedSprite): void {
    if (!resourceType || !sprite) return;
    this.resourceSprites.set(resourceType, sprite);
  }

  syncResources(nodes: ResourceNodeSnapshot[] | null | undefined): void {
    this.clearAllResources();
    if (!Array.isArray(nodes)) return;

    for (const node of nodes) {
      this.createResourceEntity(node);
    }
  }

  clearAllResources(): void {
    for (const entity of this.resourceEntities.values()) {
      if (this.ecs.entityExists(entity.id)) {
        this.ecs.removeEntity(entity);
      }
    }
    for (const removalState of this.pendingResourceRemovals.values()) {
      if (this.ecs.entityExists(removalState.entity.id)) {
        this.ecs.removeEntity(removalState.entity);
      }
    }
    this.clearCollectEffects();
    this.resourceEntities.clear();
    this.pendingResourceRemovals.clear();
    this.pendingCollectRequests.clear();
    this.completedCollectionResourceIds.clear();
    this.activeCollectTargetResourceId = null;
    this.collectMovementLockResourceId = null;
    this.collectMovementLockUntilMs = 0;
    this.clearAllCargoBoxes();
  }

  removeResource(resourceId: string, worldX?: number, worldY?: number): void {
    if (this.pendingResourceRemovals.has(resourceId)) {
      this.resourceEntities.delete(resourceId);
      this.pendingCollectRequests.delete(resourceId);
      this.completedCollectionResourceIds.delete(resourceId);
      if (this.activeCollectTargetResourceId === resourceId) {
        this.activeCollectTargetResourceId = null;
      }
      return;
    }

    const suppressRemovalEffect = this.completedCollectionResourceIds.has(resourceId);
    if (suppressRemovalEffect) {
      this.completedCollectionResourceIds.delete(resourceId);
    }

    const hadCollectChannelEffect = this.collectEffectByResourceId.has(resourceId);
    if (hadCollectChannelEffect) {
      this.removeCollectEffectForResource(resourceId);
    }

    const entity = this.resourceEntities.get(resourceId);
    let effectX = Number(worldX);
    let effectY = Number(worldY);

    if (entity) {
      const transform = this.ecs.getComponent(entity, Transform);
      if ((!Number.isFinite(effectX) || !Number.isFinite(effectY)) && transform) {
        effectX = transform.x;
        effectY = transform.y;
      }

    }

    if (this.activeCollectTargetResourceId === resourceId) {
      this.activeCollectTargetResourceId = null;
    }
    if (this.collectMovementLockResourceId === resourceId) {
      this.collectMovementLockResourceId = null;
      this.collectMovementLockUntilMs = 0;
    }

    this.resourceEntities.delete(resourceId);
    this.pendingCollectRequests.delete(resourceId);

    const shouldSpawnRemovalEffect = !suppressRemovalEffect && !hadCollectChannelEffect;
    const effectDurationMs = shouldSpawnRemovalEffect && Number.isFinite(effectX) && Number.isFinite(effectY)
      ? this.spawnCollectEffect(effectX, effectY)
      : null;

    if (entity && this.ecs.entityExists(entity.id)) {
      this.startPendingResourceRemoval(
        resourceId,
        entity,
        effectDurationMs ?? this.RESOURCE_REMOVAL_FADE_DURATION_MS
      );
    }
  }

  handleCollectionStatus(message: {
    status?: string;
    resourceId?: string;
    remainingMs?: number;
  }): void {
    const resourceId = typeof message?.resourceId === 'string' ? message.resourceId : '';
    if (!resourceId) return;

    const status = String(message?.status || '').toLowerCase();
    if (!status) return;

    if (status === 'started' || status === 'in_progress') {
      this.completedCollectionResourceIds.delete(resourceId);
      const resourceTransform = this.getResourceTransform(resourceId);
      if (!resourceTransform) return;
      const collectEffectPosition = this.getCollectChannelEffectPosition(resourceTransform);

      const durationMs = Number.isFinite(Number(message?.remainingMs))
        ? Math.max(200, Math.floor(Number(message.remainingMs)))
        : undefined;

      const now = Date.now();
      this.collectMovementLockResourceId = resourceId;
      this.collectMovementLockUntilMs = now + (durationMs || this.COLLECT_MOVEMENT_LOCK_DURATION_MS);

      this.spawnCollectEffect(
        collectEffectPosition.x,
        collectEffectPosition.y,
        resourceId,
        durationMs
      );
      return;
    }

    if (status === 'interrupted') {
      this.completedCollectionResourceIds.delete(resourceId);
      this.pendingCollectRequests.delete(resourceId);
      if (this.activeCollectTargetResourceId === resourceId) {
        this.activeCollectTargetResourceId = null;
      }
      if (this.collectMovementLockResourceId === resourceId) {
        this.collectMovementLockResourceId = null;
        this.collectMovementLockUntilMs = 0;
      }
      this.removeCollectEffectForResource(resourceId);
      return;
    }

    if (status === 'completed') {
      this.completedCollectionResourceIds.add(resourceId);
      this.pendingCollectRequests.delete(resourceId);
      if (this.activeCollectTargetResourceId === resourceId) {
        this.activeCollectTargetResourceId = null;
      }
      if (this.collectMovementLockResourceId === resourceId) {
        this.collectMovementLockResourceId = null;
        this.collectMovementLockUntilMs = 0;
      }
      this.removeCollectEffectForResource(resourceId);
    }
  }

  handleMouseClick(worldX: number, worldY: number): boolean {
    this.cleanupPendingCollectRequests();

    const closest = this.findClosestResource(worldX, worldY);
    if (!closest) {
      return this.handleCargoBoxMouseClick(worldX, worldY);
    }

    const lastRequestTime = this.pendingCollectRequests.get(closest.resourceId);
    const now = Date.now();
    if (lastRequestTime && now - lastRequestTime < this.PENDING_REQUEST_TTL_MS) {
      return true;
    }

    if (!this.clientNetworkSystem || !this.clientNetworkSystem.isConnected()) {
      return false;
    }

    const targetTransform = this.getResourceTransform(closest.resourceId);
    if (!targetTransform) return false;
    const collectAnchor = this.getCollectAnchor(targetTransform);

    this.activeCollectTargetResourceId = closest.resourceId;
    this.issueMoveCommand(
      collectAnchor.x,
      collectAnchor.y,
      true,
      this.RESOURCE_APPROACH_STOP_DISTANCE_PX
    );
    return true;
  }

  private createResourceEntity(node: ResourceNodeSnapshot): void {
    if (!node || typeof node.id !== 'string' || typeof node.resourceType !== 'string') return;
    if (!Number.isFinite(Number(node.x)) || !Number.isFinite(Number(node.y))) return;

    const definition = getResourceDefinition(node.resourceType);
    if (!definition) return;

    const sprite = this.resourceSprites.get(definition.id);
    if (!sprite) return;

    const scale = Number.isFinite(Number(node.scale))
      ? Math.max(0.1, Number(node.scale))
      : 1;

    const entity = this.ecs.createEntity();
    this.ecs.addComponent(
      entity,
      Transform,
      new Transform(
        Number(node.x),
        Number(node.y),
        Number(node.rotation || 0),
        scale,
        scale
      )
    );
    this.ecs.addComponent(entity, AnimatedSprite, sprite);
    this.ecs.addComponent(
      entity,
      ResourceNode,
      new ResourceNode(
        node.id,
        definition.id,
        definition.clickRadius,
        definition.collectDistance,
        definition.debugHitbox === true
      )
    );

    this.resourceEntities.set(node.id, entity);
  }

  private findClosestResource(worldX: number, worldY: number): { resourceId: string; distanceSq: number } | null {
    let result: { resourceId: string; distanceSq: number } | null = null;

    for (const [resourceId, entity] of this.resourceEntities.entries()) {
      if (!this.ecs.entityExists(entity.id)) {
        this.resourceEntities.delete(resourceId);
        this.pendingCollectRequests.delete(resourceId);
        continue;
      }

      const transform = this.ecs.getComponent(entity, Transform);
      const resourceNode = this.ecs.getComponent(entity, ResourceNode);
      if (!transform || !resourceNode) continue;

      const dx = worldX - transform.x;
      const dy = worldY - transform.y;
      const distanceSq = dx * dx + dy * dy;
      const maxDistanceSq = resourceNode.clickRadius * resourceNode.clickRadius;
      if (distanceSq > maxDistanceSq) continue;

      if (!result || distanceSq < result.distanceSq) {
        result = { resourceId, distanceSq };
      }
    }

    return result;
  }

  private cleanupPendingCollectRequests(): void {
    const now = Date.now();
    for (const [resourceId, requestedAt] of this.pendingCollectRequests.entries()) {
      if (now - requestedAt > this.PENDING_REQUEST_TTL_MS) {
        this.pendingCollectRequests.delete(resourceId);
      }
    }
  }

  private processActiveCollectTarget(): void {
    if (!this.activeCollectTargetResourceId) return;
    if (!this.clientNetworkSystem || !this.clientNetworkSystem.isConnected()) return;

    const resourceEntity = this.resourceEntities.get(this.activeCollectTargetResourceId);
    if (!resourceEntity || !this.ecs.entityExists(resourceEntity.id)) {
      this.pendingCollectRequests.delete(this.activeCollectTargetResourceId);
      if (this.collectMovementLockResourceId === this.activeCollectTargetResourceId) {
        this.collectMovementLockResourceId = null;
        this.collectMovementLockUntilMs = 0;
      }
      this.activeCollectTargetResourceId = null;
      return;
    }

    const resourceTransform = this.ecs.getComponent(resourceEntity, Transform);
    const resourceNode = this.ecs.getComponent(resourceEntity, ResourceNode);
    if (!resourceTransform || !resourceNode) {
      this.pendingCollectRequests.delete(this.activeCollectTargetResourceId);
      if (this.collectMovementLockResourceId === this.activeCollectTargetResourceId) {
        this.collectMovementLockResourceId = null;
        this.collectMovementLockUntilMs = 0;
      }
      this.activeCollectTargetResourceId = null;
      return;
    }

    const playerPosition = this.resolvePlayerWorldPosition();
    if (!playerPosition) return;
    const collectAnchor = this.getCollectAnchor(resourceTransform);
    const now = Date.now();

    const collectDistance = this.ALIGNMENT_DISTANCE_PX + this.COLLECT_DISTANCE_TOLERANCE_PX;

    const dx = collectAnchor.x - playerPosition.x;
    const dy = collectAnchor.y - playerPosition.y;
    const distanceSq = dx * dx + dy * dy;
    const collectDistanceSq = collectDistance * collectDistance;

    if (distanceSq <= collectDistanceSq) {
      // Stop active click-to-move target to avoid jitter while collecting.
      if (this.stopPlayerMovementCallback) {
        this.stopPlayerMovementCallback();
      }

      const lastRequestTime = this.pendingCollectRequests.get(this.activeCollectTargetResourceId);
      if (!lastRequestTime || now - lastRequestTime >= this.PENDING_REQUEST_TTL_MS) {
        this.pendingCollectRequests.set(this.activeCollectTargetResourceId, now);
        this.collectMovementLockResourceId = this.activeCollectTargetResourceId;
        this.collectMovementLockUntilMs = now + this.COLLECT_MOVEMENT_LOCK_DURATION_MS;
        this.clientNetworkSystem.sendResourceCollectRequest(this.activeCollectTargetResourceId);
      }
      return;
    }

    const isMovementLockedForCollect = (
      this.collectMovementLockResourceId === this.activeCollectTargetResourceId &&
      now < this.collectMovementLockUntilMs
    );
    if (isMovementLockedForCollect) {
      return;
    }

    this.issueMoveCommand(
      collectAnchor.x,
      collectAnchor.y,
      false,
      this.RESOURCE_APPROACH_STOP_DISTANCE_PX
    );
  }

  private animateResourceNodes(deltaTime: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) return;

    const fullTurn = Math.PI * 2;

    for (const [resourceId, entity] of this.resourceEntities.entries()) {
      if (!this.ecs.entityExists(entity.id)) {
        this.resourceEntities.delete(resourceId);
        this.pendingCollectRequests.delete(resourceId);
        if (this.activeCollectTargetResourceId === resourceId) {
          this.activeCollectTargetResourceId = null;
        }
        continue;
      }

      const transform = this.ecs.getComponent(entity, Transform);
      if (!transform) continue;

      const animatedSprite = this.ecs.getComponent(entity, AnimatedSprite);
      const frameCount = Math.max(1, Number(animatedSprite?.frameCount || 1));
      const rotationsPerSecond = this.RESOURCE_ROTATION_TARGET_FPS / frameCount;
      const rotationStep = rotationsPerSecond * fullTurn * (deltaTime / 1000);

      let nextRotation = Number(transform.rotation || 0) + rotationStep;
      if (nextRotation >= fullTurn) {
        nextRotation %= fullTurn;
      }
      transform.rotation = nextRotation;
    }
  }

  private getResourceTransform(resourceId: string): Transform | null {
    const entity = this.resourceEntities.get(resourceId);
    if (!entity || !this.ecs.entityExists(entity.id)) return null;
    return this.ecs.getComponent(entity, Transform) || null;
  }

  private getCollectAnchor(resourceTransform: Transform): { x: number; y: number } {
    return {
      x: resourceTransform.x,
      y: resourceTransform.y - this.RESOURCE_COLLECT_ANCHOR_OFFSET_Y
    };
  }

  private getCollectChannelEffectPosition(resourceTransform: Transform): { x: number; y: number } {
    const collectAnchor = this.getCollectAnchor(resourceTransform);
    const t = Math.max(
      0,
      Math.min(1, Number(this.RESOURCE_COLLECT_CHANNEL_EFFECT_MIDPOINT_RATIO || 0.5))
    );
    return {
      x: collectAnchor.x + (resourceTransform.x - collectAnchor.x) * t,
      y: collectAnchor.y + (resourceTransform.y - collectAnchor.y) * t
    };
  }

  private resolvePlayerWorldPosition(): { x: number; y: number } | null {
    if (this.playerPositionResolver) {
      const resolved = this.playerPositionResolver();
      if (
        resolved &&
        Number.isFinite(Number(resolved.x)) &&
        Number.isFinite(Number(resolved.y))
      ) {
        return { x: Number(resolved.x), y: Number(resolved.y) };
      }
    }

    const playerEntity = this.ecs.getPlayerEntity();
    if (!playerEntity) return null;

    const transform = this.ecs.getComponent(playerEntity, Transform);
    if (!transform) return null;

    return { x: transform.x, y: transform.y };
  }

  private issueMoveCommand(
    worldX: number,
    worldY: number,
    force: boolean = false,
    stopDistancePx?: number
  ): void {
    if (!this.movePlayerToCallback) return;

    const now = Date.now();
    if (!force && now - this.lastMoveCommandAtMs < this.MOVE_COMMAND_INTERVAL_MS) {
      return;
    }

    this.lastMoveCommandAtMs = now;
    this.movePlayerToCallback(worldX, worldY, stopDistancePx);
  }

  private spawnCollectEffect(
    worldX: number,
    worldY: number,
    resourceId: string | null = null,
    durationOverrideMs?: number
  ): number | null {
    if (!this.collectEffectSprite) return null;

    if (resourceId) {
      this.removeCollectEffectForResource(resourceId);
    }

    const isChannelEffect = typeof resourceId === 'string' && resourceId.length > 0;
    const effectScale = isChannelEffect ? this.RESOURCE_COLLECT_CHANNEL_EFFECT_SCALE : 1;

    const entity = this.ecs.createEntity();
    this.ecs.addComponent(entity, Transform, new Transform(worldX, worldY, 0, effectScale, effectScale));
    this.ecs.addComponent(entity, AnimatedSprite, this.collectEffectSprite);
    this.ecs.addComponent(entity, ResourceCollectEffect, new ResourceCollectEffect('resource_collect', 0));
    const frameCount = Math.max(1, Number(this.collectEffectSprite.frameCount || 1));
    const frameDurationMs = Math.max(16, this.COLLECT_EFFECT_FRAME_DURATION_MS);
    const defaultDurationMs = Math.max(frameDurationMs, frameCount * frameDurationMs);
    const durationMs = Number.isFinite(Number(durationOverrideMs))
      ? Math.max(frameDurationMs, Math.floor(Number(durationOverrideMs)))
      : defaultDurationMs;

    this.activeCollectEffects.set(entity.id, {
      entity,
      elapsedMs: 0,
      durationMs,
      frameDurationMs,
      resourceId
    });

    if (resourceId) {
      this.collectEffectByResourceId.set(resourceId, entity.id);
    }

    return durationMs;
  }

  private removeCollectEffectForResource(resourceId: string): void {
    const effectEntityId = this.collectEffectByResourceId.get(resourceId);
    if (typeof effectEntityId !== 'number') {
      this.collectEffectByResourceId.delete(resourceId);
      return;
    }

    const effectState = this.activeCollectEffects.get(effectEntityId);
    if (effectState && this.ecs.entityExists(effectState.entity.id)) {
      this.ecs.removeEntity(effectState.entity);
    }
    this.activeCollectEffects.delete(effectEntityId);
    this.collectEffectByResourceId.delete(resourceId);
  }

  private animateCollectEffects(deltaTime: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) return;

    for (const [entityId, effectState] of this.activeCollectEffects.entries()) {
      if (!this.ecs.entityExists(entityId)) {
        this.activeCollectEffects.delete(entityId);
        continue;
      }

      effectState.elapsedMs += deltaTime;
      const effectSprite = this.ecs.getComponent(effectState.entity, AnimatedSprite);
      const collectEffect = this.ecs.getComponent(effectState.entity, ResourceCollectEffect);
      if (effectSprite && collectEffect) {
        const frameCount = Math.max(1, Number(effectSprite.frameCount || 1));
        const frameDurationMs = Math.max(1, Number(effectState.frameDurationMs || this.COLLECT_EFFECT_FRAME_DURATION_MS));
        const frameIndex = Math.min(frameCount - 1, Math.floor(effectState.elapsedMs / frameDurationMs));
        collectEffect.frameIndex = frameIndex;
      }

      if (effectState.elapsedMs >= effectState.durationMs) {
        if (effectState.resourceId && this.collectEffectByResourceId.get(effectState.resourceId) === entityId) {
          this.collectEffectByResourceId.delete(effectState.resourceId);
        }
        if (this.ecs.entityExists(entityId)) {
          this.ecs.removeEntity(effectState.entity);
        }
        this.activeCollectEffects.delete(entityId);
      }
    }
  }

  private clearCollectEffects(): void {
    for (const effectState of this.activeCollectEffects.values()) {
      if (this.ecs.entityExists(effectState.entity.id)) {
        this.ecs.removeEntity(effectState.entity);
      }
    }
    this.activeCollectEffects.clear();
    this.collectEffectByResourceId.clear();
  }

  private startPendingResourceRemoval(
    resourceId: string,
    entity: Entity,
    durationMs: number
  ): void {
    const normalizedDurationMs = Math.max(
      16,
      Math.floor(
        Number.isFinite(Number(durationMs))
          ? Number(durationMs)
          : this.RESOURCE_REMOVAL_FADE_DURATION_MS
      )
    );

    let visualState = this.ecs.getComponent(entity, ProjectileVisualState);
    if (!visualState) {
      visualState = new ProjectileVisualState(true, true);
      this.ecs.addComponent(entity, ProjectileVisualState, visualState);
    }

    visualState.active = true;
    visualState.visible = true;
    visualState.markedForRemoval = false;
    visualState.setAlpha(1);

    this.pendingResourceRemovals.set(resourceId, {
      entity,
      elapsedMs: 0,
      durationMs: normalizedDurationMs
    });
  }

  private processPendingResourceRemovals(deltaTime: number): void {
    const stepMs = Number.isFinite(deltaTime) && deltaTime > 0 ? deltaTime : 16;

    for (const [resourceId, removalState] of this.pendingResourceRemovals.entries()) {
      if (!this.ecs.entityExists(removalState.entity.id)) {
        this.pendingResourceRemovals.delete(resourceId);
        continue;
      }

      removalState.elapsedMs += stepMs;
      const durationMs = Math.max(
        1,
        Number.isFinite(Number(removalState.durationMs))
          ? Number(removalState.durationMs)
          : this.RESOURCE_REMOVAL_FADE_DURATION_MS
      );

      const fadeProgress = Math.max(0, Math.min(1, removalState.elapsedMs / durationMs));
      const visualState = this.ecs.getComponent(removalState.entity, ProjectileVisualState);
      if (visualState) {
        visualState.setAlpha(1 - fadeProgress);
      }

      if (removalState.elapsedMs >= durationMs) {
        if (this.ecs.entityExists(removalState.entity.id)) {
          this.ecs.removeEntity(removalState.entity);
        }
        this.pendingResourceRemovals.delete(resourceId);
      }
    }
  }

  // ==========================================
  // CARGO BOX MANAGEMENT
  // ==========================================

  private readonly cargoBoxEntities: Map<string, Entity> = new Map();
  private cargoBoxSprite: AnimatedSprite | null = null;
  private activeCargoBoxCollectTargetId: string | null = null;
  private readonly pendingCargoBoxCollectRequests: Map<string, number> = new Map();
  private cargoBoxCollectMovementLockId: string | null = null;
  private cargoBoxCollectMovementLockUntilMs: number = 0;

  private readonly CARGO_BOX_CLICK_RADIUS = 40;
  private readonly CARGO_BOX_SPRITE_SCALE = 0.8;
  private readonly CARGO_BOX_COLLECT_DISTANCE_PX = 16;
  private readonly CARGO_BOX_PENDING_REQUEST_TTL_MS = 1600;
  private readonly CARGO_BOX_COLLECT_MOVEMENT_LOCK_DURATION_MS = 2400;
  private readonly CARGO_BOX_FRAME_DURATION_MS = 40;
  private readonly CARGO_BOX_LIFETIME_MS = 20000;

  private readonly cargoBoxExpirations: Map<string, number> = new Map();

  registerCargoBoxSprite(sprite: AnimatedSprite): void {
    this.cargoBoxSprite = sprite;
  }

  addCargoBox(data: {
    id: string;
    x: number;
    y: number;
    npcType: string;
    killerClientId?: string;
    exclusiveUntil: number;
    expiresAt: number;
  }): void {
    if (!data || typeof data.id !== 'string') return;
    if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return;

    // Remove existing entity if present
    const existing = this.cargoBoxEntities.get(data.id);
    if (existing && this.ecs.entityExists(existing.id)) {
      this.ecs.removeEntity(existing);
    }

    const sprite = this.cargoBoxSprite;
    if (!sprite) return;

    const entity = this.ecs.createEntity();
    this.ecs.addComponent(
      entity,
      Transform,
      new Transform(
        data.x,
        data.y,
        0,
        this.CARGO_BOX_SPRITE_SCALE,
        this.CARGO_BOX_SPRITE_SCALE
      )
    );
    this.ecs.addComponent(entity, AnimatedSprite, sprite);
    this.ecs.addComponent(
      entity,
      ResourceNode,
      new ResourceNode(
        data.id,
        'cargo_box',
        this.CARGO_BOX_CLICK_RADIUS,
        this.CARGO_BOX_COLLECT_DISTANCE_PX,
        false
      )
    );

    // Hack to force animation in RenderSystem via ResourceCollectEffect component
    this.ecs.addComponent(
      entity,
      ResourceCollectEffect,
      new ResourceCollectEffect('cargo_anim', 0)
    );

    // Fade-in state
    const visualState = new ProjectileVisualState(true, true);
    visualState.setAlpha(0); // Start invisible
    this.ecs.addComponent(entity, ProjectileVisualState, visualState);

    this.cargoBoxEntities.set(data.id, entity);

    // Set expiration
    const now = Date.now();
    const expiresAt = Number.isFinite(data.expiresAt) && data.expiresAt > now
      ? data.expiresAt
      : now + this.CARGO_BOX_LIFETIME_MS;

    this.cargoBoxExpirations.set(data.id, expiresAt);
  }

  private animateCargoBoxes(deltaTime: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) return;

    const now = Date.now();
    const fadeInSpeed = 1 / (this.RESOURCE_REMOVAL_FADE_DURATION_MS || 260); // Reuse same duration for fade in

    for (const [boxId, entity] of this.cargoBoxEntities.entries()) {
      if (!this.ecs.entityExists(entity.id)) {
        this.cargoBoxEntities.delete(boxId);
        continue;
      }

      const sprite = this.ecs.getComponent(entity, AnimatedSprite);
      const animState = this.ecs.getComponent(entity, ResourceCollectEffect);
      const visualState = this.ecs.getComponent(entity, ProjectileVisualState);

      if (sprite && animState) {
        const frameCount = Math.max(1, Number(sprite.frameCount || 1));
        // Simple loop based on global time
        const frameIndex = Math.floor(now / this.CARGO_BOX_FRAME_DURATION_MS) % frameCount;
        animState.frameIndex = frameIndex;
      }

      // Handle fade-in
      if (visualState && visualState.alpha < 1 && !this.pendingResourceRemovals.has(boxId)) {
        const newAlpha = Math.min(1, visualState.alpha + (fadeInSpeed * deltaTime));
        visualState.setAlpha(newAlpha);
      }

      // Check for expiration
      const expiresAt = this.cargoBoxExpirations.get(boxId);
      if (expiresAt && now > expiresAt) {
        this.removeCargoBox(boxId);
      }
    }
  }

  removeCargoBox(cargoBoxId: string): void {
    if (this.pendingResourceRemovals.has(cargoBoxId)) {
      return;
    }

    const entity = this.cargoBoxEntities.get(cargoBoxId);
    if (entity && this.ecs.entityExists(entity.id)) {
      // Reuse resource removal logic which adds ProjectileVisualState for fade out
      this.startPendingResourceRemoval(cargoBoxId, entity, this.RESOURCE_REMOVAL_FADE_DURATION_MS);
    }

    // Always cleanup data immediately, let pendingResourceRemovals handle visual fade
    this.cleanupCargoBoxData(cargoBoxId);
  }

  private cleanupCargoBoxData(cargoBoxId: string): void {
    this.cargoBoxEntities.delete(cargoBoxId);
    this.cargoBoxExpirations.delete(cargoBoxId);
    this.pendingCargoBoxCollectRequests.delete(cargoBoxId);
    if (this.activeCargoBoxCollectTargetId === cargoBoxId) {
      this.activeCargoBoxCollectTargetId = null;
    }
    if (this.cargoBoxCollectMovementLockId === cargoBoxId) {
      this.cargoBoxCollectMovementLockId = null;
      this.cargoBoxCollectMovementLockUntilMs = 0;
    }
  }

  syncCargoBoxes(boxes: Array<{
    id: string;
    x: number;
    y: number;
    npcType: string;
    killerClientId?: string;
    exclusiveUntil: number;
    expiresAt: number;
  }> | null | undefined): void {
    this.clearAllCargoBoxes();
    if (!Array.isArray(boxes)) return;

    for (const box of boxes) {
      this.addCargoBox(box);
    }
  }

  clearAllCargoBoxes(): void {
    for (const entity of this.cargoBoxEntities.values()) {
      if (this.ecs.entityExists(entity.id)) {
        this.ecs.removeEntity(entity);
      }
    }
    this.cargoBoxEntities.clear();
    this.cargoBoxExpirations.clear();
    this.pendingCargoBoxCollectRequests.clear();
    this.activeCargoBoxCollectTargetId = null;
    this.cargoBoxCollectMovementLockId = null;
    this.cargoBoxCollectMovementLockUntilMs = 0;
  }

  handleCargoBoxMouseClick(worldX: number, worldY: number): boolean {
    const closest = this.findClosestCargoBox(worldX, worldY);
    if (!closest) return false;

    const now = Date.now();
    const lastRequestTime = this.pendingCargoBoxCollectRequests.get(closest.cargoBoxId);
    if (lastRequestTime && now - lastRequestTime < this.CARGO_BOX_PENDING_REQUEST_TTL_MS) {
      return true;
    }

    if (!this.clientNetworkSystem || !this.clientNetworkSystem.isConnected()) {
      return false;
    }

    const entity = this.cargoBoxEntities.get(closest.cargoBoxId);
    if (!entity || !this.ecs.entityExists(entity.id)) return false;

    const transform = this.ecs.getComponent(entity, Transform);
    if (!transform) return false;

    this.activeCargoBoxCollectTargetId = closest.cargoBoxId;
    this.issueMoveCommand(
      transform.x,
      transform.y - this.RESOURCE_COLLECT_ANCHOR_OFFSET_Y,
      true,
      this.RESOURCE_APPROACH_STOP_DISTANCE_PX
    );
    return true;
  }

  handleCargoBoxCollectionStatus(message: {
    status?: string;
    cargoBoxId?: string;
    remainingMs?: number;
  }): void {
    const cargoBoxId = typeof message?.cargoBoxId === 'string' ? message.cargoBoxId : '';
    if (!cargoBoxId) return;

    const status = String(message?.status || '').toLowerCase();
    if (!status) return;

    if (status === 'started' || status === 'in_progress') {
      const entity = this.cargoBoxEntities.get(cargoBoxId);
      if (!entity || !this.ecs.entityExists(entity.id)) return;
      const transform = this.ecs.getComponent(entity, Transform);
      if (!transform) return;

      const durationMs = Number.isFinite(Number(message?.remainingMs))
        ? Math.max(200, Math.floor(Number(message.remainingMs)))
        : undefined;

      const now = Date.now();
      this.cargoBoxCollectMovementLockId = cargoBoxId;
      this.cargoBoxCollectMovementLockUntilMs = now + (durationMs || this.CARGO_BOX_COLLECT_MOVEMENT_LOCK_DURATION_MS);

      const collectEffectPosition = this.getCollectChannelEffectPosition(transform);
      this.spawnCollectEffect(
        collectEffectPosition.x,
        collectEffectPosition.y,
        cargoBoxId,
        durationMs
      );
      return;
    }

    if (status === 'interrupted') {
      this.pendingCargoBoxCollectRequests.delete(cargoBoxId);
      if (this.activeCargoBoxCollectTargetId === cargoBoxId) {
        this.activeCargoBoxCollectTargetId = null;
      }
      if (this.cargoBoxCollectMovementLockId === cargoBoxId) {
        this.cargoBoxCollectMovementLockId = null;
        this.cargoBoxCollectMovementLockUntilMs = 0;
      }
      this.removeCollectEffectForResource(cargoBoxId);
      return;
    }

    if (status === 'completed') {
      this.pendingCargoBoxCollectRequests.delete(cargoBoxId);
      if (this.activeCargoBoxCollectTargetId === cargoBoxId) {
        this.activeCargoBoxCollectTargetId = null;
      }
      if (this.cargoBoxCollectMovementLockId === cargoBoxId) {
        this.cargoBoxCollectMovementLockId = null;
        this.cargoBoxCollectMovementLockUntilMs = 0;
      }
      this.removeCollectEffectForResource(cargoBoxId);
      this.removeCargoBox(cargoBoxId);
    }
  }
  isCargoBoxHovered(worldX: number, worldY: number): boolean {
    return !!this.findClosestCargoBox(worldX, worldY);
  }

  private processActiveCargoBoxCollectTarget(): void {
    if (!this.activeCargoBoxCollectTargetId) return;
    if (!this.clientNetworkSystem || !this.clientNetworkSystem.isConnected()) return;

    const cargoBoxEntity = this.cargoBoxEntities.get(this.activeCargoBoxCollectTargetId);
    if (!cargoBoxEntity || !this.ecs.entityExists(cargoBoxEntity.id)) {
      this.pendingCargoBoxCollectRequests.delete(this.activeCargoBoxCollectTargetId);
      if (this.cargoBoxCollectMovementLockId === this.activeCargoBoxCollectTargetId) {
        this.cargoBoxCollectMovementLockId = null;
        this.cargoBoxCollectMovementLockUntilMs = 0;
      }
      this.activeCargoBoxCollectTargetId = null;
      return;
    }

    const transform = this.ecs.getComponent(cargoBoxEntity, Transform);
    if (!transform) {
      this.pendingCargoBoxCollectRequests.delete(this.activeCargoBoxCollectTargetId);
      if (this.cargoBoxCollectMovementLockId === this.activeCargoBoxCollectTargetId) {
        this.cargoBoxCollectMovementLockId = null;
        this.cargoBoxCollectMovementLockUntilMs = 0;
      }
      this.activeCargoBoxCollectTargetId = null;
      return;
    }

    const playerPosition = this.resolvePlayerWorldPosition();
    if (!playerPosition) return;

    const collectAnchor = {
      x: transform.x,
      y: transform.y - this.RESOURCE_COLLECT_ANCHOR_OFFSET_Y
    };
    const now = Date.now();

    const collectDistance = this.ALIGNMENT_DISTANCE_PX + this.COLLECT_DISTANCE_TOLERANCE_PX;
    const dx = collectAnchor.x - playerPosition.x;
    const dy = collectAnchor.y - playerPosition.y;
    const distanceSq = dx * dx + dy * dy;
    const collectDistanceSq = collectDistance * collectDistance;

    if (distanceSq <= collectDistanceSq) {
      if (this.stopPlayerMovementCallback) {
        this.stopPlayerMovementCallback();
      }

      const lastRequestTime = this.pendingCargoBoxCollectRequests.get(this.activeCargoBoxCollectTargetId);
      if (!lastRequestTime || now - lastRequestTime >= this.CARGO_BOX_PENDING_REQUEST_TTL_MS) {
        this.pendingCargoBoxCollectRequests.set(this.activeCargoBoxCollectTargetId, now);
        this.cargoBoxCollectMovementLockId = this.activeCargoBoxCollectTargetId;
        this.cargoBoxCollectMovementLockUntilMs = now + this.CARGO_BOX_COLLECT_MOVEMENT_LOCK_DURATION_MS;
        this.clientNetworkSystem.sendCargoBoxCollectRequest(this.activeCargoBoxCollectTargetId);
      }
      return;
    }

    const isMovementLockedForCollect = (
      this.cargoBoxCollectMovementLockId === this.activeCargoBoxCollectTargetId &&
      now < this.cargoBoxCollectMovementLockUntilMs
    );
    if (isMovementLockedForCollect) {
      return;
    }

    this.issueMoveCommand(
      collectAnchor.x,
      collectAnchor.y,
      false,
      this.RESOURCE_APPROACH_STOP_DISTANCE_PX
    );
  }

  private findClosestCargoBox(worldX: number, worldY: number): { cargoBoxId: string; distanceSq: number } | null {
    let result: { cargoBoxId: string; distanceSq: number } | null = null;

    for (const [cargoBoxId, entity] of this.cargoBoxEntities.entries()) {
      if (!this.ecs.entityExists(entity.id)) {
        this.cargoBoxEntities.delete(cargoBoxId);
        continue;
      }

      const transform = this.ecs.getComponent(entity, Transform);
      if (!transform) continue;

      const dx = worldX - transform.x;
      const dy = worldY - transform.y;
      const distanceSq = dx * dx + dy * dy;
      const maxDistanceSq = this.CARGO_BOX_CLICK_RADIUS * this.CARGO_BOX_CLICK_RADIUS;
      if (distanceSq > maxDistanceSq) continue;

      if (!result || distanceSq < result.distanceSq) {
        result = { cargoBoxId, distanceSq };
      }
    }

    return result;
  }
}

