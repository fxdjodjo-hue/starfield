import { System as BaseSystem } from '/src/infrastructure/ecs/System';
import { ECS } from '/src/infrastructure/ecs/ECS';
import { DamageText } from '/src/entities/combat/DamageText';
import { Transform } from '/src/entities/spatial/Transform';

/**
 * Sistema per gestire e renderizzare testi di danno fissi sopra le entità
 * Mostra numeri di danno che seguono le entità colpite durante il movimento
 */
export class DamageTextSystem extends BaseSystem {

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Aggiorna i testi di danno (solo lifetime)
   */
  update(deltaTime: number): void {
    // Trova tutte le entità con DamageText
    const damageTextEntities = this.ecs.getEntitiesWithComponents(DamageText);

    for (const entity of damageTextEntities) {
      const damageText = this.ecs.getComponent(entity, DamageText);
      if (!damageText) continue;

      // Solo aggiorna lifetime - posizione calcolata dinamicamente nel render
      damageText.lifetime -= deltaTime;

      // Rimuovi testi scaduti
      if (damageText.isExpired()) {
        this.ecs.removeEntity(entity);
      }
    }
  }

  /**
   * Renderizza i testi di danno
   */
  render(ctx: CanvasRenderingContext2D): void {
    console.log(`[DamageTextSystem] render() called`);
    const damageTextEntities = this.ecs.getEntitiesWithComponents(DamageText);
    console.log(`[DamageTextSystem] Found ${damageTextEntities.length} damage text entities to render`);

    for (const entity of damageTextEntities) {
      const damageText = this.ecs.getComponent(entity, DamageText);
      if (!damageText) continue;

      // Trova la posizione dell'entità target
      const targetEntity = this.ecs.getEntity(damageText.targetEntityId);
      if (!targetEntity) {
        console.log(`[DamageTextSystem] Removing damage text for dead entity ${damageText.targetEntityId}`);
        // Rimuovi il testo di danno se l'entità target non esiste più
        this.ecs.removeEntity(entity);
        continue;
      }

      const targetTransform = this.ecs.getComponent(targetEntity, Transform);
      if (!targetTransform) {
        console.log(`[DamageTextSystem] No Transform for entity ${damageText.targetEntityId}`);
        continue;
      }

      // Calcola posizione sopra l'entità con offset
      const worldX = targetTransform.x + damageText.offsetX;
      const worldY = targetTransform.y + damageText.offsetY;

      // Converti coordinate mondo in coordinate schermo usando la camera
      const camera = (this.ecs as any).systems?.find((s: any) => s.getCamera)?.getCamera();
      if (!camera) {
        console.log(`[DamageTextSystem] No camera found for rendering`);
        continue;
      }

      const canvasSize = ctx.canvas ? { width: ctx.canvas.width, height: ctx.canvas.height } : { width: 800, height: 600 };
      const screenPos = camera.worldToScreen(worldX, worldY, canvasSize.width, canvasSize.height);

      console.log(`[DamageTextSystem] Rendering damage ${damageText.value} for entity ${damageText.targetEntityId} at world(${worldX.toFixed(1)}, ${worldY.toFixed(1)}) -> screen(${screenPos.x.toFixed(1)}, ${screenPos.y.toFixed(1)})`);

      const alpha = damageText.getAlpha();

      // Salva il contesto
      ctx.save();

      // Imposta stile del testo
      ctx.globalAlpha = alpha;
      ctx.fillStyle = damageText.color;
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Aggiungi ombra per leggibilità
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Disegna il testo alla posizione calcolata
      ctx.fillText(damageText.value.toString(), screenPos.x, screenPos.y);
      console.log(`[DamageTextSystem] Drew text "${damageText.value}" at screen position (${screenPos.x.toFixed(1)}, ${screenPos.y.toFixed(1)})`);

      // Ripristina il contesto
      ctx.restore();
    }
  }

}
