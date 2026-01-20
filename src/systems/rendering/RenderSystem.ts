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
import { Camera } from '../../entities/spatial/Camera';
import { CameraSystem } from './CameraSystem';
import { PlayerSystem } from '../player/PlayerSystem';
import { ParallaxLayer } from '../../entities/spatial/ParallaxLayer';
import { Portal } from '../../entities/spatial/Portal';
import { SpaceStation } from '../../entities/spatial/SpaceStation';
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
import { ScreenSpace } from '../../core/utils/rendering/ScreenSpace';
import { SpriteRenderer } from '../../core/utils/rendering/SpriteRenderer';

import type { RenderableTransform } from '../../core/utils/rendering/SpriteRenderer';
import { SpritesheetRenderer } from '../../core/utils/rendering/SpritesheetRenderer';
import type { SpritesheetRenderTransform } from '../../core/utils/rendering/SpritesheetRenderer';
import { ProjectileRenderer } from '../../core/utils/rendering/ProjectileRenderer';

/**
 * Sistema di rendering per Canvas 2D
 * Renderizza tutte le entità con componente Transform applicando la camera
 */
export class RenderSystem extends BaseSystem {
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
  private engflamesOpacity: number = 0; // Opacità delle fiamme (0-1) per fade in/out
  private engflamesWasMoving: boolean = false; // Stato movimento precedente per fade
  private readonly ENGFLAMES_FADE_SPEED = 0.15; // Velocità fade in/out (per frame)
  private frameTime: number = 0; // Timestamp sincronizzato con frame rate per float offset
  private portalAnimationTime: number = 0; // Tempo per l'animazione del portale
  private readonly PORTAL_ANIMATION_FRAME_DURATION = 16.67; // ms per frame (~60fps)

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
    console.log(`[DEBUG_FLAMES] setEngflamesSprite called with:`, sprite ? 'VALID sprite' : 'NULL sprite');
    if (sprite) {
      console.log(`[DEBUG_FLAMES] Sprite properties:`, {
        frames: sprite.spritesheet.frames?.length || 'no frames',
        frameWidth: sprite.spritesheet.frameWidth,
        frameHeight: sprite.spritesheet.frameHeight
      });
    }
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
    const visualState = components.projectile ? this.ecs.getComponent(entity, ProjectileVisualState) : null;
    if (visualState && !visualState.shouldRender()) {
      return; // Non renderizzare se lo stato visivo non lo permette
    }

    // Applica alpha per animazioni di fade se presente
    const shouldApplyAlpha = visualState && visualState.alpha < 1.0;
    if (shouldApplyAlpha) {
      ctx.save();
      ctx.globalAlpha *= visualState.alpha;
    }

    // GESTIONE SPECIALE PER LASER: calcola rotazione basata sulla direzione
    const isPlayerLaser = components.sprite && components.sprite.image?.src?.includes('laser1.png') && components.projectile && components.sprite.image.complete;
    const isNpcLaser = components.sprite && components.sprite.image?.src?.includes('npc_frigate_projectile.png') && components.projectile && components.sprite.image.complete;

    if (isPlayerLaser || isNpcLaser) {
      // Assicurati che tutti i componenti necessari siano presenti
      if (!components.sprite || !components.sprite.image || !components.projectile) {
        return;
      }

      // Calcola l'angolo di rotazione basato sulla direzione del proiettile
      const angle = Math.atan2(components.projectile.directionY, components.projectile.directionX);

      // Renderizza il laser con rotazione corretta
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(angle);

      // Il pivot dovrebbe essere all'inizio del laser (lato player/NPC)
      // Usa le dimensioni dello Sprite (che possono essere scalate)
      const laserWidth = components.sprite.width;
      const laserHeight = components.sprite.height;

      // Pivot all'inizio del laser (lato sinistro), centrato verticalmente
      ctx.drawImage(
        components.sprite.image,
        0,  // Pivot all'inizio (lato origine)
        -laserHeight / 2, // Centrato verticalmente
        laserWidth,
        laserHeight
      );

      ctx.restore();
      return; // Salta il rendering normale dello sprite
    }

    // Missiles removed - no longer supported
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
        console.log(`[DEBUG_AIM] ✅ Found SELECTED NPC ${entity.id} - aim should appear`);
      } else {
        // DEBUG: Log NPC senza selezione (solo uno ogni tanto per non spam)
        if (Math.random() < 0.005) { // 0.5% chance per non spam
          console.log(`[DEBUG_AIM] NPC ${entity.id} not selected - no aim visible`);
        }
      }

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
        const zoom = camera?.zoom || 1;
        const renderTransform: SpritesheetRenderTransform = {
          x: screenX, y: screenY, rotation: transform.rotation,
          scaleX: (transform.scaleX || 1) * zoom,
          scaleY: (transform.scaleY || 1) * zoom
        };

        // Tutti gli NPC: usa selezione basata su rotazione (normale)
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
    } else if (components.sprite || components.animatedSprite) {
      // Render generic sprites (projectiles, effects, etc.)
      this.renderGenericSprite(ctx, transform, components.sprite || null, components.animatedSprite || null, screenX, screenY, camera || null);
    } else {
      // Render player - usa isPlayerEntity già definito all'inizio del metodo
      if (isPlayerEntity) {
        // IMPORTANTE: Recupera AnimatedSprite direttamente dall'ECS invece di usare la cache
        // La cache potrebbe non essere aggiornata se il componente è stato aggiunto dopo
        const entityAnimatedSprite = this.ecs.getComponent(entity, AnimatedSprite);
        const entitySprite = this.ecs.getComponent(entity, Sprite);
        
        const floatOffsetY = PlayerRenderer.getFloatOffset(this.frameTime);
        
        
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
        // Render portals, space stations, pyramids, and laser beams
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
              
              // Portali e Pyramid: usa animazione temporale (come GIF)
              const totalFrames = entityAnimatedSprite.frameCount;
              if (totalFrames > 0) {
                let frameDuration = this.PORTAL_ANIMATION_FRAME_DURATION;

                // Portali: usa animazione temporale (come GIF)
                const frameIndex = Math.floor((this.portalAnimationTime / frameDuration) % totalFrames);
                SpritesheetRenderer.renderByIndex(ctx, renderTransform, entityAnimatedSprite, frameIndex);

                // Render "coming soon" text above portal
                this.renderComingSoonText(ctx, screenX, screenY, zoom);

                // Render "coming soon" text only for portals
                if (isPortal) {
                  this.renderComingSoonText(ctx, screenX, screenY, zoom);
                }
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

    // Ripristina context se era stato modificato per alpha
    if (shouldApplyAlpha) {
      ctx.restore();
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

    // DEBUG: Log velocity del player per fiamme motore
    if (!velocity) {
      console.log(`[DEBUG_FLAMES] Player has no Velocity component!`);
    } else if (!isMoving) {
      // Log solo occasionalmente per non spam
      if (Math.random() < 0.01) {
        console.log(`[DEBUG_FLAMES] Player not moving enough - velocity: (${velocity.x.toFixed(2)}, ${velocity.y.toFixed(2)})`);
      }
    } else {
      console.log(`[DEBUG_FLAMES] ✅ Player is MOVING! Velocity: (${velocity.x.toFixed(2)}, ${velocity.y.toFixed(2)}) - Flames should appear (opacity: ${this.engflamesOpacity})`);
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

    // DEBUG: Log opacità globale per investigare problema rendering
    if (worldOpacity < 1) {
      console.log(`[DEBUG_RENDER] worldOpacity: ${worldOpacity}, isZoomAnimating: ${isZoomAnimating}`);
    }
    if (worldOpacity === 1 && !isZoomAnimating) {
      console.log(`[DEBUG_RENDER] Zoom animation finished - opacity back to normal`);
    }

    // Salva stato e applica opacità
    ctx.save();
    ctx.globalAlpha = worldOpacity;
    // Svuota cache componenti ad ogni frame per dati freschi
    this.clearComponentCache();

    const camera = this.cameraSystem.getCamera();

    // Render entities and health/shield bars
    this.renderEntities(ctx, camera);


    // Render damage text (floating numbers)
    if (this.damageTextSystem && typeof this.damageTextSystem.render === 'function') {
      this.damageTextSystem.render(ctx);
    }

    // Render NPC beam effects (laser attacks) - TEMPORANEAMENTE DISABILITATO
    // TODO: Riabilitare dopo aver fixato il sistema di selezione NPC
    // Render debug range circle for player (only in development) - SOPRA TUTTO - TEMPORANEAMENTE ABILITATO
    if (import.meta.env.DEV) {
      this.renderPlayerRangeCircle(ctx, camera);
    }

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

        // Per NPC remoti, usa coordinate interpolate se disponibili
        let renderX = components.transform.x;
        let renderY = components.transform.y;

        // Controlla se è un NPC remoto con interpolazione
        const authority = this.ecs.getComponent(entity, Authority);
        const isRemoteNpc = authority && authority.authorityLevel === AuthorityLevel.SERVER_AUTHORITATIVE && components.npc;

        if (isRemoteNpc) {
          // Usa valori interpolati per NPC remoti
          const interpolationTarget = this.ecs.getComponent(entity, InterpolationTarget);
          if (interpolationTarget) {
            renderX = interpolationTarget.renderX;
            renderY = interpolationTarget.renderY;
          }
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
    
    // Render altre entità (portali, NPC, ecc.) - player verrà renderizzato dopo
    const otherEntities = entitiesWithoutPlayer.filter(entity => 
      !this.ecs.hasComponent(entity, SpaceStation)
    );
    for (const entity of otherEntities) {
      // OTTIMIZZAZIONE: Usa cache componenti invece di chiamate ripetute getComponent()
      const components = this.getCachedComponents(entity);


      // Skip parallax entities (rendered by ParallaxSystem)
      if (components.parallax) continue;

      if (components.transform) {
        const { width, height } = this.displayManager.getLogicalSize();

        // Per NPC remoti, usa coordinate interpolate se disponibili
        let renderX = components.transform.x;
        let renderY = components.transform.y;

        // Controlla se è un NPC remoto con interpolazione
        const authority = this.ecs.getComponent(entity, Authority);
        const isRemoteNpc = authority && authority.authorityLevel === AuthorityLevel.SERVER_AUTHORITATIVE && components.npc;

        if (isRemoteNpc) {
          // Usa valori interpolati per NPC remoti
          const interpolationTarget = this.ecs.getComponent(entity, InterpolationTarget);
          if (interpolationTarget) {
            renderX = interpolationTarget.renderX;
            renderY = interpolationTarget.renderY;
          }
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
        
        // Render engine flames BEFORE player ship (behind in z-order)
        const playerVelocity = this.ecs.getComponent(playerEntity, Velocity);
        if (playerVelocity && this.engflamesSprite && this.engflamesOpacity > 0) {
          const isMoving = Math.abs(playerVelocity.x) > 0.1 || Math.abs(playerVelocity.y) > 0.1;
          if (isMoving) {
            const params = EngineFlamesRenderer.getRenderParams(
              playerTransform,
              screenPos.x,
              screenPos.y,
              this.engflamesAnimationTime,
              this.engflamesOpacity,
              camera
            );
            if (params) {
              EngineFlamesRenderer.render(ctx, this.engflamesSprite, params);
            }
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
   * Render generic sprite (projectiles, effects, etc.)
   */
  private renderGenericSprite(ctx: CanvasRenderingContext2D, transform: Transform, sprite: Sprite | null, animatedSprite: AnimatedSprite | null, screenX: number, screenY: number, camera: Camera | null): void {
    const zoom = camera?.zoom || 1;

    if (animatedSprite) {
      const renderTransform: SpritesheetRenderTransform = {
        x: screenX, y: screenY, rotation: transform.rotation,
        scaleX: (transform.scaleX || 1) * zoom,
        scaleY: (transform.scaleY || 1) * zoom
      };
      SpritesheetRenderer.render(ctx, renderTransform, animatedSprite);
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

    // Carica l'immagine in modo lazy se non è già caricata
    if (!this.aimImage) {
      this.aimImage = this.assetManager.getOrLoadImage('/assets/aim/aim.png');
      console.log(`[DEBUG_AIM] Loading aim.png...`);
    }

    // Se l'immagine non è ancora caricata, non renderizzare nulla
    if (!this.aimImage || !this.aimImage.complete || this.aimImage.naturalWidth === 0) {
      if (!this.aimImage) {
        console.log(`[DEBUG_AIM] aimImage is null`);
      } else if (!this.aimImage.complete) {
        console.log(`[DEBUG_AIM] aimImage not complete yet`);
      } else if (this.aimImage.naturalWidth === 0) {
        console.log(`[DEBUG_AIM] aimImage has 0 width - load failed`);
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

    console.log(`[DEBUG_AIM] ✅ Aim RENDERED for NPC at (${screenX.toFixed(1)}, ${screenY.toFixed(1)})`);
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


  /**
   * Renderizza il testo "ACCESS DENIED" sopra al portale con effetto fluttuante
   */
  private renderComingSoonText(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, zoom: number): void {
    ctx.save();

    // Imposta lo stile del testo
    ctx.fillStyle = '#FF0000'; // Rosso acceso
    ctx.strokeStyle = '#000000'; // Nero per il contorno
    ctx.lineWidth = 3 * zoom; // Contorno più spesso per il rosso
    ctx.font = `bold ${20 * zoom}px Arial`; // Font leggermente più grande
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Effetto fluttuazione usando funzione seno (ridotta)
    const floatOffset = Math.sin(this.frameTime * 0.003) * 3 * zoom; // Fluttuazione verticale più leggera
    const textY = screenY + floatOffset; // Al centro del portale invece che sopra
    const text = 'ACCESS DENIED';

    // Disegna l'ombra/stroke per migliore leggibilità
    ctx.strokeText(text, screenX, textY);
    ctx.fillText(text, screenX, textY);

    ctx.restore();
  }

}
