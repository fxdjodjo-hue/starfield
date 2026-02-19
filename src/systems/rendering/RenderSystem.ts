import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { AssetManager } from '../../core/services/AssetManager';
import { DisplayManager } from '../../infrastructure/display';
import { Transform } from '../../entities/spatial/Transform';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';
import { Authority, AuthorityLevel } from '../../entities/spatial/Authority';
import { Npc } from '../../entities/ai/Npc';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { getPlayerRangeWidth, getPlayerRangeHeight } from '../../config/PlayerConfig';
import { Explosion } from '../../entities/combat/Explosion';
import { RepairEffect } from '../../entities/combat/RepairEffect';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';
import { RemotePlayer } from '../../entities/player/RemotePlayer';
import { Pet } from '../../entities/player/Pet';
import { RemotePet } from '../../entities/player/RemotePet';
import { Camera } from '../../entities/spatial/Camera';
import { CameraSystem } from './CameraSystem';
import { PlayerSystem } from '../player/PlayerSystem';
import { PLAYTEST_CONFIG, GAME_CONSTANTS } from '../../config/GameConstants';
import { ParallaxLayer } from '../../entities/spatial/ParallaxLayer';
import { Portal } from '../../entities/spatial/Portal';
import { SpaceStation } from '../../entities/spatial/SpaceStation';
import { Asteroid } from '../../entities/spatial/Asteroid';
import { ResourceCollectEffect } from '../../entities/spatial/ResourceCollectEffect';
import { ResourceNode } from '../../entities/spatial/ResourceNode';
import { Sprite } from '../../entities/Sprite';
import { AnimatedSprite } from '../../entities/AnimatedSprite';
import { Velocity } from '../../entities/spatial/Velocity';
import { Projectile } from '../../entities/combat/Projectile';
import { ProjectileVisualState } from '../../entities/combat/ProjectileVisualState';
import { RenderLayer } from '../../core/utils/rendering/RenderLayers';
import { NpcRenderer } from '../../core/utils/rendering/NpcRenderer';
import { PlayerRenderer } from '../../core/utils/rendering/PlayerRenderer';
import { SpaceStationRenderer } from '../../core/utils/rendering/SpaceStationRenderer';
import { HudRenderer } from '../../core/utils/rendering/HudRenderer';
import type { HealthBarRenderParams } from '../../core/utils/rendering/HudRenderer';
import { ExplosionRenderer } from '../../core/utils/rendering/ExplosionRenderer';
import type { ExplosionRenderParams } from '../../core/utils/rendering/ExplosionRenderer';
import { RepairEffectRenderer } from '../../core/utils/rendering/RepairEffectRenderer';
import { EngineFlamesRenderer } from '../../core/utils/rendering/EngineFlamesRenderer';
import { SpriteRenderer } from '../../core/utils/rendering/SpriteRenderer';

import type { RenderableTransform } from '../../core/utils/rendering/SpriteRenderer';
import { SpritesheetRenderer } from '../../core/utils/rendering/SpritesheetRenderer';
import type { SpritesheetRenderTransform } from '../../core/utils/rendering/SpritesheetRenderer';
import { ProjectileRenderer } from '../../core/utils/rendering/ProjectileRenderer';

/**
 * Sistema di rendering per Canvas 2D
 * Renderizza tutte le entit√† con componente Transform applicando la camera
 */
export class RenderSystem extends BaseSystem {
  // Static access to smoothed position for UI synchronization (Nicknames, etc.)
  public static smoothedLocalPlayerPos: { x: number; y: number } | null = null;
  public static smoothedLocalPlayerId: number | null = null;
  public static renderFrameTime: number = 0;

  private cameraSystem: CameraSystem;
  private playerSystem: PlayerSystem;
  private assetManager: AssetManager | null = null;
  private displayManager: DisplayManager;
  private damageTextSystem: any = null; // Sistema per renderizzare i testi di danno
  private componentCache: Map<Entity, any> = new Map(); // Cache componenti per ottimizzazione
  private entityQueryCache: Entity[] = []; // Cache risultati query ECS
  private projectileQueryCache: Entity[] = []; // Cache risultati query proiettili
  private projectileRenderer: ProjectileRenderer | null = null;
  private aimImage: HTMLImageElement | null = null; // Immagine per la selezione NPC
  private healthBarsFadeStartTime: number | null = null; // Timestamp quando inizia il fade delle health bars
  private readonly HEALTH_BARS_FADE_DURATION = 500; // Durata fade in millisecondi
  private engflamesSprite: AnimatedSprite | null = null; // Sprite per le fiamme del motore
  private engflamesAnimationTime: number = 0; // Tempo per l'animazione delle fiamme
  private engflamesOpacity: number = 0; // Opacit√† delle fiamme (0-1) per fade in/out
  private engflamesWasMoving: boolean = false; // Stato movimento precedente per fade
  private readonly ENGFLAMES_FADE_SPEED = 0.15; // Velocit√† fade in/out (per frame)
  private frameTime: number = 0; // Timestamp sincronizzato con frame rate per float offset
  private portalAnimationTime: number = 0; // Tempo per l'animazione del portale
  private readonly PORTAL_ANIMATION_FRAME_DURATION = 16.67; // ms per frame (~60fps)

  // High-precision render timer for smooth camera
  private lastRenderTimestamp: number = 0;
  private lastDt: number = 16; // Store delta time for sub-systems

  // Visual smoothing for local player (syncs with camera)
  private localPlayerSmoothedPos: { x: number; y: number } | null = null;

  constructor(ecs: ECS, cameraSystem: CameraSystem, playerSystem: PlayerSystem, assetManager?: AssetManager) {
    super(ecs);
    this.cameraSystem = cameraSystem;
    this.playerSystem = playerSystem;
    this.assetManager = assetManager || null;
    this.displayManager = DisplayManager.getInstance();
  }

  /**
   * Imposta il riferimento al DamageTextSystem per il rendering
   */
  setDamageTextSystem(damageTextSystem: any): void {
    this.damageTextSystem = damageTextSystem;
  }

  /**
   * Imposta il riferimento all'AssetManager
   */
  setAssetManager(assetManager: AssetManager): void {
    this.assetManager = assetManager;
  }

  /**
   * Ottiene il riferimento all'AssetManager
   */
  getAssetManager(): AssetManager | null {
    return this.assetManager;
  }

  /**
   * Get or create projectile renderer (lazy initialization)
   */
  private getProjectileRenderer(): ProjectileRenderer {
    if (!this.projectileRenderer && this.assetManager) {
      this.projectileRenderer = new ProjectileRenderer(this.ecs, this.playerSystem, this.assetManager);
    }
    return this.projectileRenderer!;
  }

  /**
   * Imposta lo sprite per le fiamme del motore
   */
  setEngflamesSprite(sprite: AnimatedSprite): void {
    if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_FLAMES] setEngflamesSprite called with:`, sprite ? 'VALID sprite' : 'NULL sprite');
    if (sprite) {
      if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_FLAMES] Sprite properties:`, {
        frames: sprite.spritesheet.frames?.length || 'no frames',
        frameWidth: sprite.spritesheet.frameWidth,
        frameHeight: sprite.spritesheet.frameHeight
      });
    }
    this.engflamesSprite = sprite;
  }

  /**
   * Trova l'entit√† player basandosi sui suoi componenti unici quando PlayerSystem non √® ancora inizializzato
   * Il player √® l'unica entit√† che ha Transform ma non ha componenti NPC (Npc o RemotePlayer)
   */
  private findPlayerByComponents(): Entity | null {
    for (const entity of this.entityQueryCache) {
      const hasTransform = this.ecs.hasComponent(entity, Transform);
      const hasNpc = this.ecs.hasComponent(entity, Npc);
      const hasRemotePlayer = this.ecs.hasComponent(entity, RemotePlayer);
      const hasPet = this.ecs.hasComponent(entity, Pet);
      const hasRemotePet = this.ecs.hasComponent(entity, RemotePet);

      // Il player ha Transform ma non √® NPC n√© remote player
      if (hasTransform && !hasNpc && !hasRemotePlayer && !hasPet && !hasRemotePet) {
        // Verifica aggiuntiva: dovrebbe avere componenti specifici del player
        const hasHealth = this.ecs.hasComponent(entity, Health);
        const hasShield = this.ecs.hasComponent(entity, Shield);

        if (hasHealth && hasShield) {
          return entity;
        }
      }
    }

    return null;
  }

  /**
   * Ottieni componenti con caching per ottimizzazione performance
   */
  private getCachedComponents(entity: Entity): any {
    if (!this.componentCache.has(entity)) {
      this.componentCache.set(entity, {
        transform: this.ecs.getComponent(entity, Transform),
        npc: this.ecs.getComponent(entity, Npc),
        parallax: this.ecs.getComponent(entity, ParallaxLayer),
        sprite: this.ecs.getComponent(entity, Sprite),
        animatedSprite: this.ecs.getComponent(entity, AnimatedSprite),
        explosion: this.ecs.getComponent(entity, Explosion),
        repairEffect: this.ecs.getComponent(entity, RepairEffect),
        velocity: this.ecs.getComponent(entity, Velocity),
        health: this.ecs.getComponent(entity, Health),
        shield: this.ecs.getComponent(entity, Shield),
        remotePlayer: this.ecs.getComponent(entity, RemotePlayer),
        projectile: this.ecs.getComponent(entity, Projectile),
        projectileVisualState: this.ecs.getComponent(entity, ProjectileVisualState)
      });
    }
    return this.componentCache.get(entity);
  }

  /**
   * Svuota la cache componenti e query (chiamare ogni frame)
   */
  private clearComponentCache(): void {
    this.componentCache.clear();
    this.entityQueryCache.length = 0; // Svuota array invece di riassegnare
    this.projectileQueryCache.length = 0;
  }


  /**
   * Render game entity (NPC, Player, Remote Player, or Explosion)
   */
  private renderGameEntity(
    ctx: CanvasRenderingContext2D,
    entity: Entity,
    transform: Transform,
    screenX: number,
    screenY: number,
    components: {
      explosion?: Explosion,
      repairEffect?: RepairEffect,
      npc?: Npc,
      sprite?: Sprite,
      animatedSprite?: AnimatedSprite,
      velocity?: Velocity,
      projectile?: Projectile,
      projectileVisualState?: ProjectileVisualState
    },
    camera?: Camera
  ): void {
    // CONTROLLA STATO VISIVO PRIMA DI OGNI RENDERING
    const visualState = components.projectileVisualState || null;
    if (visualState && !visualState.shouldRender()) {
      return;
    }

    // GESTIONE VISIBILITA COMPONENTI (SPRITE/ANIMATED)
    if (components.sprite && (components.sprite as any).visible === false) {
      return;
    }
    if (components.animatedSprite && (components.animatedSprite as any).visible === false) {
      return;
    }

    const shouldApplyAlpha = visualState && visualState.alpha < 1.0;
    if (shouldApplyAlpha) {
      ctx.save();
      ctx.globalAlpha *= visualState.alpha;
    }

    // GESTIONE LASER
    const isPlayerLaser = components.sprite && /laser[123]\.png$/.test(components.sprite.image?.src || '') && components.projectile && components.sprite.image?.complete;
    const isNpcLaser = components.sprite && components.sprite.image?.src?.includes('npc_frigate_projectile.png') && components.projectile && components.sprite.image.complete;

    if (isPlayerLaser || isNpcLaser) {
      if (components.sprite && components.sprite.image && components.projectile) {
        const angle = Math.atan2(components.projectile.directionY, components.projectile.directionX);
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(angle);
        ctx.drawImage(components.sprite.image, 0, -components.sprite.height / 2, components.sprite.width, components.sprite.height);
        ctx.restore();
      }
      if (shouldApplyAlpha) ctx.restore();
      return;
    }

    const { explosion, repairEffect, npc } = components;
    const playerEntity = this.playerSystem.getPlayerEntity();
    const isPlayerEntity = playerEntity && entity && playerEntity.id === entity.id;
    const isRemotePlayer = this.ecs.hasComponent(entity, RemotePlayer);
    const isPet = this.ecs.hasComponent(entity, Pet) || this.ecs.hasComponent(entity, RemotePet);
    const isSpaceStation = this.ecs.hasComponent(entity, SpaceStation);
    const isAsteroid = this.ecs.hasComponent(entity, Asteroid);
    const isPortal = this.ecs.hasComponent(entity, Portal);

    if (explosion) {
      this.renderExplosion(ctx, transform, explosion, screenX, screenY);
    } else if (repairEffect) {
      this.renderRepairEffect(ctx, transform, repairEffect, screenX, screenY);
    } else if (npc) {
      const entityAnimatedSprite = this.ecs.getComponent(entity, AnimatedSprite);
      const entitySprite = this.ecs.getComponent(entity, Sprite);
      const isSelected = this.ecs.hasComponent(entity, SelectedNpc);

      if (isSelected) {
        let offsetX = 0; let offsetY = 0;
        if (entityAnimatedSprite) {
          offsetX = entityAnimatedSprite.offsetX;
          offsetY = entityAnimatedSprite.offsetY;
        } else if (entitySprite) {
          offsetX = entitySprite.offsetX;
          offsetY = entitySprite.offsetY;
        }
        this.renderSelectionCircle(ctx, screenX + offsetX, screenY + offsetY);
      }

      const zoom = camera?.zoom || 1;
      const renderTransform = {
        x: screenX, y: screenY, rotation: transform.rotation,
        scaleX: (transform.scaleX || 1) * zoom,
        scaleY: (transform.scaleY || 1) * zoom
      };

      if (entityAnimatedSprite) {
        SpritesheetRenderer.render(ctx, renderTransform, entityAnimatedSprite);
      } else if (entitySprite) {
        const authority = this.ecs.getComponent(entity, Authority);
        const isRemoteNpc = authority && authority.authorityLevel === AuthorityLevel.SERVER_AUTHORITATIVE;
        if (isRemoteNpc) {
          SpriteRenderer.render(ctx, renderTransform, entitySprite);
        } else {
          const rotationAngle = NpcRenderer.getRenderRotation(npc, transform, components.velocity);
          SpriteRenderer.render(ctx, renderTransform, entitySprite, rotationAngle);
        }
      }
    } else if (isPlayerEntity || isRemotePlayer) {
      const entityAnimatedSprite = this.ecs.getComponent(entity, AnimatedSprite);
      const entitySprite = this.ecs.getComponent(entity, Sprite);
      const floatOffsetY = PlayerRenderer.getFloatOffset(this.frameTime);
      const zoom = camera?.zoom || 1;
      const renderTransform = {
        x: screenX, y: screenY + floatOffsetY, rotation: transform.rotation,
        scaleX: (transform.scaleX || 1) * zoom,
        scaleY: (transform.scaleY || 1) * zoom
      };

      if (entityAnimatedSprite) {
        const img = entityAnimatedSprite.spritesheet?.image;
        if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
          SpritesheetRenderer.render(ctx, renderTransform, entityAnimatedSprite);
        }
      } else if (entitySprite && entitySprite.isLoaded()) {
        SpriteRenderer.render(ctx, renderTransform, entitySprite);
      }
    } else if (isPet) {
      const localPet = this.ecs.getComponent(entity, Pet);
      const isLocalPet = !!localPet && !this.ecs.hasComponent(entity, RemotePet);
      if (isLocalPet && localPet.isActive === false) {
        if (shouldApplyAlpha) {
          ctx.restore();
        }
        return;
      }

      const entityAnimatedSprite = this.ecs.getComponent(entity, AnimatedSprite);
      const entitySprite = this.ecs.getComponent(entity, Sprite);
      const petFloatOffsetY = PlayerRenderer.getFloatOffset(this.frameTime + entity.id * 157);
      const zoom = camera?.zoom || 1;
      const renderTransform = {
        x: screenX, y: screenY + petFloatOffsetY, rotation: transform.rotation,
        scaleX: (transform.scaleX || 1) * zoom,
        scaleY: (transform.scaleY || 1) * zoom
      };

      if (entityAnimatedSprite) {
        const img = entityAnimatedSprite.spritesheet?.image;
        if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
          SpritesheetRenderer.render(ctx, renderTransform, entityAnimatedSprite);
        }
      } else if (entitySprite && entitySprite.isLoaded()) {
        SpriteRenderer.render(ctx, renderTransform, entitySprite);
      }
    } else if (isSpaceStation) {
      const entitySprite = this.ecs.getComponent(entity, Sprite);
      if (entitySprite && entitySprite.isLoaded()) {
        const floatOffsetY = SpaceStationRenderer.getFloatOffset(this.frameTime);
        const zoom = camera?.zoom || 1;
        const renderTransform = {
          x: screenX, y: screenY + floatOffsetY, rotation: transform.rotation,
          scaleX: (transform.scaleX || 1) * zoom,
          scaleY: (transform.scaleY || 1) * zoom
        };
        SpriteRenderer.render(ctx, renderTransform, entitySprite);
      }
    } else if (isAsteroid) {
      const entitySprite = this.ecs.getComponent(entity, Sprite);
      if (entitySprite && entitySprite.isLoaded()) {
        const zoom = camera?.zoom || 1;
        const renderTransform = {
          x: screenX, y: screenY, rotation: transform.rotation,
          scaleX: (transform.scaleX || 1) * zoom,
          scaleY: (transform.scaleY || 1) * zoom
        };
        SpriteRenderer.render(ctx, renderTransform, entitySprite);
      }
    } else if (components.sprite || components.animatedSprite) {
      this.renderGenericSprite(ctx, entity, transform, components.sprite || null, components.animatedSprite || null, screenX, screenY, camera || null);
      if (isPortal) {
        if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) {
          console.log(`[DEBUG_PORTAL] Portal rendered at screen coordinates: (${screenX.toFixed(0)}, ${screenY.toFixed(0)})`);
        }
      }
    }

    if (shouldApplyAlpha) {
      ctx.restore();
    }
  }

  /**
   * Renderizza informazioni di debug sull'interpolazione (solo in modalit√† DEBUG)
   */
  private renderInterpolationDebug(ctx: CanvasRenderingContext2D): void {
    // Trova il primo remote player con un InterpolationTarget
    const entities = this.ecs.getEntitiesWithComponents(RemotePlayer, InterpolationTarget);
    if (entities.length === 0) return;

    const entity = entities[0];
    const target = this.ecs.getComponent(entity, InterpolationTarget) as InterpolationTarget;
    if (!target) return;

    ctx.save();
    ctx.font = '12px Courier New';
    ctx.textAlign = 'left';

    const info = [
      `Entity ID: ${entity.id}`,
      `Buffer: ${target.bufferSize} snaps`,
      `Offset: ${target.currentOffset.toFixed(1)}ms`,
      `Jitter: ${target.jitterMs.toFixed(1)}ms`,
      `Extrapolating: ${target.isExtrapolating ? 'YES (LIMIT!)' : 'NO'}`
    ];

    const x = 20;
    let y = 300; // Posizionato sotto la minimappa / HUD

    // Sfondo semi-trasparente
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x - 5, y - 15, 200, info.length * 15 + 10);

    // Testo
    ctx.fillStyle = target.isExtrapolating ? '#FF5555' : '#55FF55';
    for (const line of info) {
      ctx.fillText(line, x, y);
      y += 15;
    }

    ctx.restore();
  }

  update(deltaTime: number): void {
    // Sincronizza frameTime con l'orologio reale invece del deltaTime fisico
    // per evitare stutter nelle animazioni visuali (floatOffset, ecc) tra i passi di fisica
    this.frameTime = performance.now();
    RenderSystem.renderFrameTime = this.frameTime;

    this.engflamesAnimationTime += deltaTime;
    this.portalAnimationTime += deltaTime;

    const playerEntity = this.playerSystem.getPlayerEntity();
    if (!playerEntity) return;

    const velocity = this.ecs.getComponent(playerEntity, Velocity);
    const isMoving = velocity ? (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1) : false;

    // DEBUG: Log velocity del player per fiamme motore
    if (!velocity) {
      if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_FLAMES] Player has no Velocity component!`);
    } else if (!isMoving) {
      // Log solo occasionalmente per non spam
      if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES && Math.random() < 0.01) {
        console.log(`[DEBUG_FLAMES] Player not moving enough - velocity: (${velocity.x.toFixed(2)}, ${velocity.y.toFixed(2)})`);
      }
    } else if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) {
      console.log(`[DEBUG_FLAMES] ‚úÖ Player is MOVING! Velocity: (${velocity.x.toFixed(2)}, ${velocity.y.toFixed(2)}) - Flames should appear (opacity: ${this.engflamesOpacity})`);
    }

    // Gestisci fiamme del motore
    if (this.engflamesSprite) {
      // Fade in quando inizia a muoversi, fade out quando si ferma
      if (isMoving) {
        this.engflamesOpacity = Math.min(1, this.engflamesOpacity + this.ENGFLAMES_FADE_SPEED);
      } else {
        this.engflamesOpacity = Math.max(0, this.engflamesOpacity - this.ENGFLAMES_FADE_SPEED);
      }
      this.engflamesWasMoving = isMoving;
    }

  }

  render(ctx: CanvasRenderingContext2D): void {
    // Applica fade-in del mondo durante animazione zoom
    const isZoomAnimating = this.cameraSystem.isZoomAnimationActive ? this.cameraSystem.isZoomAnimationActive() : false;
    let worldOpacity = 1;
    if (isZoomAnimating && this.cameraSystem.getWorldOpacity) {
      worldOpacity = this.cameraSystem.getWorldOpacity();
    }

    // DEBUG: Log opacit√† globale per investigare problema rendering
    if (worldOpacity < 1) {
      if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_RENDER] worldOpacity: ${worldOpacity}, isZoomAnimating: ${isZoomAnimating}`);
    }

    // SMOOTH CAMERA UPDATE (Render Frequency)
    // Calculate real render delta time
    const now = performance.now();
    // Cap dt to avoid huge jumps on tab switch (max 100ms)
    const dt = this.lastRenderTimestamp > 0 ? Math.min(now - this.lastRenderTimestamp, 100) : 16;
    this.lastRenderTimestamp = now;
    this.lastDt = dt; // Store for entity rendering

    // PRE-CALCULATE Player Smoothing BEFORE any rendering
    // This ensures RepairEffects and other dependent entities use the FRESH smoothed position (Frame N)
    // instead of the previous frame's position (Frame N-1), eliminating vibration/lag.
    this.updateLocalPlayerSmoothing(dt);

    // Update camera position smoothly
    this.cameraSystem.updateForRender(dt);

    if (worldOpacity === 1 && !isZoomAnimating) {
      if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_RENDER] Zoom animation finished - opacity back to normal`);
    }

    // Salva stato e applica opacit√†
    ctx.save();
    ctx.globalAlpha = worldOpacity;
    // Svuota cache componenti ad ogni frame per dati freschi
    this.clearComponentCache();

    const camera = this.cameraSystem.getCamera();

    // Render entities and health/shield bars
    this.renderEntities(ctx, camera);

    // Resource hitbox debug overlay
    this.renderResourceHitboxDebug(ctx, camera);


    // Render damage text (floating numbers)
    if (this.damageTextSystem && typeof this.damageTextSystem.render === 'function') {
      this.damageTextSystem.render(ctx);
    }

    // Render Interpolation Debug Info
    if (PLAYTEST_CONFIG.ENABLE_DEBUG_UI) {
      this.renderInterpolationDebug(ctx);
    }

    // Renderizza raggio di interesse (debug visivo, attivabile da GameConstants)
    if (PLAYTEST_CONFIG.ENABLE_DEBUG_UI) {
      this.renderInterestRadius(ctx, camera);
    }

    // Render NPC beam effects (laser attacks) - TEMPORANEAMENTE DISABILITATO
    // TODO: Riabilitare dopo aver fixato il sistema di selezione NPC

    // Ripristina opacit√†
    ctx.restore();
  }

  /**
   * Render entities and their health/shield bars
   */
  private renderEntities(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // OTTIMIZZAZIONE: Cache risultati query ECS invece di chiamare ogni volta
    if (this.entityQueryCache.length === 0) {
      this.entityQueryCache = this.ecs.getEntitiesWithComponents(Transform);
    }
    const entities = this.entityQueryCache;
    const { width, height } = this.displayManager.getLogicalSize();
    const isZoomAnimating = this.cameraSystem.isZoomAnimationActive ? this.cameraSystem.isZoomAnimationActive() : false;
    if (isZoomAnimating) {
      // Reset fade quando l'animazione ricomincia
      this.healthBarsFadeStartTime = null;
    }

    let playerEntity = this.playerSystem.getPlayerEntity();

    // Se PlayerSystem non ha il player (inizializzazione non completata), identifica il player dai suoi componenti unici
    // Il player Ë l'unica entit‡ con Transform ma senza componenti NPC
    if (!playerEntity) {
      playerEntity = this.findPlayerByComponents();
    }

    const localPlayerTransform = playerEntity
      ? this.ecs.getComponent(playerEntity, Transform)
      : null;
    const localPlayerVisualOffsetX = (localPlayerTransform && this.localPlayerSmoothedPos)
      ? this.localPlayerSmoothedPos.x - localPlayerTransform.x
      : 0;
    const localPlayerVisualOffsetY = (localPlayerTransform && this.localPlayerSmoothedPos)
      ? this.localPlayerSmoothedPos.y - localPlayerTransform.y
      : 0;

    // Single-pass classification to avoid per-frame temporary arrays from chained filters.
    // Keep identical classification semantics/order as before.
    const collectEffects: Entity[] = [];
    const spaceStations: Entity[] = [];
    const otherEntities: Entity[] = [];
    for (const entity of entities) {
      if (playerEntity && entity && entity.id === playerEntity.id) {
        continue;
      }

      const hasCollectEffect = this.ecs.hasComponent(entity, ResourceCollectEffect);
      const hasSpaceStation = this.ecs.hasComponent(entity, SpaceStation);

      if (hasCollectEffect) {
        collectEffects.push(entity);
      }
      if (hasSpaceStation) {
        spaceStations.push(entity);
      }
      if (!hasCollectEffect && !hasSpaceStation) {
        otherEntities.push(entity);
      }
    }

    // Render space stations PRIMA di tutte le altre entit‡ (pi˘ in background)
    for (const entity of spaceStations) {
      const components = this.getCachedComponents(entity);
      if (components.transform) {
        // Per NPC remoti, usa coordinate interpolate se disponibili
        let renderX = components.transform.x;
        let renderY = components.transform.y;

        // Usa valori interpolati se disponibili (per NPC, PlayerRemoti, Asteroidi, ecc.)
        const interpolationTarget = this.ecs.getComponent(entity, InterpolationTarget);
        if (interpolationTarget) {
          renderX = interpolationTarget.renderX;
          renderY = interpolationTarget.renderY;
        }

        const screenPos = camera.worldToScreen(renderX, renderY, width, height);
        this.renderGameEntity(ctx, entity, components.transform, screenPos.x, screenPos.y, {
          explosion: components.explosion,
          repairEffect: components.repairEffect,
          npc: components.npc,
          sprite: components.sprite,
          animatedSprite: components.animatedSprite,
          velocity: components.velocity,
          projectile: components.projectile,
          projectileVisualState: components.projectileVisualState
        }, camera);
      }
    }

    // Render altre entit‡ (portali, NPC, ecc.) - player verr‡ renderizzato dopo
    for (const entity of otherEntities) {
      // OTTIMIZZAZIONE: Usa cache componenti invece di chiamate ripetute getComponent()
      const components = this.getCachedComponents(entity);

      // Skip parallax entities (rendered by ParallaxSystem)
      if (components.parallax) continue;

      if (components.transform) {
        // Per entit‡ remote, usa coordinate interpolate se disponibili
        let renderX = components.transform.x;
        let renderY = components.transform.y;

        // Check for Remote Interpolation
        const interpolationTarget = this.ecs.getComponent(entity, InterpolationTarget);
        if (interpolationTarget) {
          renderX = interpolationTarget.renderX;
          renderY = interpolationTarget.renderY;
        }
        // FIX: Se Ë un effetto di riparazione collegato al Local Player, usa la posizione smoothed
        else if (components.repairEffect &&
          RenderSystem.smoothedLocalPlayerPos &&
          components.repairEffect.targetEntityId === RenderSystem.smoothedLocalPlayerId) {
          renderX = RenderSystem.smoothedLocalPlayerPos.x;
          renderY = RenderSystem.smoothedLocalPlayerPos.y;
        }

        // Keep only local-pet visual movement aligned with local-player render smoothing.
        if (this.ecs.hasComponent(entity, Pet) && !this.ecs.hasComponent(entity, RemotePet)) {
          const localPet = this.ecs.getComponent(entity, Pet);
          if (localPet && localPet.isActive === false) {
            continue;
          }
          renderX += localPlayerVisualOffsetX;
          renderY += localPlayerVisualOffsetY;
        }

        const screenPos = camera.worldToScreen(renderX, renderY, width, height);

        // Render entity
        this.renderGameEntity(ctx, entity, components.transform, screenPos.x, screenPos.y, {
          explosion: components.explosion,
          repairEffect: components.repairEffect,
          npc: components.npc,
          sprite: components.sprite,
          animatedSprite: components.animatedSprite,
          velocity: components.velocity,
          projectile: components.projectile,
          projectileVisualState: components.projectileVisualState
        }, camera);

        // Render health/shield bars con fade quando l'animazione zoom Ë completata
        if (!isZoomAnimating && (components.health || components.shield)) {
          // Inizia il fade quando l'animazione Ë appena completata
          if (this.healthBarsFadeStartTime === null) {
            this.healthBarsFadeStartTime = Date.now();
          }
          this.renderHealthBars(ctx, screenPos.x, screenPos.y, components.health || null, components.shield || null);
        }
      }
    }

    // Render collect effects before the player so they stay "under" the ship.
    for (const entity of collectEffects) {
      const components = this.getCachedComponents(entity);
      if (!components.transform) continue;

      let renderX = components.transform.x;
      let renderY = components.transform.y;
      const interpolationTarget = this.ecs.getComponent(entity, InterpolationTarget);
      if (interpolationTarget) {
        renderX = interpolationTarget.renderX;
        renderY = interpolationTarget.renderY;
      }

      const screenPos = camera.worldToScreen(renderX, renderY, width, height);
      this.renderGameEntity(ctx, entity, components.transform, screenPos.x, screenPos.y, {
        explosion: components.explosion,
        repairEffect: components.repairEffect,
        npc: components.npc,
        sprite: components.sprite,
        animatedSprite: components.animatedSprite,
        velocity: components.velocity,
        projectile: components.projectile,
        projectileVisualState: components.projectileVisualState
      }, camera);
    }

    // Render player DOPO tutte le altre entit‡ (sopra portali, NPC e space stations)
    // This ensures the player is rendered on top with proper priority
    if (playerEntity) {
      const playerTransform = this.ecs.getComponent(playerEntity, Transform);

      if (playerTransform) {
        // --- VISUAL SMOOTHING FOR LOCAL PLAYER ---
        // (Calculated at start of frame in updateLocalPlayerSmoothing)
        // Just ensure it exists (fallback)
        if (!this.localPlayerSmoothedPos) {
          this.localPlayerSmoothedPos = { x: playerTransform.x, y: playerTransform.y };
        }

        // Use smoothed transform position for screen projection
        const screenPos = camera.worldToScreen(
          this.localPlayerSmoothedPos.x,
          this.localPlayerSmoothedPos.y,
          width,
          height
        );

        // Render engine flames BEFORE player ship (behind in z-order)
        const playerVelocity = this.ecs.getComponent(playerEntity, Velocity);
        const components = this.getCachedComponents(playerEntity);
        const isVisible = (components.sprite && (components.sprite as any).visible !== false) ||
          (components.animatedSprite && (components.animatedSprite as any).visible !== false);

        if (playerVelocity && this.engflamesSprite && this.engflamesOpacity > 0 && isVisible) {
          // Keep flames locked to the same floating motion applied to the ship render.
          const playerFloatOffsetY = PlayerRenderer.getFloatOffset(this.frameTime);
          const params = EngineFlamesRenderer.getRenderParams(
            playerTransform,
            screenPos.x,
            screenPos.y + playerFloatOffsetY,
            this.engflamesAnimationTime,
            this.engflamesOpacity,
            camera,
            components.animatedSprite || undefined
          );
          if (params) {
            EngineFlamesRenderer.render(ctx, this.engflamesSprite, params);
          }
        }

        // Render player entity
        this.renderGameEntity(ctx, playerEntity, playerTransform, screenPos.x, screenPos.y, {
          explosion: components.explosion,
          repairEffect: components.repairEffect,
          npc: components.npc,
          sprite: components.sprite,
          animatedSprite: components.animatedSprite,
          velocity: components.velocity,
          projectile: components.projectile,
          projectileVisualState: components.projectileVisualState
        }, camera);

        // Render health/shield bars con fade quando l'animazione zoom Ë completata
        if (!isZoomAnimating && (components.health || components.shield) && isVisible) {
          // Inizia il fade quando l'animazione Ë appena completata
          if (this.healthBarsFadeStartTime === null) {
            this.healthBarsFadeStartTime = Date.now();
          }
          this.renderHealthBars(ctx, screenPos.x, screenPos.y, components.health || null, components.shield || null);
        }
      }
    }
  }
  /**
   * Updates the smoothed local player position.
   * Called at the start of the render loop to ensure all dependent rendering uses the fresh position.
   */
  private updateLocalPlayerSmoothing(dt: number): void {
    const playerEntity = this.playerSystem.getPlayerEntity();
    if (!playerEntity) return;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    if (!playerTransform) return;

    // Initialize if needed
    if (!this.localPlayerSmoothedPos) {
      this.localPlayerSmoothedPos = { x: playerTransform.x, y: playerTransform.y };
    }

    // Update Static Ref for UI (Nicknames) and other systems
    RenderSystem.smoothedLocalPlayerPos = this.localPlayerSmoothedPos;
    RenderSystem.smoothedLocalPlayerId = playerEntity.id;

    // Sync speed with CameraSystem (20.0)
    const SMOOTH_SPEED = 20.0;
    const lerpFactor = 1 - Math.exp(-SMOOTH_SPEED * (dt / 1000));

    // Check for teleport/respawn (distance > 500px) -> Snap
    const dx = playerTransform.x - this.localPlayerSmoothedPos.x;
    const dy = playerTransform.y - this.localPlayerSmoothedPos.y;

    // Squared distance check (500^2 = 250000)
    if (dx * dx + dy * dy > 250000) {
      this.localPlayerSmoothedPos.x = playerTransform.x;
      this.localPlayerSmoothedPos.y = playerTransform.y;
    } else {
      this.localPlayerSmoothedPos.x += dx * lerpFactor;
      this.localPlayerSmoothedPos.y += dy * lerpFactor;
    }
  }

  /**
   * Render health and shield bars using HUD helper
   */
  private renderHealthBars(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, health: Health | null, shield: Shield | null): void {
    // Calcola opacity per fade-in
    let opacity = 1;
    if (this.healthBarsFadeStartTime !== null) {
      const elapsed = Date.now() - this.healthBarsFadeStartTime;
      const fadeProgress = Math.min(elapsed / this.HEALTH_BARS_FADE_DURATION, 1);
      opacity = fadeProgress; // Fade da 0 a 1
    }

    ctx.save();
    ctx.globalAlpha = opacity;

    let currentY = screenY;

    // Render shield bar first (if present)
    if (shield) {
      const shieldParams = HudRenderer.getShieldBarParams(screenX, currentY, shield);
      if (shieldParams) {
        this.renderHealthBar(ctx, shieldParams);
      }
      currentY += HudRenderer.getBarSpacing();
    }

    // Render health bar (if present)
    if (health) {
      const healthParams = HudRenderer.getHealthBarParams(screenX, currentY, health);
      if (healthParams) {
        this.renderHealthBar(ctx, healthParams);
      }
    }

    ctx.restore();
  }

  /**
   * Render a single health bar using parameters (modern style)
   */
  private renderHealthBar(ctx: CanvasRenderingContext2D, params: HealthBarRenderParams): void {
    const barWidth = HudRenderer.getBarWidth();

    // Background con ombra
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = params.backgroundColor;
    ctx.fillRect(params.x, params.y, barWidth, params.height);

    // Reset shadow
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Fill con gradiente se disponibile
    if (params.width > 0) {
      if (params.fillColorEnd) {
        // Gradiente orizzontale
        const gradient = ctx.createLinearGradient(
          params.x, params.y,
          params.x + params.width, params.y
        );
        gradient.addColorStop(0, params.fillColor);
        gradient.addColorStop(1, params.fillColorEnd);
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = params.fillColor;
      }
      ctx.fillRect(params.x, params.y, params.width, params.height);

      // Effetto luce/riflesso sulla parte superiore
      if (params.width > 4) {
        const highlightGradient = ctx.createLinearGradient(
          params.x, params.y,
          params.x, params.y + params.height / 2
        );
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = highlightGradient;
        ctx.fillRect(params.x, params.y, params.width, params.height / 2);
      }
    }

    // Border
    ctx.strokeStyle = params.borderColor;
    ctx.lineWidth = params.borderWidth;
    ctx.globalAlpha = 0.9;
    ctx.strokeRect(params.x, params.y, barWidth, params.height);
    ctx.globalAlpha = 1;
  }







  /**
   * Render explosion effect
   */
  private renderExplosion(ctx: CanvasRenderingContext2D, transform: Transform, explosion: Explosion, screenX: number, screenY: number): void {
    const params = ExplosionRenderer.getRenderParams(explosion, screenX, screenY);

    if (params && params.image) {
      ctx.save();
      if (explosion.useTransformRotation) {
        const centerX = params.x + params.width / 2;
        const centerY = params.y + params.height / 2;
        const rotation = Number(transform.rotation || 0) + Number(explosion.rotationOffset || 0);
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.drawImage(params.image, -params.width / 2, -params.height / 2, params.width, params.height);
      } else {
        ctx.drawImage(params.image, params.x, params.y, params.width, params.height);
      }
      ctx.restore();
    }
  }

  /**
   * Render generic sprite (projectiles, effects, etc.)
   */
  private renderGenericSprite(ctx: CanvasRenderingContext2D, entity: Entity, transform: Transform, sprite: Sprite | null, animatedSprite: AnimatedSprite | null, screenX: number, screenY: number, camera: Camera | null): void {
    const zoom = camera?.zoom || 1;

    if (animatedSprite) {
      const renderTransform: SpritesheetRenderTransform = {
        x: screenX, y: screenY, rotation: transform.rotation,
        scaleX: (transform.scaleX || 1) * zoom,
        scaleY: (transform.scaleY || 1) * zoom
      };

      // Resource collect effects advance via explicit frame index from system state.
      const collectEffect = this.ecs.getComponent(entity, ResourceCollectEffect);
      if (collectEffect) {
        const frameIndex = Math.max(0, Math.floor(Number(collectEffect.frameIndex || 0)));
        SpritesheetRenderer.renderByIndex(ctx, renderTransform, animatedSprite, frameIndex);
        return;
      }

      // Controlla se questa entit√† √® un portale per applicare animazione temporale
      const isPortal = this.ecs.hasComponent(entity, Portal);
      if (isPortal) {
        // Portali: usa animazione temporale (come GIF)
        const totalFrames = animatedSprite.frameCount;
        if (totalFrames > 0) {
          const frameIndex = Math.floor((this.portalAnimationTime / this.PORTAL_ANIMATION_FRAME_DURATION) % totalFrames);
          SpritesheetRenderer.renderByIndex(ctx, renderTransform, animatedSprite, frameIndex);
        } else {
          // Fallback se non ci sono frame
          SpritesheetRenderer.render(ctx, renderTransform, animatedSprite);
        }

      } else {
        // Rendering normale per altri AnimatedSprite
        SpritesheetRenderer.render(ctx, renderTransform, animatedSprite);
      }
    } else if (sprite && sprite.isLoaded()) {
      const renderTransform: RenderableTransform = {
        x: screenX, y: screenY, rotation: transform.rotation,
        scaleX: (transform.scaleX || 1) * zoom,
        scaleY: (transform.scaleY || 1) * zoom
      };
      SpriteRenderer.render(ctx, renderTransform, sprite);
    }
  }

  /**
   * Render repair effect
   */
  private renderRepairEffect(ctx: CanvasRenderingContext2D, transform: Transform, repairEffect: RepairEffect, screenX: number, screenY: number): void {
    // üöÄ FIX: Se √® un effetto scudo per un PLAYER, mostra solo se HP > 50%
    if (repairEffect.repairType === 'shield') {
      const targetEntity = this.ecs.getEntity(repairEffect.targetEntityId);
      if (targetEntity) {
        // Controlla se √® un player (locale o remoto)
        const isRemotePlayer = this.ecs.hasComponent(targetEntity, RemotePlayer);
        const playerEntity = this.playerSystem?.getPlayerEntity();
        const isLocalPlayer = playerEntity && targetEntity.id === playerEntity.id;

        if (isLocalPlayer || isRemotePlayer) {
          const health = this.ecs.getComponent(targetEntity, Health);
          if (health && (health.current / health.max) <= 0.5) {
            return; // Nascondi animazione scudo se HP <= 50%
          }
        }
      }
    }

    const params = RepairEffectRenderer.getRenderParams(repairEffect, transform, screenX, screenY);

    if (params && params.image) {
      ctx.save();
      ctx.drawImage(params.image, params.x, params.y, params.width, params.height);
      ctx.restore();
    }
  }

  /**
   * Render selection image around selected NPCs
   */
  private renderSelectionCircle(ctx: CanvasRenderingContext2D, screenX: number, screenY: number): void {
    // Check if assetManager is available
    if (!this.assetManager) {
      return;
    }

    // Carica l'immagine in modo lazy se non √® gi√† caricata
    if (!this.aimImage) {
      this.aimImage = this.assetManager.getOrLoadImage('assets/aim/aim.png');
      if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_AIM] Loading aim.png...`);
    }

    // Se l'immagine non √® ancora caricata, non renderizzare nulla
    if (!this.aimImage || !this.aimImage.complete || this.aimImage.naturalWidth === 0) {
      if (!this.aimImage) {
        if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_AIM] aimImage is null`);
      } else if (!this.aimImage.complete) {
        if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_AIM] aimImage not complete yet`);
      } else if (this.aimImage.naturalWidth === 0) {
        if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_AIM] aimImage has 0 width - load failed`);
      }
      return;
    }

    ctx.save();

    const size = 180; // Dimensione dell'immagine
    const halfSize = size / 2;

    // Disegna l'immagine centrata sulla posizione dell'NPC
    ctx.globalAlpha = 0.9;
    ctx.drawImage(
      this.aimImage,
      screenX - halfSize,
      screenY - halfSize,
      size,
      size
    );

    if (PLAYTEST_CONFIG.ENABLE_DEBUG_MESSAGES) console.log(`[DEBUG_AIM] ‚úÖ Aim RENDERED for NPC at (${screenX.toFixed(1)}, ${screenY.toFixed(1)})`);
    ctx.restore();
  }

  /**
   * Renderizza un cerchio rosso di debug che mostra il range di attacco del player
   * Solo in modalit√† sviluppo (DEV)
   */


  /**
   * Renderizza il raggio di interesse di rete (5000 unit√†) intorno al player
   */
  private renderInterestRadius(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const playerEntity = this.playerSystem.getPlayerEntity();
    if (!playerEntity) return;

    const transform = this.ecs.getComponent(playerEntity, Transform);
    if (!transform) return;

    const { width, height } = this.displayManager.getLogicalSize();
    const screenPos = camera.worldToScreen(transform.x, transform.y, width, height);

    // Raggio in pixel (scalato dallo zoom della camera)
    const worldRadius = GAME_CONSTANTS.NETWORK.INTEREST_RADIUS;
    const screenRadius = worldRadius * (camera.zoom || 1);

    ctx.save();

    // Disegna il cerchio esterno
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)'; // Cyan semi-trasparente
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]); // Tratteggiato
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Riempimento leggero
    ctx.fillStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.fill();

    // Etichetta testo
    ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Network Interest Radius: ${worldRadius} units`, screenPos.x, screenPos.y - screenRadius - 10);

    ctx.restore();
  }

  private renderResourceHitboxDebug(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const entities = this.ecs.getEntitiesWithComponents(Transform, ResourceNode);
    if (!entities.length) return;

    const { width, height } = this.displayManager.getLogicalSize();
    const zoom = camera?.zoom || 1;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.85)';
    ctx.fillStyle = 'rgba(0, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);

    for (const entity of entities) {
      const transform = this.ecs.getComponent(entity, Transform);
      const resourceNode = this.ecs.getComponent(entity, ResourceNode);
      if (!transform || !resourceNode || !resourceNode.debugHitbox) continue;

      const screenPos = camera.worldToScreen(transform.x, transform.y, width, height);
      const radius = Math.max(4, resourceNode.clickRadius * zoom);

      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }


}

