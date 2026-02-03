import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Health } from '../../entities/combat/Health';
import { CONFIG } from '../../core/utils/config/GameConfig';
import { CameraSystem } from '../rendering/CameraSystem';
import { DisplayManager } from '../../infrastructure/display';
import { PixiRenderer } from '../../infrastructure/rendering/PixiRenderer';
import { Sprite, Texture, Container, AnimatedSprite } from 'pixi.js';

/**
 * BoundsSystem - PixiJS Version
 * Gestisce i limiti della mappa e applica danno ai giocatori fuori bounds
 */
export class BoundsSystem extends BaseSystem {
  private readonly BOUNDS_LEFT = -CONFIG.WORLD_WIDTH / 2;
  private readonly BOUNDS_RIGHT = CONFIG.WORLD_WIDTH / 2;
  private readonly BOUNDS_TOP = -CONFIG.WORLD_HEIGHT / 2;
  private readonly BOUNDS_BOTTOM = CONFIG.WORLD_HEIGHT / 2;

  private damageTimer = 0;
  private readonly DAMAGE_INTERVAL = 1000;
  private readonly DAMAGE_AMOUNT = 1000;

  private lastWarningTime = 0;
  private readonly WARNING_INTERVAL = 3000;

  // Animazione radiazione
  private radiationFrames: HTMLImageElement[] = [];
  private radiationAnimationFrame = 0;
  private animationTimer = 0;
  private readonly FRAME_DURATION = 1000 / 15;
  private isLoadingRadiation = false;

  // PixiJS elements
  private pixiInitialized: boolean = false;
  private radiationSprite: Sprite | null = null;
  private radiationContainer: Container;
  private radiationTextures: Texture[] = [];

  private audioSystem: any = null;
  private playerEntity: any = null;
  private cameraSystem: CameraSystem;

  constructor(ecs: ECS, cameraSystem: CameraSystem) {
    super(ecs);
    this.cameraSystem = cameraSystem;
    this.radiationContainer = new Container();
    this.radiationContainer.label = 'RadiationOverlay';
    this.loadRadiationAssets();
  }

  /**
   * Inizializza PixiJS (lazy)
   */
  private initPixi(): void {
    if (this.pixiInitialized) return;

    try {
      const pixiRenderer = PixiRenderer.getInstance();
      const uiContainer = pixiRenderer.getUIContainer();
      uiContainer.addChild(this.radiationContainer);
      this.radiationContainer.zIndex = 100; // Sopra altri elementi UI
      this.pixiInitialized = true;

      // Crea sprite radiazione se abbiamo textures
      if (this.radiationTextures.length > 0 && !this.radiationSprite) {
        this.radiationSprite = new Sprite(this.radiationTextures[0]);
        this.radiationSprite.anchor.set(0.5, 0.5);
        this.radiationSprite.blendMode = 'screen';
        this.radiationSprite.alpha = 0.8;
        this.radiationSprite.visible = false;
        this.radiationContainer.addChild(this.radiationSprite);
      }
    } catch (e) {
      // PixiRenderer non ancora pronto
    }
  }

  private async loadRadiationAssets(): Promise<void> {
    if (this.isLoadingRadiation) return;
    this.isLoadingRadiation = true;

    try {
      const { AtlasParser } = await import('../../core/utils/AtlasParser');
      const atlasData = await AtlasParser.parseAtlas('assets/radiation/radiation.atlas');
      this.radiationFrames = await AtlasParser.extractFrames(atlasData);

      // Converti in textures PixiJS
      this.radiationTextures = this.radiationFrames.map(frame => Texture.from(frame));

      // Crea sprite se PixiJS già inizializzato
      if (this.pixiInitialized && this.radiationTextures.length > 0 && !this.radiationSprite) {
        this.radiationSprite = new Sprite(this.radiationTextures[0]);
        this.radiationSprite.anchor.set(0.5, 0.5);
        this.radiationSprite.blendMode = 'screen';
        this.radiationSprite.alpha = 0.8;
        this.radiationSprite.visible = false;
        this.radiationContainer.addChild(this.radiationSprite);
      }
    } catch (error) {
      console.error('[BoundsSystem] Errore caricamento radiation assets:', error);
    } finally {
      this.isLoadingRadiation = false;
    }
  }

  setPlayerEntity(playerEntity: any): void {
    this.playerEntity = playerEntity;
  }

  setAudioSystem(audioSystem: any): void {
    this.audioSystem = audioSystem;
  }

  update(deltaTime: number): void {
    this.initPixi();

    if (!this.playerEntity) {
      if (this.radiationSprite) this.radiationSprite.visible = false;
      return;
    }

    const transform = this.ecs.getComponent(this.playerEntity, Transform);
    const health = this.ecs.getComponent(this.playerEntity, Health);

    if (!transform || !health) {
      if (this.radiationSprite) this.radiationSprite.visible = false;
      return;
    }

    const isOutOfBounds = this.isOutOfBounds(transform.x, transform.y);

    if (isOutOfBounds) {
      this.damageTimer += deltaTime;

      // Aggiorna animazione radiazione
      this.animationTimer += deltaTime;
      if (this.animationTimer >= this.FRAME_DURATION) {
        this.radiationAnimationFrame = (this.radiationAnimationFrame + 1) % Math.max(1, this.radiationTextures.length);
        this.animationTimer = 0;

        // Aggiorna texture dello sprite
        if (this.radiationSprite && this.radiationTextures.length > 0) {
          this.radiationSprite.texture = this.radiationTextures[this.radiationAnimationFrame];
        }
      }

      // Warning vocale
      const now = Date.now();
      if (now - this.lastWarningTime >= this.WARNING_INTERVAL) {
        if (this.audioSystem) {
          this.audioSystem.playSound('warning', 0.7, false, false, 'voice');
        }
        this.lastWarningTime = now;
      }

      // Danno periodico
      if (this.damageTimer >= this.DAMAGE_INTERVAL) {
        health.takeDamage(this.DAMAGE_AMOUNT);
        this.damageTimer = 0;
        this.notifyCombatSystemOfDamage(this.playerEntity, this.DAMAGE_AMOUNT);
      }

      // Aggiorna posizione overlay radiazione
      this.updateRadiationOverlay(transform);
    } else {
      this.damageTimer = 0;
      this.lastWarningTime = 0;
      this.radiationAnimationFrame = 0;

      if (this.radiationSprite) {
        this.radiationSprite.visible = false;
      }
    }
  }

  private updateRadiationOverlay(transform: Transform): void {
    if (!this.radiationSprite || !this.pixiInitialized) return;

    const camera = this.cameraSystem.getCamera();
    if (!camera) return;

    const { width, height } = DisplayManager.getInstance().getLogicalSize();
    const screenPos = camera.worldToScreen(transform.x, transform.y, width, height);

    const size = 250;
    this.radiationSprite.position.set(screenPos.x, screenPos.y);
    this.radiationSprite.width = size;
    this.radiationSprite.height = size;
    this.radiationSprite.visible = true;
  }

  private isOutOfBounds(x: number, y: number): boolean {
    return x < this.BOUNDS_LEFT ||
      x > this.BOUNDS_RIGHT ||
      y < this.BOUNDS_TOP ||
      y > this.BOUNDS_BOTTOM;
  }

  private notifyCombatSystemOfDamage(targetEntity: any, damage: number): void {
    const systems = (this.ecs as any).systems || [];
    const combatSystem = systems.find((system: any) =>
      typeof system.createDamageText === 'function'
    );

    if (combatSystem) {
      combatSystem.createDamageText(targetEntity, damage, false, true);
    }
  }

  destroy(): void {
    if (this.radiationSprite) {
      this.radiationSprite.destroy();
    }
    if (this.radiationContainer) {
      this.radiationContainer.destroy({ children: true });
    }
  }
}
