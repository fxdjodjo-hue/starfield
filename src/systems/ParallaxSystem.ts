import { BaseSystem } from '../ecs/System';
import { ECS } from '../ecs/ECS';
import { Transform } from '../components/Transform';
import { ParallaxLayer } from '../components/ParallaxLayer';
import { MovementSystem } from './MovementSystem';

/**
 * Sistema Parallax - gestisce elementi con effetto parallax
 * Gli elementi si muovono a velocità diverse per creare profondità
 */
export class ParallaxSystem extends BaseSystem {
  private movementSystem: MovementSystem;
  private lastCameraX: number = 0;
  private lastCameraY: number = 0;
  private initialized: boolean = false;

  constructor(ecs: ECS, movementSystem: MovementSystem) {
    super(ecs);
    this.movementSystem = movementSystem;
  }

  update(deltaTime: number): void {
    const camera = this.movementSystem.getCamera();

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
    const camera = this.movementSystem.getCamera();

    // Ottiene tutti gli elementi parallax
    const parallaxEntities = this.ecs.getEntitiesWithComponents(Transform, ParallaxLayer);

    // Renderizza ogni elemento parallax (ottimizzato: solo quelli potenzialmente visibili)
    for (const entity of parallaxEntities) {
      const transform = this.ecs.getComponent(entity, Transform);
      const parallax = this.ecs.getComponent(entity, ParallaxLayer);

      if (transform && parallax) {
        // Controllo preliminare: salta stelle troppo lontane dalla camera
        const distanceFromCamera = Math.sqrt(
          Math.pow(transform.x - camera.x, 2) +
          Math.pow(transform.y - camera.y, 2)
        );

        // Salta stelle oltre 8000 pixel dalla camera (fuori dal campo visivo)
        // Aumentato per la mappa enorme 21000x13100
        if (distanceFromCamera > 8000) {
          continue;
        }

        this.renderParallaxElement(ctx, transform, parallax, camera);
      }
    }
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
  private renderParallaxElement(ctx: CanvasRenderingContext2D, transform: Transform, parallax: ParallaxLayer, camera: any): void {
    ctx.save();

    // Calcola la posizione effettiva considerando l'offset parallax
    const worldX = transform.x + parallax.offsetX;
    const worldY = transform.y + parallax.offsetY;

    // Converte in coordinate schermo
    const screenPos = camera.worldToScreen(worldX, worldY, ctx.canvas.width, ctx.canvas.height);
    const screenX = screenPos.x;
    const screenY = screenPos.y;

    // Salta se l'elemento è fuori dallo schermo (con margine aumentato per mappa grande)
    const margin = 200; // Aumentato a 200 per la mappa 21000x13100
    if (screenX < -margin || screenX > ctx.canvas.width + margin ||
        screenY < -margin || screenY > ctx.canvas.height + margin) {
      ctx.restore();
      return;
    }

    // Applica trasformazioni
    ctx.translate(screenX, screenY);
    ctx.rotate(transform.rotation);
    ctx.scale(transform.scaleX, transform.scaleY);

    // Renderizza come punto luminoso (placeholder per elementi parallax)
    this.renderParallaxPoint(ctx, parallax);

    ctx.restore();
  }

  /**
   * Renderizza un punto luminoso per l'elemento parallax
   */
  private renderParallaxPoint(ctx: CanvasRenderingContext2D, parallax: ParallaxLayer): void {
    // Stelle più piccole e luminose (stelle vere sono punti luminosi)
    const size = 1 + parallax.speedX * 2; // Da 1 a 3 pixel basato sulla velocità

    // Stelle lontane (velocità bassa) sono più tenui
    const alpha = Math.max(0.4, parallax.speedX * 2.5); // Da 0.4 a 0.65

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
