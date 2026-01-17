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
import { Damage } from '../../entities/combat/Damage';
import { getPlayerRangeWidth, getPlayerRangeHeight } from '../../config/PlayerConfig';
import { Explosion } from '../../entities/combat/Explosion';
import { RepairEffect } from '../../entities/combat/RepairEffect';
import { Projectile } from '../../entities/combat/Projectile';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';
import { RemotePlayer } from '../../entities/player/RemotePlayer';
import { Camera } from '../../entities/spatial/Camera';
import { CameraSystem } from './CameraSystem';
import { PlayerSystem } from '../player/PlayerSystem';
import { ParallaxLayer } from '../../entities/spatial/ParallaxLayer';
import { Portal } from '../../entities/spatial/Portal';
import { SpaceStation } from '../../entities/spatial/SpaceStation';
import { Sprite } from '../../entities/Sprite';
import { AnimatedSprite } from '../../entities/AnimatedSprite';
import { Velocity } from '../../entities/spatial/Velocity';
import { NpcRenderer } from '../../utils/helpers/NpcRenderer';
import { ProjectileRenderer } from '../../utils/helpers/ProjectileRenderer';
import type { ProjectileRenderParams } from '../../utils/helpers/ProjectileRenderer';
import { PlayerRenderer } from '../../utils/helpers/PlayerRenderer';
import { SpaceStationRenderer } from '../../utils/helpers/SpaceStationRenderer';
import { HudRenderer } from '../../utils/helpers/HudRenderer';
import type { HealthBarRenderParams } from '../../utils/helpers/HudRenderer';
import { ExplosionRenderer } from '../../utils/helpers/ExplosionRenderer';
import type { ExplosionRenderParams } from '../../utils/helpers/ExplosionRenderer';
import { RepairEffectRenderer } from '../../utils/helpers/RepairEffectRenderer';
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
  private portalAnimationTime: number = 0; // Tempo per l'animazione del portale
  private readonly PORTAL_ANIMATION_FRAME_DURATION = 16.67; // ms per frame (~60fps)

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
        repairEffect: this.ecs.getComponent(entity, RepairEffect),
        velocity: this.ecs.getComponent(entity, Velocity),
        health: this.ecs.getComponent(entity, Health),
        shield: this.ecs.getComponent(entity, Shield),
        remotePlayer: this.ecs.getComponent(entity, RemotePlayer)
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
      velocity?: Velocity
    },
    camera?: Camera
  ): void {
    const { explosion, repairEffect, npc, sprite, animatedSprite, velocity } = components;
    
    const playerEntity = this.playerSystem.getPlayerEntity();
    const isPlayerEntity = playerEntity === entity;
    const isRemotePlayer = this.ecs.hasComponent(entity, RemotePlayer);

    // Priority: Explosions > Repair Effects > NPC > Player > Remote Player
    if (explosion) {
      this.renderExplosion(ctx, transform, explosion, screenX, screenY);
    } else if (repairEffect) {
      this.renderRepairEffect(ctx, transform, repairEffect, screenX, screenY);
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
      // Render player - usa isPlayerEntity già definito all'inizio del metodo
      if (isPlayerEntity) {
        // IMPORTANTE: Recupera AnimatedSprite direttamente dall'ECS invece di usare la cache
        // La cache potrebbe non essere aggiornata se il componente è stato aggiunto dopo
        const entityAnimatedSprite = this.ecs.getComponent(entity, AnimatedSprite);
        const entitySprite = this.ecs.getComponent(entity, Sprite);
        
        const floatOffsetY = PlayerRenderer.getFloatOffset(this.frameTime);
        
        
        // Renderizza fiamme del motore PRIMA della nave (sotto nello z-order)
        if (velocity && this.engflamesSprite && this.engflamesOpacity > 0) {
          const isMoving = Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1;
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
        return; // Player renderizzato, esci immediatamente per evitare doppio rendering
      } else if (isRemotePlayer) {
        // Render remote player - similar to local player but without engine flames
        const entityAnimatedSprite = this.ecs.getComponent(entity, AnimatedSprite);
        const entitySprite = this.ecs.getComponent(entity, Sprite);
        
        // Aggiungi float offset per allineare con player locale
        const floatOffsetY = PlayerRenderer.getFloatOffset(this.frameTime);
        
        if (entityAnimatedSprite) {
          // Verifica che l'immagine esista e abbia dimensioni valide
          const img = entityAnimatedSprite.spritesheet?.image;
          if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
            const zoom = camera?.zoom || 1;
            const renderTransform: SpritesheetRenderTransform = {
              x: screenX, y: screenY + floatOffsetY, rotation: transform.rotation, 
              scaleX: (transform.scaleX || 1) * zoom, 
              scaleY: (transform.scaleY || 1) * zoom
            };
            SpritesheetRenderer.render(ctx, renderTransform, entityAnimatedSprite);
          }
        } else if (entitySprite && entitySprite.isLoaded()) {
          // Fallback to sprite renderer
          const zoom = camera?.zoom || 1;
          const renderTransform: RenderableTransform = {
            x: screenX, y: screenY + floatOffsetY, rotation: transform.rotation, 
            scaleX: (transform.scaleX || 1) * zoom, 
            scaleY: (transform.scaleY || 1) * zoom
          };
          SpriteRenderer.render(ctx, renderTransform, entitySprite);
        }
      } else {
        // Render portals and space stations
        const isPortal = this.ecs.hasComponent(entity, Portal);
        const isSpaceStation = this.ecs.hasComponent(entity, SpaceStation);
        
        if (isPortal) {
          const entityAnimatedSprite = this.ecs.getComponent(entity, AnimatedSprite);
          const entitySprite = this.ecs.getComponent(entity, Sprite);
          
          if (entityAnimatedSprite) {
            // Verifica che l'immagine esista e abbia dimensioni valide
            const img = entityAnimatedSprite.spritesheet?.image;
            if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
              const zoom = camera?.zoom || 1;
              const renderTransform: SpritesheetRenderTransform = {
                x: screenX, y: screenY, rotation: transform.rotation, 
                scaleX: (transform.scaleX || 1) * zoom, 
                scaleY: (transform.scaleY || 1) * zoom
              };
              
              // Portali: usa animazione temporale (come GIF)
              const totalFrames = entityAnimatedSprite.frameCount;
              if (totalFrames > 0) {
                // Verifica se il portale è attivato (velocizzato)
                const portal = this.ecs.getComponent(entity, Portal);
                const isActivated = portal?.isActivated() || false;
                
                // Velocizza animazione se attivato (3x più veloce)
                const frameDuration = isActivated 
                  ? this.PORTAL_ANIMATION_FRAME_DURATION / 3 
                  : this.PORTAL_ANIMATION_FRAME_DURATION;
                
                const frameIndex = Math.floor((this.portalAnimationTime / frameDuration) % totalFrames);
                SpritesheetRenderer.renderByIndex(ctx, renderTransform, entityAnimatedSprite, frameIndex);
              } else {
                // Fallback a rendering normale se non ci sono frame
                SpritesheetRenderer.render(ctx, renderTransform, entityAnimatedSprite);
              }
            }
          } else if (entitySprite && entitySprite.isLoaded()) {
            const zoom = camera?.zoom || 1;
            const renderTransform: RenderableTransform = {
              x: screenX, y: screenY, rotation: transform.rotation, 
              scaleX: (transform.scaleX || 1) * zoom, 
              scaleY: (transform.scaleY || 1) * zoom
            };
            SpriteRenderer.render(ctx, renderTransform, entitySprite);
          }
        } else if (isSpaceStation) {
          // Render space station con fluttuazione verticale
          const entitySprite = this.ecs.getComponent(entity, Sprite);
          
          if (entitySprite && entitySprite.isLoaded()) {
            const floatOffsetY = SpaceStationRenderer.getFloatOffset(this.frameTime);
            
            const zoom = camera?.zoom || 1;
            const renderTransform: RenderableTransform = {
              x: screenX, y: screenY + floatOffsetY, rotation: transform.rotation, 
              scaleX: (transform.scaleX || 1) * zoom, 
              scaleY: (transform.scaleY || 1) * zoom
            };
            SpriteRenderer.render(ctx, renderTransform, entitySprite);
          }
        }
        // Se non è un portale/space station e non è player/remote player/NPC/explosion, non renderizzare
      }
    }
  }

  update(deltaTime: number): void {
    // Il rendering avviene nel metodo render()
    // Aggiorna animazione fiamme usando deltaTime
    this.engflamesAnimationTime += deltaTime;
    // Aggiorna animazione portale
    this.portalAnimationTime += deltaTime;
    // Aggiorna timestamp frame per sincronizzare float offset
    this.frameTime += deltaTime;
    
    const playerEntity = this.playerSystem.getPlayerEntity();
    if (!playerEntity) return;

    const velocity = this.ecs.getComponent(playerEntity, Velocity);
    const isMoving = velocity ? (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1) : false;
    
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

    // Salva stato e applica opacità
    ctx.save();
    ctx.globalAlpha = worldOpacity;
    // Svuota cache componenti ad ogni frame per dati freschi
    this.clearComponentCache();

    const camera = this.cameraSystem.getCamera();

    // Render entities and health/shield bars
    this.renderEntities(ctx, camera);

    // Render projectiles
    this.renderProjectiles(ctx, camera);

    // Render damage text (floating numbers)
    if (this.damageTextSystem && typeof this.damageTextSystem.render === 'function') {
      this.damageTextSystem.render(ctx);
    }
    
    // Render debug range circle for player (only in development) - SOPRA TUTTO
    // if (import.meta.env.DEV) {
    //   this.renderPlayerRangeCircle(ctx, camera);
    // }

    // Ripristina opacità
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

    const playerEntity = this.playerSystem.getPlayerEntity();
    
    // Rimuovi il player dalla lista per evitare doppio rendering
    const entitiesWithoutPlayer = playerEntity 
      ? entities.filter(entity => entity !== playerEntity)
      : entities;
    
    // Render space stations PRIMA di tutte le altre entità (più in background)
    const spaceStations = entitiesWithoutPlayer.filter(entity => 
      this.ecs.hasComponent(entity, SpaceStation)
    );
    for (const entity of spaceStations) {
      const components = this.getCachedComponents(entity);
      if (components.transform) {
        const { width, height } = this.displayManager.getLogicalSize();
        const screenPos = ScreenSpace.toScreen(components.transform, camera, width, height);
        this.renderGameEntity(ctx, entity, components.transform, screenPos.x, screenPos.y, {
          explosion: components.explosion,
          repairEffect: components.repairEffect,
          npc: components.npc,
          sprite: components.sprite,
          animatedSprite: components.animatedSprite,
          velocity: components.velocity
        }, camera);
      }
    }
    
    // Render altre entità (portali, NPC, ecc.) - player verrà renderizzato dopo
    const otherEntities = entitiesWithoutPlayer.filter(entity => 
      !this.ecs.hasComponent(entity, SpaceStation)
    );
    for (const entity of otherEntities) {
      // OTTIMIZZAZIONE: Usa cache componenti invece di chiamate ripetute getComponent()
      const components = this.getCachedComponents(entity);

      // Skip projectiles (rendered separately)
      if (components.projectile) continue;

      // Skip parallax entities (rendered by ParallaxSystem)
      if (components.parallax) continue;

      if (components.transform) {
        const { width, height } = this.displayManager.getLogicalSize();
        const screenPos = ScreenSpace.toScreen(components.transform, camera, width, height);

        // Render entity
        this.renderGameEntity(ctx, entity, components.transform, screenPos.x, screenPos.y, {
          explosion: components.explosion,
          repairEffect: components.repairEffect,
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
    
    // Render player DOPO tutte le altre entità (sopra portali, NPC e space stations)
    // This ensures the player is rendered on top with proper priority
    if (playerEntity) {
      const playerTransform = this.ecs.getComponent(playerEntity, Transform);
      
      if (playerTransform) {
        const { width, height } = this.displayManager.getLogicalSize();
        const screenPos = ScreenSpace.toScreen(playerTransform, camera, width, height);
        const components = this.getCachedComponents(playerEntity);
        
        // Render player entity
        this.renderGameEntity(ctx, playerEntity, playerTransform, screenPos.x, screenPos.y, {
          explosion: components.explosion,
          repairEffect: components.repairEffect,
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
      
      // For missiles, image points upward, so adjust rotation by -90 degrees (PI/2)
      if (projectile.projectileType === 'missile') {
        // Missile image points upward, so rotate from upward to direction
        ctx.rotate(rotation + Math.PI / 2);
      } else {
        // Other projectiles point right by default
      ctx.rotate(rotation);
      }
      
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
    // Reset cache ogni frame per includere nuovi missili
      this.projectileQueryCache = this.ecs.getEntitiesWithComponents(Transform, Projectile);
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
   * Render repair effect
   */
  private renderRepairEffect(ctx: CanvasRenderingContext2D, transform: Transform, repairEffect: RepairEffect, screenX: number, screenY: number): void {
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
   * Renderizza un cerchio rosso di debug che mostra il range di attacco del player
   * Solo in modalità sviluppo (DEV)
   */
  private renderPlayerRangeCircle(ctx: CanvasRenderingContext2D, camera: Camera | null): void {
    const playerEntity = this.playerSystem?.getPlayerEntity();
    if (!playerEntity) {
      return;
    }

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    const playerDamage = this.ecs.getComponent(playerEntity, Damage);

    if (!playerTransform || !playerDamage) {
      return;
    }

    // Converti coordinate mondo in coordinate schermo
    let screenPos = { x: 0, y: 0 };

    if (camera) {
      const canvas = ctx.canvas;
      if (canvas) {
        screenPos = camera.worldToScreen(playerTransform.x, playerTransform.y, canvas.width, canvas.height);
             } else {
               return;
             }
    } else {
      // Fallback se non c'è camera - usa coordinate mondo dirette (non funzionerà ma almeno non crasha)
      screenPos = { x: playerTransform.x, y: playerTransform.y };
    }

    // Applica zoom alla dimensione del rettangolo
    const zoom = camera?.zoom || 1;
    const rangeWidth = getPlayerRangeWidth();
    const rangeHeight = getPlayerRangeHeight();

    const rectWidth = rangeWidth / zoom;
    const rectHeight = rangeHeight / zoom;

    ctx.save();

    // Stile rettangolo di debug - PIÙ VISIBILE
    ctx.strokeStyle = '#FF0000'; // Rosso pieno
    ctx.lineWidth = 3; // Più spesso
    ctx.setLineDash([15, 8]); // Tratteggio più grande

    // Disegna il rettangolo del range centrato sul giocatore
    const rectX = screenPos.x - rectWidth / 2;
    const rectY = screenPos.y - rectHeight / 2;

    // Disegna il rettangolo (due volte per essere più visibile)
    for (let i = 0; i < 2; i++) {
      ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
    }

    // Etichetta range - PIÙ VISIBILE
    ctx.fillStyle = '#FF0000'; // Rosso pieno
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`RANGE: ${rangeWidth}x${rangeHeight}px`, screenPos.x, screenPos.y - rectHeight / 2 - 15);


    ctx.restore();
  }

}
