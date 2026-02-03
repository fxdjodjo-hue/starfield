import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { ParallaxLayer } from '../../entities/spatial/ParallaxLayer';
import { Sprite as EcsSprite } from '../../entities/Sprite';
import { CameraSystem } from './CameraSystem';
import { DisplayManager } from '../../infrastructure/display';
import { PixiRenderer } from '../../infrastructure/rendering/PixiRenderer';
import { Graphics, Container, Sprite, Texture } from 'pixi.js';

/**
 * Configurazione layer stelle procedurali
 * Ogni layer ha velocità parallax diversa (0 = fermo, 1 = segue camera)
 */
interface StarLayer {
  speed: number;      // Velocità parallax (0.1 = lontano, 0.5 = vicino)
  density: number;    // Stelle per cella
  minSize: number;    // Dimensione minima
  maxSize: number;    // Dimensione massima
  alpha: number;      // Trasparenza base
}

const STAR_LAYERS: StarLayer[] = [
  { speed: 0.05, density: 5, minSize: 0.5, maxSize: 1.2, alpha: 0.4 },  // Layer lontano
  { speed: 0.15, density: 4, minSize: 0.8, maxSize: 1.8, alpha: 0.6 },  // Layer medio
  { speed: 0.30, density: 2, minSize: 1.0, maxSize: 1.8, alpha: 0.8 },  // Layer vicino
];

const STAR_GRID_SIZE = 400; // Dimensione cella griglia in pixel

/**
 * Configurazione meteore/stelle cadenti
 */
interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  alpha: number;
  life: number;
  maxLife: number;
}

const METEOR_CONFIG = {
  maxActive: 5,
  spawnInterval: 3000,
  spawnVariance: 2000,
  minSpeed: 200,
  maxSpeed: 400,
  minLength: 60,
  maxLength: 150,
  minLife: 1.5,
  maxLife: 3.0,
};

/**
 * ParallaxSystem - PixiJS Version
 * Gestisce elementi con effetto parallax usando PixiJS Graphics
 */
export class ParallaxSystem extends BaseSystem {
  private cameraSystem: CameraSystem;
  private lastCameraX: number = 0;
  private lastCameraY: number = 0;
  private initialized: boolean = false;
  private pixiInitialized: boolean = false;

  // PixiJS containers
  private starsGraphics: Graphics;
  private backgroundContainer: Container;
  private parallaxSprites: Map<number, Sprite> = new Map(); // entityId -> Sprite

  // Sistema meteore
  private meteors: Meteor[] = [];
  private nextMeteorSpawn: number = 0;

  constructor(ecs: ECS, cameraSystem: CameraSystem) {
    super(ecs);
    this.cameraSystem = cameraSystem;
    this.starsGraphics = new Graphics();
    this.backgroundContainer = new Container();
    this.backgroundContainer.label = 'ParallaxBackground';
    this.scheduleNextMeteor();
  }

  /**
   * Inizializza PixiJS containers (chiamato lazy al primo update)
   */
  private initPixi(): void {
    if (this.pixiInitialized) return;

    try {
      const pixiRenderer = PixiRenderer.getInstance();
      const bgContainer = pixiRenderer.getBackgroundContainer();

      // Aggiungi container parallax al background
      bgContainer.addChild(this.backgroundContainer);
      bgContainer.addChild(this.starsGraphics);

      this.pixiInitialized = true;
      console.log('[ParallaxSystem] PixiJS initialized');
    } catch (e) {
      // PixiRenderer non ancora pronto, riprova al prossimo frame
    }
  }

  private scheduleNextMeteor(): void {
    const delay = METEOR_CONFIG.spawnInterval + (Math.random() - 0.5) * METEOR_CONFIG.spawnVariance;
    this.nextMeteorSpawn = Date.now() + delay;
  }

  private spawnMeteor(screenWidth: number, screenHeight: number): void {
    if (this.meteors.length >= METEOR_CONFIG.maxActive) return;

    const marginX = screenWidth * 0.2;
    const marginY = screenHeight * 0.2;
    const x = marginX + Math.random() * (screenWidth - marginX * 2);
    const y = marginY + Math.random() * (screenHeight - marginY * 2);

    const angle = Math.PI * 0.2 + Math.random() * Math.PI * 0.6;
    const speed = METEOR_CONFIG.minSpeed + Math.random() * (METEOR_CONFIG.maxSpeed - METEOR_CONFIG.minSpeed);
    const life = METEOR_CONFIG.minLife + Math.random() * (METEOR_CONFIG.maxLife - METEOR_CONFIG.minLife);

    this.meteors.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      length: METEOR_CONFIG.minLength + Math.random() * (METEOR_CONFIG.maxLength - METEOR_CONFIG.minLength),
      alpha: 0.3 + Math.random() * 0.3,
      life: 1,
      maxLife: life,
    });
  }

  private updateMeteors(deltaTime: number, screenWidth: number, screenHeight: number): void {
    const now = Date.now();

    if (now >= this.nextMeteorSpawn) {
      this.spawnMeteor(screenWidth, screenHeight);
      this.scheduleNextMeteor();
    }

    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const meteor = this.meteors[i];
      meteor.x += meteor.vx * deltaTime;
      meteor.y += meteor.vy * deltaTime;
      meteor.life -= deltaTime / meteor.maxLife;

      if (meteor.life <= 0 ||
        meteor.x < -200 || meteor.x > screenWidth + 200 ||
        meteor.y < -200 || meteor.y > screenHeight + 200) {
        this.meteors.splice(i, 1);
      }
    }
  }

  /**
   * Hash deterministico per generare valori pseudo-random consistenti
   */
  private hash(x: number, y: number, seed: number): number {
    const h = ((x * 374761393 + y * 668265263 + seed * 1013904223) ^ 1234567890) >>> 0;
    return (h % 10000) / 10000;
  }

  update(deltaTime: number): void {
    // Inizializza PixiJS se non ancora fatto
    this.initPixi();
    if (!this.pixiInitialized) return;

    const camera = this.cameraSystem.getCamera();
    const { width, height } = DisplayManager.getInstance().getLogicalSize();

    if (!this.initialized) {
      this.lastCameraX = camera.x;
      this.lastCameraY = camera.y;
      this.initialized = true;
      return;
    }

    const deltaX = camera.x - this.lastCameraX;
    const deltaY = camera.y - this.lastCameraY;

    this.updateParallaxElements(deltaX, deltaY);

    // Aggiorna e renderizza stelle procedurali con PixiJS
    this.renderProceduralStarsPixi(camera, width, height);

    // Aggiorna parallax sprites per entità ECS
    this.updateParallaxSprites(camera, width, height);

    this.lastCameraX = camera.x;
    this.lastCameraY = camera.y;
  }

  /**
   * Renderizza stelle procedurali usando PixiJS Graphics
   */
  private renderProceduralStarsPixi(camera: any, screenWidth: number, screenHeight: number): void {
    // Clear e ridisegna le stelle
    this.starsGraphics.clear();

    for (let layerIndex = 0; layerIndex < STAR_LAYERS.length; layerIndex++) {
      const layer = STAR_LAYERS[layerIndex];

      const parallaxX = camera.x * layer.speed;
      const parallaxY = camera.y * layer.speed;

      const margin = STAR_GRID_SIZE;
      const startCellX = Math.floor((parallaxX - screenWidth / 2 - margin) / STAR_GRID_SIZE);
      const endCellX = Math.floor((parallaxX + screenWidth / 2 + margin) / STAR_GRID_SIZE);
      const startCellY = Math.floor((parallaxY - screenHeight / 2 - margin) / STAR_GRID_SIZE);
      const endCellY = Math.floor((parallaxY + screenHeight / 2 + margin) / STAR_GRID_SIZE);

      for (let cellX = startCellX; cellX <= endCellX; cellX++) {
        for (let cellY = startCellY; cellY <= endCellY; cellY++) {
          this.renderStarsInCellPixi(cellX, cellY, layer, layerIndex, parallaxX, parallaxY, screenWidth, screenHeight);
        }
      }
    }
  }

  /**
   * Renderizza stelle in una singola cella usando PixiJS
   */
  private renderStarsInCellPixi(
    cellX: number, cellY: number,
    layer: StarLayer, layerIndex: number,
    parallaxX: number, parallaxY: number,
    screenWidth: number, screenHeight: number
  ): void {
    const seed = layerIndex * 1000000;

    for (let i = 0; i < layer.density; i++) {
      const starSeed = seed + i;
      const localX = this.hash(cellX, cellY, starSeed) * STAR_GRID_SIZE;
      const localY = this.hash(cellX, cellY, starSeed + 1) * STAR_GRID_SIZE;

      const worldX = cellX * STAR_GRID_SIZE + localX;
      const worldY = cellY * STAR_GRID_SIZE + localY;

      const screenX = worldX - parallaxX + screenWidth / 2;
      const screenY = worldY - parallaxY + screenHeight / 2;

      if (screenX < -10 || screenX > screenWidth + 10 ||
        screenY < -10 || screenY > screenHeight + 10) {
        continue;
      }

      const sizeFactor = this.hash(cellX, cellY, starSeed + 2);
      const size = layer.minSize + sizeFactor * (layer.maxSize - layer.minSize);
      const alphaMod = 0.7 + this.hash(cellX, cellY, starSeed + 3) * 0.3;

      // Effetto twinkling per stelle piccole
      let finalAlpha = layer.alpha * alphaMod;
      if (size < 1.2) {
        const time = Date.now() * 0.001;
        const twinkle = Math.sin(time * 2.0 + starSeed * 0.1) * 0.3;
        finalAlpha = Math.max(0.1, finalAlpha + twinkle);
      }

      // Disegna stella con PixiJS Graphics
      this.starsGraphics.circle(screenX, screenY, size);
      this.starsGraphics.fill({ color: 0xffffff, alpha: finalAlpha });

      // Glow per stelle grandi
      if (size > 1.5) {
        this.starsGraphics.circle(screenX, screenY, size * 2);
        this.starsGraphics.fill({ color: 0xffffff, alpha: finalAlpha * 0.3 });
      }
    }
  }

  /**
   * Aggiorna gli offset degli elementi parallax ECS
   */
  private updateParallaxElements(deltaX: number, deltaY: number): void {
    const parallaxEntities = this.ecs.getEntitiesWithComponents(Transform, ParallaxLayer);

    for (const entity of parallaxEntities) {
      const parallax = this.ecs.getComponent(entity, ParallaxLayer);
      if (!parallax) continue;

      parallax.offsetX += deltaX * (1 - parallax.speedX);
      parallax.offsetY += deltaY * (1 - parallax.speedY);
    }
  }

  /**
   * Aggiorna sprite parallax per entità ECS (background images, etc)
   */
  private updateParallaxSprites(camera: any, screenWidth: number, screenHeight: number): void {
    const parallaxEntities = this.ecs.getEntitiesWithComponents(Transform, ParallaxLayer);

    // Ordina per zIndex
    const sortedEntities = parallaxEntities.slice().sort((a, b) => {
      const parallaxA = this.ecs.getComponent(a, ParallaxLayer);
      const parallaxB = this.ecs.getComponent(b, ParallaxLayer);
      return (parallaxA?.zIndex || 0) - (parallaxB?.zIndex || 0);
    });

    // Track quali entità esistono ancora
    const existingIds = new Set<number>();

    for (const entity of sortedEntities) {
      const entityId = typeof entity === 'number' ? entity : (entity as any).id;
      existingIds.add(entityId);

      const transform = this.ecs.getComponent(entity, Transform);
      const parallax = this.ecs.getComponent(entity, ParallaxLayer);
      const ecsSprite = this.ecs.getComponent(entity, EcsSprite);

      if (!transform || !parallax) continue;

      // Salta se non ha sprite caricato
      if (!ecsSprite || !ecsSprite.isLoaded() || !ecsSprite.image) continue;

      // Crea o aggiorna sprite PixiJS
      let pixiSprite = this.parallaxSprites.get(entityId);

      if (!pixiSprite) {
        // Crea nuovo sprite da immagine
        const texture = Texture.from(ecsSprite.image);
        pixiSprite = new Sprite(texture);
        pixiSprite.anchor.set(0.5, 0.5);
        this.backgroundContainer.addChild(pixiSprite);
        this.parallaxSprites.set(entityId, pixiSprite);
      }

      // Calcola posizione
      let screenX: number;
      let screenY: number;

      if (parallax.zIndex === -1) {
        // Background: effetto parallax lento
        screenX = screenWidth / 2 - camera.x * parallax.speedX;
        screenY = screenHeight / 2 - camera.y * parallax.speedY;
      } else {
        const worldX = transform.x + parallax.offsetX;
        const worldY = transform.y + parallax.offsetY;
        const screenPos = camera.worldToScreen(worldX, worldY, screenWidth, screenHeight);
        screenX = screenPos.x;
        screenY = screenPos.y;
      }

      // Aggiorna posizione e scala
      pixiSprite.position.set(screenX, screenY);
      pixiSprite.rotation = transform.rotation;
      pixiSprite.scale.set(transform.scaleX, transform.scaleY);

      // Culling: nascondi se fuori schermo
      const spriteWidth = ecsSprite.width * transform.scaleX;
      const spriteHeight = ecsSprite.height * transform.scaleY;
      const margin = 200;

      const visible = !(
        screenX + spriteWidth / 2 < -margin ||
        screenX - spriteWidth / 2 > screenWidth + margin ||
        screenY + spriteHeight / 2 < -margin ||
        screenY - spriteHeight / 2 > screenHeight + margin
      );
      pixiSprite.visible = visible;
    }

    // Rimuovi sprite per entità non più esistenti
    for (const [entityId, sprite] of this.parallaxSprites) {
      if (!existingIds.has(entityId)) {
        sprite.destroy();
        this.parallaxSprites.delete(entityId);
      }
    }
  }

  /**
   * Cleanup risorse PixiJS
   */
  destroy(): void {
    if (this.starsGraphics) {
      this.starsGraphics.destroy();
    }
    for (const sprite of this.parallaxSprites.values()) {
      sprite.destroy();
    }
    this.parallaxSprites.clear();
    if (this.backgroundContainer) {
      this.backgroundContainer.destroy();
    }
  }
}
