import { System as BaseSystem } from '/src/infrastructure/ecs/System';
import { ECS } from '/src/infrastructure/ecs/ECS';
import { DamageText } from '/src/entities/combat/DamageText';
import { Transform } from '/src/entities/spatial/Transform';

/**
 * Sistema per gestire e renderizzare testi di danno fissi sopra le entità
 * Mostra numeri di danno che seguono le entità colpite durante il movimento
 * Limita il numero di testi attivi per entità per evitare sovrapposizioni
 */
export class DamageTextSystem extends BaseSystem {
  private maxTextsPerEntity: number = 3; // Massimo 3 testi di danno per entità

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Aggiorna i testi di danno (lifetime e movimento)
   */
  update(deltaTime: number): void {
    const deltaTimeSeconds = deltaTime / 1000; // Converti in secondi

    // Trova tutte le entità con DamageText
    const damageTextEntities = this.ecs.getEntitiesWithComponents(DamageText);

    for (const entity of damageTextEntities) {
      const damageText = this.ecs.getComponent(entity, DamageText);
      if (!damageText) continue;

      // Muovi il testo verso l'alto nel tempo
      const moveSpeed = -60; // Pixel al secondo verso l'alto
      damageText.currentOffsetY += moveSpeed * deltaTimeSeconds;

      // Aggiorna lifetime
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
    const damageTextEntities = this.ecs.getEntitiesWithComponents(DamageText);

    for (const entity of damageTextEntities) {
      const damageText = this.ecs.getComponent(entity, DamageText);
      if (!damageText) continue;

      // Trova la posizione dell'entità target
      const targetEntity = this.ecs.getEntity(damageText.targetEntityId);
      if (!targetEntity) {
        // Rimuovi il testo di danno se l'entità target non esiste più
        this.ecs.removeEntity(entity);
        continue;
      }

      const targetTransform = this.ecs.getComponent(targetEntity, Transform);
      if (!targetTransform) continue;

      // Calcola posizione sopra l'entità con offset (X fisso, Y che si muove)
      const worldX = targetTransform.x + damageText.initialOffsetX;
      const worldY = targetTransform.y + damageText.currentOffsetY;

      // Converti coordinate mondo in coordinate schermo usando la camera
      const camera = (this.ecs as any).systems?.find((s: any) => s.getCamera)?.getCamera();
      if (!camera) continue;

      const canvasSize = ctx.canvas ? { width: ctx.canvas.width, height: ctx.canvas.height } : { width: 800, height: 600 };
      const screenPos = camera.worldToScreen(worldX, worldY, canvasSize.width, canvasSize.height);

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

      // Ripristina il contesto
      ctx.restore();
    }
  }

}
