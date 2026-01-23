import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { ParallaxLayer } from '../../entities/spatial/ParallaxLayer';
import { Sprite } from '../../entities/Sprite';
import { CameraSystem } from './CameraSystem';
import { DisplayManager } from '../../infrastructure/display';
import { CONFIG } from '../../core/utils/config/GameConfig';

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
  { speed: 0.05, density: 5, minSize: 0.5, maxSize: 1.2, alpha: 0.4 },  // Layer lontano - Stelle moderate
  { speed: 0.15, density: 4, minSize: 0.8, maxSize: 1.8, alpha: 0.6 },  // Layer medio - Stelle bilanciate
  { speed: 0.30, density: 2, minSize: 1.0, maxSize: 1.8, alpha: 0.8 },  // Layer vicino - Stelle essenziali
];

const STAR_GRID_SIZE = 400; // Dimensione cella griglia in pixel

/**
 * Configurazione meteore/stelle cadenti
 */
interface Meteor {
  x: number;           // Posizione X corrente (screen space)
  y: number;           // Posizione Y corrente (screen space)
  vx: number;          // Velocità X
  vy: number;          // Velocità Y
  length: number;      // Lunghezza scia
  alpha: number;       // Trasparenza
  life: number;        // Vita rimanente (0-1)
  maxLife: number;     // Vita massima in secondi
}

const METEOR_CONFIG = {
  maxActive: 5,           // Max meteore attive contemporaneamente
  spawnInterval: 3000,    // Intervallo spawn in ms (media)
  spawnVariance: 2000,    // Varianza random spawn
  minSpeed: 200,          // Velocità minima px/s (più lente, più visibili)
  maxSpeed: 400,          // Velocità massima px/s
  minLength: 60,          // Lunghezza minima scia
  maxLength: 150,         // Lunghezza massima scia
  minLife: 1.5,           // Durata minima secondi (più lunghe)
  maxLife: 3.0,           // Durata massima secondi
};

/**
 * Sistema Parallax - gestisce elementi con effetto parallax
 * Gli elementi si muovono a velocità diverse per creare profondità
 */
export class ParallaxSystem extends BaseSystem {
  private cameraSystem: CameraSystem;
  private lastCameraX: number = 0;
  private lastCameraY: number = 0;
  private initialized: boolean = false;

  // Sistema meteore
  private meteors: Meteor[] = [];
  private nextMeteorSpawn: number = 0;
  private lastTime: number = 0;

  constructor(ecs: ECS, cameraSystem: CameraSystem) {
    super(ecs);
    this.cameraSystem = cameraSystem;
    this.scheduleNextMeteor();
  }

  /**
   * Pianifica il prossimo spawn di meteora
   */
  private scheduleNextMeteor(): void {
    const delay = METEOR_CONFIG.spawnInterval + (Math.random() - 0.5) * METEOR_CONFIG.spawnVariance;
    this.nextMeteorSpawn = Date.now() + delay;
  }

  /**
   * Crea una nuova meteora nell'area visibile dello schermo
   */
  private spawnMeteor(screenWidth: number, screenHeight: number): void {
    if (this.meteors.length >= METEOR_CONFIG.maxActive) return;

    // Spawn nell'area centrale dello schermo (20%-80% della larghezza/altezza)
    const marginX = screenWidth * 0.2;
    const marginY = screenHeight * 0.2;
    const x = marginX + Math.random() * (screenWidth - marginX * 2);
    const y = marginY + Math.random() * (screenHeight - marginY * 2);

    // Angolo casuale, preferibilmente diagonale verso il basso
    const angle = Math.PI * 0.2 + Math.random() * Math.PI * 0.6; // 36° - 144° (diagonale)

    const speed = METEOR_CONFIG.minSpeed + Math.random() * (METEOR_CONFIG.maxSpeed - METEOR_CONFIG.minSpeed);
    const life = METEOR_CONFIG.minLife + Math.random() * (METEOR_CONFIG.maxLife - METEOR_CONFIG.minLife);

    this.meteors.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      length: METEOR_CONFIG.minLength + Math.random() * (METEOR_CONFIG.maxLength - METEOR_CONFIG.minLength),
      alpha: 0.3 + Math.random() * 0.3, // Più trasparenti (sono lontane)
      life: 1,
      maxLife: life,
    });
  }

  /**
   * Aggiorna lo stato delle meteore
   */
  private updateMeteors(deltaTime: number, screenWidth: number, screenHeight: number): void {
    const now = Date.now();

    // Spawn nuova meteora se è il momento
    if (now >= this.nextMeteorSpawn) {
      this.spawnMeteor(screenWidth, screenHeight);
      this.scheduleNextMeteor();
    }

    // Aggiorna meteore esistenti
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const meteor = this.meteors[i];

      // Muovi
      meteor.x += meteor.vx * deltaTime;
      meteor.y += meteor.vy * deltaTime;

      // Riduci vita
      meteor.life -= deltaTime / meteor.maxLife;

      // Rimuovi se morta o fuori schermo
      if (meteor.life <= 0 ||
        meteor.x < -200 || meteor.x > screenWidth + 200 ||
        meteor.y < -200 || meteor.y > screenHeight + 200) {
        this.meteors.splice(i, 1);
      }
    }
  }

  /**
   * Renderizza le meteore
   */
  private renderMeteors(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    for (const meteor of this.meteors) {
      // Calcola fade in/out basato sulla vita
      const fadeAlpha = meteor.life < 0.2 ? meteor.life / 0.2 :
        meteor.life > 0.8 ? (1 - meteor.life) / 0.2 : 1;
      const alpha = meteor.alpha * fadeAlpha;

      // Calcola direzione normalizzata
      const speed = Math.sqrt(meteor.vx * meteor.vx + meteor.vy * meteor.vy);
      const dirX = meteor.vx / speed;
      const dirY = meteor.vy / speed;

      // Punto finale della scia (dietro la meteora)
      const tailX = meteor.x - dirX * meteor.length;
      const tailY = meteor.y - dirY * meteor.length;

      // Crea gradiente per la scia
      const gradient = ctx.createLinearGradient(tailX, tailY, meteor.x, meteor.y);
      gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
      gradient.addColorStop(0.7, `rgba(255, 255, 255, ${alpha * 0.5})`);
      gradient.addColorStop(1, `rgba(255, 255, 255, ${alpha})`);

      // Disegna scia
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(meteor.x, meteor.y);
      ctx.stroke();

      // Punto luminoso alla testa
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(meteor.x, meteor.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
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
    const { width, height } = DisplayManager.getInstance().getLogicalSize();

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

    // DISABLED: Meteore - da riattivare quando funzionano
    // this.updateMeteors(deltaTime, width, height);

    // Salva la posizione corrente per il prossimo frame
    this.lastCameraX = camera.x;
    this.lastCameraY = camera.y;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const camera = this.cameraSystem.getCamera();
    const { width, height } = DisplayManager.getInstance().getLogicalSize();

    // DISABLED: Meteore - da riattivare quando funzionano
    // this.renderMeteors(ctx);

    // Renderizza entità parallax esistenti (background, ecc.) PRIMA delle stelle
    // Ordina per zIndex per controllare l'ordine di rendering
    const parallaxEntities = this.ecs.getEntitiesWithComponents(Transform, ParallaxLayer);

    const sortedEntities = parallaxEntities.slice().sort((a, b) => {
      const parallaxA = this.ecs.getComponent(a, ParallaxLayer);
      const parallaxB = this.ecs.getComponent(b, ParallaxLayer);
      return (parallaxA?.zIndex || 0) - (parallaxB?.zIndex || 0);
    });

    for (const entity of sortedEntities) {
      const transform = this.ecs.getComponent(entity, Transform);
      const parallax = this.ecs.getComponent(entity, ParallaxLayer);
      const sprite = this.ecs.getComponent(entity, Sprite);

      if (transform && parallax && sprite) {
        this.renderParallaxElement(ctx, transform, parallax, camera, sprite);
      }
    }

    // Renderizza stelle procedurali DOPO il background (zero memoria, infinite stelle)
    this.renderProceduralStars(ctx, camera, width, height);
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

      // Stelle ferme come nella realtà spaziale (no movimento)
      const finalScreenX = screenX;
      const finalScreenY = screenY;

      // Salta se fuori schermo
      if (finalScreenX < -10 || finalScreenX > screenWidth + 10 ||
        finalScreenY < -10 || finalScreenY > screenHeight + 10) {
        continue;
      }

      // Genera proprietà stella
      const sizeFactor = this.hash(cellX, cellY, starSeed + 2);
      const size = layer.minSize + sizeFactor * (layer.maxSize - layer.minSize);
      const alphaMod = 0.7 + this.hash(cellX, cellY, starSeed + 3) * 0.3;
      const alpha = layer.alpha * alphaMod;

      // Renderizza stella con movimento applicato e twinkling
      this.renderStar(ctx, finalScreenX, finalScreenY, size, alpha, starSeed);

    }
  }

  /**
   * Renderizza una singola stella
   */
  private renderStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, baseAlpha: number, starSeed?: number): void {
    // Aggiungi effetto twinkling per stelle piccole
    let finalAlpha = baseAlpha;
    if (size < 1.2 && starSeed !== undefined) {
      // Stelle piccole: effetto twinkling basato sul tempo e seed
      const time = Date.now() * 0.001;
      const twinkleSpeed = 2.0; // Velocità del twinkling
      const twinkleIntensity = 0.3; // Intensità massima del twinkling

      // Crea variazione sinusoidale unica per ogni stella
      const twinkle = Math.sin(time * twinkleSpeed + starSeed * 0.1) * twinkleIntensity;
      finalAlpha = Math.max(0.1, baseAlpha + twinkle); // Non andare sotto 0.1 per mantenerla visibile
    }

    ctx.globalAlpha = finalAlpha;
    ctx.fillStyle = '#ffffff';

    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Glow sottile per stelle più grandi (senza twinkling)
    if (size > 1.5) {
      ctx.globalAlpha = baseAlpha * 0.3;
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

    const { width, height } = DisplayManager.getInstance().getLogicalSize();

    let screenX: number;
    let screenY: number;

    // Per il background (zIndex = -1), usa un calcolo parallax che mantiene
    // il background sempre visibile e lo muove con effetto parallax
    if (parallax.zIndex === -1) {
      // Il background si muove più lentamente della camera (effetto parallax)
      // speedX/Y = 0.1 significa che il background si muove al 10% della velocità camera
      screenX = width / 2 - camera.x * parallax.speedX;
      screenY = height / 2 - camera.y * parallax.speedY;
    } else {
      // Calcola la posizione effettiva considerando l'offset parallax
      const worldX = transform.x + parallax.offsetX;
      const worldY = transform.y + parallax.offsetY;

      // Converte in coordinate schermo usando dimensioni logiche
      const screenPos = camera.worldToScreen(worldX, worldY, width, height);
      screenX = screenPos.x;
      screenY = screenPos.y;
    }

    // Culling intelligente: per elementi con sprite (es. background), controlla se il rettangolo è visibile
    // Per elementi piccoli (stelle), usa il culling semplice sul centro
    const zoom = camera.zoom || 1;
    if (sprite && sprite.isLoaded() && sprite.image) {
      // Calcola le dimensioni scalate dello sprite sullo schermo (inclusa la camera zoom)
      const spriteWidth = sprite.width * transform.scaleX * zoom;
      const spriteHeight = sprite.height * transform.scaleY * zoom;

      // Calcola i bordi del rettangolo dello sprite (centrato su screenX, screenY)
      const spriteLeft = screenX - spriteWidth / 2;
      const spriteRight = screenX + spriteWidth / 2;
      const spriteTop = screenY - spriteHeight / 2;
      const spriteBottom = screenY + spriteHeight / 2;

      // Controlla se il rettangolo interseca lo schermo (con margine)
      const margin = 200;
      if (spriteRight < -margin || spriteLeft > width + margin ||
        spriteBottom < -margin || spriteTop > height + margin) {
        ctx.restore();
        return;
      }
    } else {
      // Culling semplice per elementi piccoli (stelle)
      const margin = 200;
      if (screenX < -margin || screenX > width + margin ||
        screenY < -margin || screenY > height + margin) {
        ctx.restore();
        return;
      }
    }

    // Applica trasformazioni
    ctx.translate(screenX, screenY);
    ctx.rotate(transform.rotation);
    ctx.scale(transform.scaleX, transform.scaleY);

    // Renderizza sprite se disponibile, altrimenti punto luminoso
    if (sprite && sprite.isLoaded() && sprite.image) {
      // Abilita image smoothing per qualità migliore
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

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
