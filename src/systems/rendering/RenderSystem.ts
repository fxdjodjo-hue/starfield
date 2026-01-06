import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { AssetManager } from '../../infrastructure/AssetManager';
import { Transform } from '../../entities/spatial/Transform';
import { Authority, AuthorityLevel } from '../../entities/spatial/Authority';
import { Npc } from '../../entities/ai/Npc';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Explosion } from '../../entities/combat/Explosion';
import { Projectile } from '../../entities/combat/Projectile';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';
import { Camera } from '../../entities/spatial/Camera';
import { CameraSystem } from './CameraSystem';
import { PlayerSystem } from '../player/PlayerSystem';
import { ParallaxLayer } from '../../entities/spatial/ParallaxLayer';
import { Sprite } from '../../entities/Sprite';
import { Velocity } from '../../entities/spatial/Velocity';
import { NpcRenderer } from '../../utils/helpers/NpcRenderer';
import { ProjectileRenderer } from '../../utils/helpers/ProjectileRenderer';
import type { ProjectileRenderParams } from '../../utils/helpers/ProjectileRenderer';
import { PlayerRenderer } from '../../utils/helpers/PlayerRenderer';
import { HudRenderer } from '../../utils/helpers/HudRenderer';
import type { HealthBarRenderParams } from '../../utils/helpers/HudRenderer';
import { ExplosionRenderer } from '../../utils/helpers/ExplosionRenderer';
import type { ExplosionRenderParams } from '../../utils/helpers/ExplosionRenderer';
import { ScreenSpace } from '../../utils/helpers/ScreenSpace';
import { SpriteRenderer } from '../../utils/helpers/SpriteRenderer';
import type { RenderableTransform } from '../../utils/helpers/SpriteRenderer';

/**
 * Sistema di rendering per Canvas 2D
 * Renderizza tutte le entità con componente Transform applicando la camera
 */
export class RenderSystem extends BaseSystem {
  private cameraSystem: CameraSystem;
  private playerSystem: PlayerSystem;
  private assetManager: AssetManager;
  private projectileRenderer: ProjectileRenderer;

  constructor(ecs: ECS, cameraSystem: CameraSystem, playerSystem: PlayerSystem, assetManager: AssetManager) {
    super(ecs);
    this.cameraSystem = cameraSystem;
    this.playerSystem = playerSystem;
    this.assetManager = assetManager;
    this.projectileRenderer = new ProjectileRenderer(ecs, playerSystem, assetManager);
  }


  /**
   * Render game entity (NPC, Player, or Explosion)
   */
  private renderGameEntity(
    ctx: CanvasRenderingContext2D,
    entity: Entity,
    transform: Transform,
    screenX: number,
    screenY: number,
    components: {
      explosion?: Explosion,
      npc?: Npc,
      sprite?: Sprite,
      velocity?: Velocity
    }
  ): void {
    const { explosion, npc, sprite, velocity } = components;

    // Priority: Explosions > NPC > Player
    if (explosion) {
      this.renderExplosion(ctx, transform, explosion, screenX, screenY);
    } else if (npc) {
      // Render NPC - differenzia tra locali e remoti
      const entitySprite = this.ecs.getComponent(entity, Sprite);
      if (entitySprite) {
        // Controlla se è un NPC remoto (server authoritative)
        const authority = this.ecs.getComponent(entity, Authority);
        const isRemoteNpc = authority && authority.authorityLevel === AuthorityLevel.SERVER_AUTHORITATIVE;

        if (isRemoteNpc) {
          // NPC remoto: usa direttamente transform.rotation (come i remote player)
          const renderTransform: RenderableTransform = {
            x: screenX, y: screenY, rotation: transform.rotation, scaleX: transform.scaleX, scaleY: transform.scaleY
          };
          SpriteRenderer.render(ctx, renderTransform, entitySprite);
        } else {
          // NPC locale: usa NpcRenderer per calcolare la rotazione
          const rotationAngle = NpcRenderer.getRenderRotation(npc, transform, velocity);
          const renderTransform: RenderableTransform = {
            x: screenX, y: screenY, rotation: 0, scaleX: transform.scaleX, scaleY: transform.scaleY
          };
          SpriteRenderer.render(ctx, renderTransform, entitySprite, rotationAngle);
        }

        // Disegna cerchio di selezione rosso attorno agli NPC selezionati
        const isSelected = this.ecs.hasComponent(entity, SelectedNpc);
        if (isSelected) {
          this.renderSelectionCircle(ctx, screenX, screenY);
        }
      }
    } else {
      // Render player with float effect
      if (sprite) {
        const floatOffsetY = PlayerRenderer.getFloatOffset();
        const renderTransform: RenderableTransform = {
          x: screenX, y: screenY + floatOffsetY, rotation: transform.rotation, scaleX: transform.scaleX, scaleY: transform.scaleY
        };
        SpriteRenderer.render(ctx, renderTransform, sprite);
      }
    }
  }

  update(deltaTime: number): void {
    // Il rendering avviene nel metodo render()
  }

  render(ctx: CanvasRenderingContext2D): void {
    const camera = this.cameraSystem.getCamera();

    // Render entities and health/shield bars
    this.renderEntities(ctx, camera);

    // Render projectiles
    this.renderProjectiles(ctx, camera);
  }

  /**
   * Render entities and their health/shield bars
   */
  private renderEntities(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const entities = this.ecs.getEntitiesWithComponents(Transform);

    for (const entity of entities) {
      const transform = this.ecs.getComponent(entity, Transform);
      const npc = this.ecs.getComponent(entity, Npc);
      const projectile = this.ecs.getComponent(entity, Projectile);
      const parallax = this.ecs.getComponent(entity, ParallaxLayer);
      const sprite = this.ecs.getComponent(entity, Sprite);
      const explosion = this.ecs.getComponent(entity, Explosion);

      // Skip projectiles (rendered separately)
      if (projectile) continue;

      // Skip parallax entities (rendered by ParallaxSystem)
      if (parallax) continue;

      if (transform) {
        const screenPos = ScreenSpace.toScreen(transform, camera, ctx.canvas.width, ctx.canvas.height);

        // Render entity
        const entityVelocity = this.ecs.getComponent(entity, Velocity);
        this.renderGameEntity(ctx, entity, transform, screenPos.x, screenPos.y, {
          explosion, npc, sprite, velocity: entityVelocity
        });

        // Render health/shield bars
        const health = this.ecs.getComponent(entity, Health);
        const shield = this.ecs.getComponent(entity, Shield);
        if (health || shield) {
          this.renderHealthBars(ctx, screenPos.x, screenPos.y, health || null, shield || null);
        }
      }
    }
  }



  /**
   * Render health and shield bars using HUD helper
   */
  private renderHealthBars(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, health: Health | null, shield: Shield | null): void {
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
  }

  /**
   * Render a single health bar using parameters
   */
  private renderHealthBar(ctx: CanvasRenderingContext2D, params: HealthBarRenderParams): void {
    // Background
    ctx.fillStyle = params.backgroundColor;
    ctx.fillRect(params.x, params.y, HudRenderer.getBarWidth(), params.height);

    // Fill
    ctx.fillStyle = params.fillColor;
    ctx.fillRect(params.x, params.y, params.width, params.height);

    // Border
    ctx.strokeStyle = params.borderColor;
    ctx.lineWidth = params.borderWidth;
    ctx.strokeRect(params.x, params.y, HudRenderer.getBarWidth(), params.height);
  }


  /**
   * Render a single projectile using render parameters from helper
   */
  private renderProjectile(ctx: CanvasRenderingContext2D, projectile: Projectile, screenPos: {x: number, y: number}): void {
    const params = this.projectileRenderer.getRenderParams(projectile);

    ctx.save();

    if (params.hasImage && params.imageSize && params.image) {
      // Render as image-based projectile
      ctx.drawImage(
        params.image,
        screenPos.x - params.imageSize / 2,
        screenPos.y - params.imageSize / 2,
        params.imageSize,
        params.imageSize
      );
    } else {
      // Render as laser line
      const endX = screenPos.x + projectile.directionX * params.length;
      const endY = screenPos.y + projectile.directionY * params.length;

      ctx.strokeStyle = params.color;
      ctx.lineWidth = params.lineWidth;
      ctx.lineCap = 'round';

      // Apply shadow effect if specified
      if (params.shadowColor && params.shadowBlur) {
        ctx.shadowColor = params.shadowColor;
        ctx.shadowBlur = params.shadowBlur;
      }

      ctx.beginPath();
      ctx.moveTo(screenPos.x, screenPos.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Add white center line for laser effect
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0; // Remove shadow for center line
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Render all projectiles
   */
  private renderProjectiles(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const projectiles = this.ecs.getEntitiesWithComponents(Transform, Projectile);

    for (const projectileEntity of projectiles) {
      const transform = this.ecs.getComponent(projectileEntity, Transform);
      const projectile = this.ecs.getComponent(projectileEntity, Projectile);

      if (!transform || !projectile) continue;

      // Convert world coordinates to screen coordinates
      const screenPos = ScreenSpace.toScreen(transform, camera, ctx.canvas.width, ctx.canvas.height);

      this.renderProjectile(ctx, projectile, screenPos);
    }
  }




  /**
   * Render explosion effect
   */
  private renderExplosion(ctx: CanvasRenderingContext2D, transform: Transform, explosion: Explosion, screenX: number, screenY: number): void {
    const params = ExplosionRenderer.getRenderParams(explosion, screenX, screenY);

    if (params && params.image) {
      ctx.save();
      ctx.drawImage(params.image, params.x, params.y, params.width, params.height);
      ctx.restore();
    }
  }

  /**
   * Render selection circle around selected NPCs
   */
  private renderSelectionCircle(ctx: CanvasRenderingContext2D, screenX: number, screenY: number): void {
    const radius = 35; // Raggio del cerchio di selezione
    const lineWidth = 3; // Spessore del bordo

    ctx.save();

    // Cerchio esterno (bordo rosso)
    ctx.strokeStyle = '#ff0000'; // Rosso
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = 0.8; // Semi-trasparente

    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Cerchio interno più sottile per effetto visivo
    ctx.strokeStyle = '#ff4444'; // Rosso più chiaro
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;

    ctx.beginPath();
    ctx.arc(screenX, screenY, radius - 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

}
