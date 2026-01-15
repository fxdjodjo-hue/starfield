import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { ParallaxLayer } from '../../entities/spatial/ParallaxLayer';
import { Sprite } from '../../entities/Sprite';
import { CameraSystem } from './CameraSystem';
import { DisplayManager } from '../../infrastructure/display';

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
  { speed: 0.05, density: 3, minSize: 0.5, maxSize: 1.2, alpha: 0.4 },  // Layer lontano
  { speed: 0.15, density: 2, minSize: 0.8, maxSize: 1.8, alpha: 0.6 },  // Layer medio
  { speed: 0.30, density: 1, minSize: 1.2, maxSize: 2.5, alpha: 0.8 },  // Layer vicino
];

const STAR_GRID_SIZE = 400; // Dimensione cella griglia in pixel

/**
 * Sistema Parallax - gestisce elementi con effetto parallax
 * Gli elementi si muovono a velocità diverse per creare profondità
 */
export class ParallaxSystem extends BaseSystem {
  private cameraSystem: CameraSystem;
  private lastCameraX: number = 0;
  private lastCameraY: number = 0;
  private initialized: boolean = false;

  constructor(ecs: ECS, cameraSystem: CameraSystem) {
    super(ecs);
    this.cameraSystem = cameraSystem;
  }

  /**
   * Hash deterministico per generare valori pseudo-random consistenti
   */
  private hash(x: number, y: number, seed: number): number {
    const h = ((x * 374761393 + y * 668265263 + seed * 1013904223) ^ 1234567890) >>> 0;
    return (h % 10000) / 10000; // Ritorna valore 0-1
  }

  update(deltaTime: number): void {
    const camera = this.cameraSystem.getCamera();

    // Inizializza la posizione precedente della camera
    if (!this.initialized) {
      this.lastCameraX = camera.x;
      this.lastCameraY = camera.y;
      this.initialized = true;
      return;
    }

    // Calcola il movimento della camera
    const deltaX = camera.x - this.lastCameraX;
    const deltaY = camera.y - this.lastCameraY;

    // Aggiorna gli elementi parallax (stelle fisse)
    this.updateParallaxElements(deltaX, deltaY);

    // Le stelle sono fisse nel cielo - non vengono riciclate

    // Salva la posizione corrente per il prossimo frame
    this.lastCameraX = camera.x;
    this.lastCameraY = camera.y;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const camera = this.cameraSystem.getCamera();
    const { width, height } = DisplayManager.getInstance().getLogicalSize();

    // Renderizza stelle procedurali (zero memoria, infinite stelle)
    this.renderProceduralStars(ctx, camera, width, height);

    // Renderizza entità parallax esistenti (es. background sprite se riattivato)
    const parallaxEntities = this.ecs.getEntitiesWithComponents(Transform, ParallaxLayer);
    for (const entity of parallaxEntities) {
      const transform = this.ecs.getComponent(entity, Transform);
      const parallax = this.ecs.getComponent(entity, ParallaxLayer);
      const sprite = this.ecs.getComponent(entity, Sprite);

      if (transform && parallax && sprite) {
        this.renderParallaxElement(ctx, transform, parallax, camera, sprite);
      }
    }
  }

  /**
   * Renderizza stelle procedurali - zero memoria, generate al volo
   */
  private renderProceduralStars(
    ctx: CanvasRenderingContext2D, 
    camera: any, 
    screenWidth: number, 
    screenHeight: number
  ): void {
    ctx.save();

    for (let layerIndex = 0; layerIndex < STAR_LAYERS.length; layerIndex++) {
      const layer = STAR_LAYERS[layerIndex];
      
      // Calcola posizione camera con parallax
      const parallaxX = camera.x * layer.speed;
      const parallaxY = camera.y * layer.speed;

      // Calcola celle visibili (con margine)
      const margin = STAR_GRID_SIZE;
      const startCellX = Math.floor((parallaxX - screenWidth / 2 - margin) / STAR_GRID_SIZE);
      const endCellX = Math.floor((parallaxX + screenWidth / 2 + margin) / STAR_GRID_SIZE);
      const startCellY = Math.floor((parallaxY - screenHeight / 2 - margin) / STAR_GRID_SIZE);
      const endCellY = Math.floor((parallaxY + screenHeight / 2 + margin) / STAR_GRID_SIZE);

      // Renderizza stelle in ogni cella visibile
      for (let cellX = startCellX; cellX <= endCellX; cellX++) {
        for (let cellY = startCellY; cellY <= endCellY; cellY++) {
          this.renderStarsInCell(ctx, cellX, cellY, layer, layerIndex, parallaxX, parallaxY, screenWidth, screenHeight);
        }
      }
    }

    ctx.restore();
  }

  /**
   * Renderizza stelle in una singola cella della griglia
   */
  private renderStarsInCell(
    ctx: CanvasRenderingContext2D,
    cellX: number,
    cellY: number,
    layer: StarLayer,
    layerIndex: number,
    parallaxX: number,
    parallaxY: number,
    screenWidth: number,
    screenHeight: number
  ): void {
    const seed = layerIndex * 1000000;

    for (let i = 0; i < layer.density; i++) {
      // Genera posizione stella deterministicamente
      const starSeed = seed + i;
      const localX = this.hash(cellX, cellY, starSeed) * STAR_GRID_SIZE;
      const localY = this.hash(cellX, cellY, starSeed + 1) * STAR_GRID_SIZE;
      
      // Posizione mondo della stella
      const worldX = cellX * STAR_GRID_SIZE + localX;
      const worldY = cellY * STAR_GRID_SIZE + localY;

      // Converti in coordinate schermo
      const screenX = worldX - parallaxX + screenWidth / 2;
      const screenY = worldY - parallaxY + screenHeight / 2;

      // Salta se fuori schermo
      if (screenX < -10 || screenX > screenWidth + 10 || 
          screenY < -10 || screenY > screenHeight + 10) {
        continue;
      }

      // Genera proprietà stella
      const sizeFactor = this.hash(cellX, cellY, starSeed + 2);
      const size = layer.minSize + sizeFactor * (layer.maxSize - layer.minSize);
      const alphaMod = 0.7 + this.hash(cellX, cellY, starSeed + 3) * 0.3;
      const alpha = layer.alpha * alphaMod;

      // Renderizza stella
      this.renderStar(ctx, screenX, screenY, size, alpha);
    }
  }

  /**
   * Renderizza una singola stella
   */
  private renderStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number): void {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Glow sottile per stelle più grandi
    if (size > 1.5) {
      ctx.globalAlpha = alpha * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, size * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  /**
   * Aggiorna gli offset degli elementi parallax
   */
  private updateParallaxElements(deltaX: number, deltaY: number): void {
    const parallaxEntities = this.ecs.getEntitiesWithComponents(Transform, ParallaxLayer);

    for (const entity of parallaxEntities) {
      const parallax = this.ecs.getComponent(entity, ParallaxLayer);
      if (!parallax) continue;

      // Aggiorna l'offset basato sul movimento della camera e velocità parallax
      parallax.offsetX += deltaX * (1 - parallax.speedX);
      parallax.offsetY += deltaY * (1 - parallax.speedY);
    }
  }

  /**
   * Renderizza un singolo elemento parallax
   */
  private renderParallaxElement(ctx: CanvasRenderingContext2D, transform: Transform, parallax: ParallaxLayer, camera: any, sprite?: Sprite): void {
    ctx.save();

    // Calcola la posizione effettiva considerando l'offset parallax
    const worldX = transform.x + parallax.offsetX;
    const worldY = transform.y + parallax.offsetY;

    // Converte in coordinate schermo usando dimensioni logiche
    const { width, height } = DisplayManager.getInstance().getLogicalSize();
    const screenPos = camera.worldToScreen(worldX, worldY, width, height);
    const screenX = screenPos.x;
    const screenY = screenPos.y;

    // Salta se l'elemento è fuori dallo schermo (con margine aumentato per mappa grande)
    const margin = 200; // Aumentato a 200 per la mappa 21000x13100
    if (screenX < -margin || screenX > width + margin ||
        screenY < -margin || screenY > height + margin) {
      ctx.restore();
      return;
    }

    // Applica trasformazioni
    ctx.translate(screenX, screenY);
    ctx.rotate(transform.rotation);
    ctx.scale(transform.scaleX, transform.scaleY);

    // Renderizza sprite se disponibile, altrimenti punto luminoso
    if (sprite && sprite.isLoaded()) {
      // Renderizza l'immagine sprite
      const spriteX = -sprite.width / 2 + sprite.offsetX;
      const spriteY = -sprite.height / 2 + sprite.offsetY;
      ctx.drawImage(sprite.image, spriteX, spriteY, sprite.width, sprite.height);
    } else {
      // Renderizza come punto luminoso (stelle)
      this.renderParallaxPoint(ctx, parallax);
    }

    ctx.restore();
  }

  /**
   * Renderizza un punto luminoso per l'elemento parallax
   */
  private renderParallaxPoint(ctx: CanvasRenderingContext2D, parallax: ParallaxLayer): void {
    // Stelle più grandi e luminose (stelle vere sono punti luminosi)
    const size = 2 + parallax.speedX * 3; // Da 2 a 5 pixel basato sulla velocità

    // Stelle lontane (velocità bassa) sono più tenui
    const alpha = Math.max(0.6, parallax.speedX * 3); // Da 0.6 a 0.9

    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;

    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();

    // Aggiungi effetto stella per tutte le stelle (più realistico)
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
    ctx.lineWidth = 0.5;

    const crossSize = size * 2;
    ctx.beginPath();
    ctx.moveTo(-crossSize, 0);
    ctx.lineTo(crossSize, 0);
    ctx.moveTo(0, -crossSize);
    ctx.lineTo(0, crossSize);
    ctx.stroke();
  }
}
