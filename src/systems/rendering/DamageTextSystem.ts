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
    const damageTextEntities = this.ecs.getEntitiesWithComponents(DamageText);
    console.log(`[DamageTextSystem] Found ${damageTextEntities.length} damage text entities`);

    for (const entity of damageTextEntities) {
      const damageText = this.ecs.getComponent(entity, DamageText);
      if (!damageText) continue;

      // Trova la posizione dell'entità target
      const targetEntity = this.ecs.getEntity(damageText.targetEntityId);
      if (!targetEntity) {
        console.log(`[DamageTextSystem] Target entity ${damageText.targetEntityId} not found for damage ${damageText.value}`);
        continue;
      }

      const targetTransform = this.ecs.getComponent(targetEntity, Transform);
      if (!targetTransform) {
        console.log(`[DamageTextSystem] No Transform component on entity ${damageText.targetEntityId}`);
        continue;
      }

      // Calcola posizione sopra l'entità con offset
      const screenX = targetTransform.x + damageText.offsetX;
      const screenY = targetTransform.y + damageText.offsetY;
      console.log(`[DamageTextSystem] Rendering damage ${damageText.value} at (${screenX}, ${screenY}) for entity ${damageText.targetEntityId}`);

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
      ctx.fillText(damageText.value.toString(), screenX, screenY);

      // Ripristina il contesto
      ctx.restore();
    }
  }

}
