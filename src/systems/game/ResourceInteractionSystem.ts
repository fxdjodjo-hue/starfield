import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { AnimatedSprite } from '../../entities/AnimatedSprite';
import { ResourceNode } from '../../entities/spatial/ResourceNode';
import { ResourceCollectEffect } from '../../entities/spatial/ResourceCollectEffect';
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
  private readonly pendingResourceRemovals: Map<string, PendingResourceRemovalState> = new Map();
  private clientNetworkSystem: ClientNetworkSystem | null = null;
  private movePlayerToCallback: ((worldX: number, worldY: number, stopDistancePx?: number) => void) | null = null;
  private stopPlayerMovementCallback: (() => void) | null = null;
  private playerPositionResolver: (() => { x: number; y: number } | null) | null = null;
  private collectEffectSprite: AnimatedSprite | null = null;
  private activeCollectTargetResourceId: string | null = null;
  private lastMoveCommandAtMs: number = 0;

  private readonly PENDING_REQUEST_TTL_MS = 1600;
  private readonly RESOURCE_ROTATION_SPEED_RAD_PER_SEC = Math.PI * 0.75;
  private readonly COLLECT_EFFECT_FRAME_DURATION_MS = 55;
  private readonly MOVE_COMMAND_INTERVAL_MS = 220;
  private readonly ALIGNMENT_DISTANCE_PX = 1;
  private readonly RESOURCE_APPROACH_STOP_DISTANCE_PX = 1;
  private readonly COLLECT_DISTANCE_TOLERANCE_PX = 8;
  private readonly RESOURCE_COLLECT_ANCHOR_OFFSET_Y = 62;

  constructor(ecs: ECS) {
    super(ecs);
  }

  update(deltaTime: number): void {
    this.animateResourceNodes(deltaTime);
    this.processActiveCollectTarget();
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
    this.activeCollectTargetResourceId = null;
  }

  removeResource(resourceId: string, worldX?: number, worldY?: number): void {
    if (this.pendingResourceRemovals.has(resourceId)) {
      this.resourceEntities.delete(resourceId);
      this.pendingCollectRequests.delete(resourceId);
      if (this.activeCollectTargetResourceId === resourceId) {
        this.activeCollectTargetResourceId = null;
      }
      return;
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

    this.resourceEntities.delete(resourceId);
    this.pendingCollectRequests.delete(resourceId);

    const effectDurationMs = Number.isFinite(effectX) && Number.isFinite(effectY)
      ? this.spawnCollectEffect(effectX, effectY)
      : null;

    if (entity && this.ecs.entityExists(entity.id)) {
      this.pendingResourceRemovals.set(resourceId, {
        entity,
        elapsedMs: 0,
        durationMs: effectDurationMs ?? 260
      });
    }
  }

  handleMouseClick(worldX: number, worldY: number): boolean {
    this.cleanupPendingCollectRequests();

    const closest = this.findClosestResource(worldX, worldY);
    if (!closest) return false;

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
      this.activeCollectTargetResourceId = null;
      return;
    }

    const resourceTransform = this.ecs.getComponent(resourceEntity, Transform);
    const resourceNode = this.ecs.getComponent(resourceEntity, ResourceNode);
    if (!resourceTransform || !resourceNode) {
      this.pendingCollectRequests.delete(this.activeCollectTargetResourceId);
      this.activeCollectTargetResourceId = null;
      return;
    }

    const playerPosition = this.resolvePlayerWorldPosition();
    if (!playerPosition) return;
    const collectAnchor = this.getCollectAnchor(resourceTransform);

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

      const now = Date.now();
      const lastRequestTime = this.pendingCollectRequests.get(this.activeCollectTargetResourceId);
      if (!lastRequestTime || now - lastRequestTime >= this.PENDING_REQUEST_TTL_MS) {
        this.pendingCollectRequests.set(this.activeCollectTargetResourceId, now);
        this.clientNetworkSystem.sendResourceCollectRequest(this.activeCollectTargetResourceId);
      }
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

    const rotationStep = this.RESOURCE_ROTATION_SPEED_RAD_PER_SEC * (deltaTime / 1000);
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

  private spawnCollectEffect(worldX: number, worldY: number): number | null {
    if (!this.collectEffectSprite) return null;

    const entity = this.ecs.createEntity();
    this.ecs.addComponent(entity, Transform, new Transform(worldX, worldY, 0, 1, 1));
    this.ecs.addComponent(entity, AnimatedSprite, this.collectEffectSprite);
    this.ecs.addComponent(entity, ResourceCollectEffect, new ResourceCollectEffect('resource_collect', 0));
    const frameCount = Math.max(1, Number(this.collectEffectSprite.frameCount || 1));
    const frameDurationMs = Math.max(16, this.COLLECT_EFFECT_FRAME_DURATION_MS);
    const durationMs = Math.max(frameDurationMs, frameCount * frameDurationMs);

    this.activeCollectEffects.set(entity.id, {
      entity,
      elapsedMs: 0,
      durationMs,
      frameDurationMs
    });

    return durationMs;
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
  }

  private processPendingResourceRemovals(deltaTime: number): void {
    const stepMs = Number.isFinite(deltaTime) && deltaTime > 0 ? deltaTime : 16;

    for (const [resourceId, removalState] of this.pendingResourceRemovals.entries()) {
      if (!this.ecs.entityExists(removalState.entity.id)) {
        this.pendingResourceRemovals.delete(resourceId);
        continue;
      }

      removalState.elapsedMs += stepMs;
      if (removalState.elapsedMs >= removalState.durationMs) {
        if (this.ecs.entityExists(removalState.entity.id)) {
          this.ecs.removeEntity(removalState.entity);
        }
        this.pendingResourceRemovals.delete(resourceId);
      }
    }
  }
}
