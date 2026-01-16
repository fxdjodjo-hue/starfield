import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { AssetManager } from '../../infrastructure/AssetManager';
import { DisplayManager } from '../../infrastructure/display';
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
import { AnimatedSprite } from '../../entities/AnimatedSprite';
import { Velocity } from '../../entities/spatial/Velocity';
import { NpcRenderer } from '../../utils/helpers/NpcRenderer';
import { ProjectileRenderer } from '../../utils/helpers/ProjectileRenderer';
import type { ProjectileRenderParams } from '../../utils/helpers/ProjectileRenderer';
import { PlayerRenderer } from '../../utils/helpers/PlayerRenderer';
import { HudRenderer } from '../../utils/helpers/HudRenderer';
import type { HealthBarRenderParams } from '../../utils/helpers/HudRenderer';
import { ExplosionRenderer } from '../../utils/helpers/ExplosionRenderer';
import type { ExplosionRenderParams } from '../../utils/helpers/ExplosionRenderer';
import { EngineFlamesRenderer } from '../../utils/helpers/EngineFlamesRenderer';
import { ScreenSpace } from '../../utils/helpers/ScreenSpace';
import { SpriteRenderer } from '../../utils/helpers/SpriteRenderer';
import type { RenderableTransform } from '../../utils/helpers/SpriteRenderer';
import { SpritesheetRenderer } from '../../utils/helpers/SpritesheetRenderer';
import type { SpritesheetRenderTransform } from '../../utils/helpers/SpritesheetRenderer';

/**
 * Sistema di rendering per Canvas 2D
 * Renderizza tutte le entità con componente Transform applicando la camera
 */
export class RenderSystem extends BaseSystem {
  private cameraSystem: CameraSystem;
  private playerSystem: PlayerSystem;
  private assetManager: AssetManager;
  private projectileRenderer: ProjectileRenderer;
  private displayManager: DisplayManager;
  private damageTextSystem: any = null; // Sistema per renderizzare i testi di danno
  private componentCache: Map<Entity, any> = new Map(); // Cache componenti per ottimizzazione
  private entityQueryCache: Entity[] = []; // Cache risultati query ECS
  private projectileQueryCache: Entity[] = []; // Cache risultati query proiettili
  private aimImage: HTMLImageElement | null = null; // Immagine per la selezione NPC
  private healthBarsFadeStartTime: number | null = null; // Timestamp quando inizia il fade delle health bars
  private readonly HEALTH_BARS_FADE_DURATION = 500; // Durata fade in millisecondi
  private engflamesSprite: AnimatedSprite | null = null; // Sprite per le fiamme del motore
  private engflamesAnimationTime: number = 0; // Tempo per l'animazione delle fiamme
  private engflamesOpacity: number = 0; // Opacità delle fiamme (0-1) per fade in/out
  private engflamesWasMoving: boolean = false; // Stato movimento precedente per fade
  private readonly ENGFLAMES_FADE_SPEED = 0.15; // Velocità fade in/out (per frame)
  private frameTime: number = 0; // Timestamp sincronizzato con frame rate per float offset

  constructor(ecs: ECS, cameraSystem: CameraSystem, playerSystem: PlayerSystem, assetManager: AssetManager) {
    super(ecs);
    this.cameraSystem = cameraSystem;
    this.playerSystem = playerSystem;
    this.assetManager = assetManager;
    this.projectileRenderer = new ProjectileRenderer(ecs, playerSystem, assetManager);
    this.displayManager = DisplayManager.getInstance();
  }

  /**
   * Imposta il riferimento al DamageTextSystem per il rendering
   */
  setDamageTextSystem(damageTextSystem: any): void {
    this.damageTextSystem = damageTextSystem;
  }

  /**
   * Imposta lo sprite per le fiamme del motore
   */
  setEngflamesSprite(sprite: AnimatedSprite): void {
    this.engflamesSprite = sprite;
  }

  /**
   * Ottieni componenti con caching per ottimizzazione performance
   */
  private getCachedComponents(entity: Entity): any {
    if (!this.componentCache.has(entity)) {
      this.componentCache.set(entity, {
        transform: this.ecs.getComponent(entity, Transform),
        npc: this.ecs.getComponent(entity, Npc),
        projectile: this.ecs.getComponent(entity, Projectile),
        parallax: this.ecs.getComponent(entity, ParallaxLayer),
        sprite: this.ecs.getComponent(entity, Sprite),
        animatedSprite: this.ecs.getComponent(entity, AnimatedSprite),
        explosion: this.ecs.getComponent(entity, Explosion),
        velocity: this.ecs.getComponent(entity, Velocity),
        health: this.ecs.getComponent(entity, Health),
        shield: this.ecs.getComponent(entity, Shield)
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
      animatedSprite?: AnimatedSprite,
      velocity?: Velocity
    },
    camera?: Camera
  ): void {
    const { explosion, npc, sprite, animatedSprite, velocity } = components;
    
    const playerEntity = this.playerSystem.getPlayerEntity();
    const isPlayerEntity = playerEntity === entity;

    // Priority: Explosions > NPC > Player
    if (explosion) {
      this.renderExplosion(ctx, transform, explosion, screenX, screenY);
    } else if (npc) {
      // Render NPC - supporta sia AnimatedSprite che Sprite
      const entityAnimatedSprite = this.ecs.getComponent(entity, AnimatedSprite);
      const entitySprite = this.ecs.getComponent(entity, Sprite);
      
      // Renderizza aim PRIMA dello sprite NPC (sotto) con gli stessi offset dello sprite
      const isSelected = this.ecs.hasComponent(entity, SelectedNpc);
      if (isSelected) {
        // Ottieni offset dallo sprite per centrare correttamente l'aim
        let offsetX = 0;
        let offsetY = 0;
        if (entityAnimatedSprite) {
          offsetX = entityAnimatedSprite.offsetX;
          offsetY = entityAnimatedSprite.offsetY;
        } else if (entitySprite) {
          offsetX = entitySprite.offsetX;
          offsetY = entitySprite.offsetY;
        }
        this.renderSelectionCircle(ctx, screenX + offsetX, screenY + offsetY);
      }
      
      // Controlla se è un NPC remoto (server authoritative)
      const authority = this.ecs.getComponent(entity, Authority);
      const isRemoteNpc = authority && authority.authorityLevel === AuthorityLevel.SERVER_AUTHORITATIVE;

      if (entityAnimatedSprite) {
        // NPC con spritesheet: usa SpritesheetRenderer (stesso sistema del player)
        const zoom = camera?.zoom || 1;
        const renderTransform: SpritesheetRenderTransform = {
          x: screenX, y: screenY, rotation: transform.rotation, 
          scaleX: (transform.scaleX || 1) * zoom, 
          scaleY: (transform.scaleY || 1) * zoom
        };
        SpritesheetRenderer.render(ctx, renderTransform, entityAnimatedSprite);
      } else if (entitySprite) {
        // NPC con sprite normale
        const zoom = camera?.zoom || 1;
        if (isRemoteNpc) {
          // NPC remoto: usa direttamente transform.rotation
          const renderTransform: RenderableTransform = {
            x: screenX, y: screenY, rotation: transform.rotation, 
            scaleX: (transform.scaleX || 1) * zoom, 
            scaleY: (transform.scaleY || 1) * zoom
          };
          SpriteRenderer.render(ctx, renderTransform, entitySprite);
        } else {
          // NPC locale: usa NpcRenderer per calcolare la rotazione
          const rotationAngle = NpcRenderer.getRenderRotation(npc, transform, velocity);
          const renderTransform: RenderableTransform = {
            x: screenX, y: screenY, rotation: 0, 
            scaleX: (transform.scaleX || 1) * zoom, 
            scaleY: (transform.scaleY || 1) * zoom
          };
          SpriteRenderer.render(ctx, renderTransform, entitySprite, rotationAngle);
        }
      }
    } else {
      // Render player - verifica esplicitamente che sia il player
      const playerEntity = this.playerSystem.getPlayerEntity();
      const isPlayer = playerEntity === entity;
      
      if (isPlayer) {
        // IMPORTANTE: Recupera AnimatedSprite direttamente dall'ECS invece di usare la cache
        // La cache potrebbe non essere aggiornata se il componente è stato aggiunto dopo
        const entityAnimatedSprite = this.ecs.getComponent(entity, AnimatedSprite);
        const entitySprite = this.ecs.getComponent(entity, Sprite);
        
        const floatOffsetY = PlayerRenderer.getFloatOffset(this.frameTime);
        
        // Renderizza fiamme del motore PRIMA della nave (sotto nello z-order)
        const playerVelocity = this.ecs.getComponent(entity, Velocity);
        if (playerVelocity && this.engflamesSprite && this.engflamesOpacity > 0) {
          const isMoving = Math.abs(playerVelocity.x) > 0.1 || Math.abs(playerVelocity.y) > 0.1;
          if (isMoving) {
            const params = EngineFlamesRenderer.getRenderParams(
              transform,
              screenX,
              screenY + floatOffsetY,
              this.engflamesAnimationTime,
              this.engflamesOpacity,
              camera
            );
            if (params) {
              EngineFlamesRenderer.render(ctx, this.engflamesSprite, params);
            }
          }
        }
        
        // Priority: AnimatedSprite > Sprite
        // Forza il rendering anche se isLoaded() ritorna false, verifica solo dimensioni
        if (entityAnimatedSprite) {
          // Verifica che l'immagine esista e abbia dimensioni valide
          const img = entityAnimatedSprite.spritesheet?.image;
          if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
            // Use spritesheet renderer (no canvas rotation - frame is pre-rotated)
            const zoom = camera?.zoom || 1;
            const renderTransform: SpritesheetRenderTransform = {
              x: screenX, y: screenY + floatOffsetY, rotation: transform.rotation, 
              scaleX: (transform.scaleX || 1) * zoom, 
              scaleY: (transform.scaleY || 1) * zoom
            };
            SpritesheetRenderer.render(ctx, renderTransform, entityAnimatedSprite);
          }
        } else if (entitySprite && entitySprite.isLoaded()) {
          // Fallback to old sprite renderer
          const zoom = camera?.zoom || 1;
          const renderTransform: RenderableTransform = {
            x: screenX, y: screenY + floatOffsetY, rotation: transform.rotation, 
            scaleX: (transform.scaleX || 1) * zoom, 
            scaleY: (transform.scaleY || 1) * zoom
          };
          SpriteRenderer.render(ctx, renderTransform, entitySprite);
        }
      }
    }
  }

  update(deltaTime: number): void {
    // Il rendering avviene nel metodo render()
    // Aggiorna animazione fiamme usando deltaTime
    this.engflamesAnimationTime += deltaTime;
    // Aggiorna timestamp frame per sincronizzare float offset
    this.frameTime += deltaTime;
    
    // Gestisci fade in/out delle fiamme
    const playerEntity = this.playerSystem.getPlayerEntity();
    if (playerEntity && this.engflamesSprite) {
      const velocity = this.ecs.getComponent(playerEntity, Velocity);
      const isMoving = velocity ? (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1) : false;
      
      // Fade in quando inizia a muoversi, fade out quando si ferma
      if (isMoving) {
        // Fade in
        this.engflamesOpacity = Math.min(1, this.engflamesOpacity + this.ENGFLAMES_FADE_SPEED);
      } else {
        // Fade out
        this.engflamesOpacity = Math.max(0, this.engflamesOpacity - this.ENGFLAMES_FADE_SPEED);
      }
      
      this.engflamesWasMoving = isMoving;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Svuota cache componenti ad ogni frame per dati freschi
    this.clearComponentCache();

    const camera = this.cameraSystem.getCamera();

    // Render entities and health/shield bars
    this.renderEntities(ctx, camera);

    // Render projectiles
    this.renderProjectiles(ctx, camera);

    // Render player range circle (for debugging)
    this.renderPlayerRange(ctx, camera);

    // Render damage text (floating numbers)
    if (this.damageTextSystem && typeof this.damageTextSystem.render === 'function') {
      this.damageTextSystem.render(ctx);
    }
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

    const playerEntity = this.playerSystem.getPlayerEntity();
    
    // Render player separately if it's not in the entities list
    // This handles the case where the player entity exists but wasn't found by the query
    // The cache might be populated before the player has Transform, or the query might miss it
    if (playerEntity) {
      const playerTransform = this.ecs.getComponent(playerEntity, Transform);
      const isPlayerInList = entities.includes(playerEntity);
      
      if (playerTransform && !isPlayerInList) {
        const { width, height } = this.displayManager.getLogicalSize();
        const screenPos = ScreenSpace.toScreen(playerTransform, camera, width, height);
        const components = this.getCachedComponents(playerEntity);
        
        // Render player entity
        this.renderGameEntity(ctx, playerEntity, playerTransform, screenPos.x, screenPos.y, {
          explosion: components.explosion,
          npc: components.npc,
          sprite: components.sprite,
          animatedSprite: components.animatedSprite,
          velocity: components.velocity
        }, camera);

        // Render health/shield bars con fade quando l'animazione zoom è completata
        const isZoomAnimating = this.cameraSystem.isZoomAnimationActive ? this.cameraSystem.isZoomAnimationActive() : false;
        if (!isZoomAnimating && (components.health || components.shield)) {
          // Inizia il fade quando l'animazione è appena completata
          if (this.healthBarsFadeStartTime === null) {
            this.healthBarsFadeStartTime = Date.now();
          }
          this.renderHealthBars(ctx, screenPos.x, screenPos.y, components.health || null, components.shield || null);
        } else if (isZoomAnimating) {
          // Reset fade quando l'animazione ricomincia
          this.healthBarsFadeStartTime = null;
        }
      }
    }
    
    for (const entity of entities) {
      // OTTIMIZZAZIONE: Usa cache componenti invece di chiamate ripetute getComponent()
      const components = this.getCachedComponents(entity);

      // Skip projectiles (rendered separately)
      if (components.projectile) continue;

      // Skip parallax entities (rendered by ParallaxSystem)
      if (components.parallax) continue;

      // Skip player if already rendered above
      if (playerEntity === entity) continue;

      if (components.transform) {
        const { width, height } = this.displayManager.getLogicalSize();
        const screenPos = ScreenSpace.toScreen(components.transform, camera, width, height);

        // Render entity
        this.renderGameEntity(ctx, entity, components.transform, screenPos.x, screenPos.y, {
          explosion: components.explosion,
          npc: components.npc,
          sprite: components.sprite,
          animatedSprite: components.animatedSprite,
          velocity: components.velocity
        }, camera);

        // Render health/shield bars con fade quando l'animazione zoom è completata
        const isZoomAnimating = this.cameraSystem.isZoomAnimationActive ? this.cameraSystem.isZoomAnimationActive() : false;
        if (!isZoomAnimating && (components.health || components.shield)) {
          // Inizia il fade quando l'animazione è appena completata
          if (this.healthBarsFadeStartTime === null) {
            this.healthBarsFadeStartTime = Date.now();
          }
          this.renderHealthBars(ctx, screenPos.x, screenPos.y, components.health || null, components.shield || null);
        } else if (isZoomAnimating) {
          // Reset fade quando l'animazione ricomincia
          this.healthBarsFadeStartTime = null;
        }
      }
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
      // Render as image-based projectile with rotation
      // Calculate rotation angle from projectile direction (sprite points right by default)
      const rotation = Math.atan2(projectile.directionY, projectile.directionX);
      
      // Preserve original image aspect ratio
      const img = params.image;
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      const width = params.imageSize;
      const height = params.imageSize / aspectRatio;
      
      ctx.translate(screenPos.x, screenPos.y);
      ctx.rotate(rotation);
      ctx.drawImage(
        img,
        -width / 2,
        -height / 2,
        width,
        height
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
    // OTTIMIZZAZIONE: Cache risultati query ECS invece di chiamare ogni volta
    if (this.projectileQueryCache.length === 0) {
      this.projectileQueryCache = this.ecs.getEntitiesWithComponents(Transform, Projectile);
    }
    const projectiles = this.projectileQueryCache;

    for (const projectileEntity of projectiles) {
      // OTTIMIZZAZIONE: Usa cache componenti
      const components = this.getCachedComponents(projectileEntity);

      if (!components.transform || !components.projectile) continue;

      // Convert world coordinates to screen coordinates
      const { width, height } = this.displayManager.getLogicalSize();
      const screenPos = ScreenSpace.toScreen(components.transform, camera, width, height);

      this.renderProjectile(ctx, components.projectile, screenPos);
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
   * Render selection image around selected NPCs
   */
  private renderSelectionCircle(ctx: CanvasRenderingContext2D, screenX: number, screenY: number): void {
    // Carica l'immagine in modo lazy se non è già caricata
    if (!this.aimImage) {
      this.aimImage = this.assetManager.getOrLoadImage('/assets/aim/aim.png');
    }

    // Se l'immagine non è ancora caricata, non renderizzare nulla
    if (!this.aimImage || !this.aimImage.complete || this.aimImage.naturalWidth === 0) {
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

    ctx.restore();
  }

  /**
   * Render player attack range circle (600px radius)
   */
  private renderPlayerRange(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const playerEntity = this.playerSystem.getPlayerEntity();
    if (!playerEntity) return;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    if (!playerTransform) return;

    // Converte posizione mondo a schermo
    const { width, height } = this.displayManager.getLogicalSize();
    const screenPos = camera.worldToScreen(playerTransform.x, playerTransform.y, width, height);

    const radius = 600; // Raggio del range di attacco del player (600px)
    const screenRadius = radius * camera.zoom; // Scala con lo zoom della camera

    ctx.save();

    // Cerchio di range - giallo semitrasparente
    ctx.strokeStyle = '#ffff00'; // Giallo
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.3; // Molto trasparente
    ctx.setLineDash([10, 5]); // Linea tratteggiata

    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }


}
