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

    for (const entity of damageTextEntities) {
      const damageText = this.ecs.getComponent(entity, DamageText);
      if (!damageText) continue;

      // Trova la posizione dell'entità target
      const targetEntity = this.ecs.getEntity(damageText.targetEntityId);
      if (!targetEntity) continue;

      const targetTransform = this.ecs.getComponent(targetEntity, Transform);
      if (!targetTransform) continue;

      // Calcola posizione sopra l'entità con offset
      const screenX = targetTransform.x + damageText.offsetX;
      const screenY = targetTransform.y + damageText.offsetY;

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
