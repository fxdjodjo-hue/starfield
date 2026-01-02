import { System as BaseSystem } from '/src/infrastructure/ecs/System';
import { ECS } from '/src/infrastructure/ecs/ECS';
import { DamageText } from '/src/entities/combat/DamageText';

/**
 * Sistema per gestire e renderizzare testi di danno fissi
 * Mostra numeri di danno fissi sopra le entità colpite
 */
export class DamageTextSystem extends BaseSystem {

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Aggiorna i testi di danno (solo lifetime, posizioni fisse)
   */
  update(deltaTime: number): void {
    // Trova tutte le entità con DamageText
    const damageTextEntities = this.ecs.getEntitiesWithComponents(DamageText);

    for (const entity of damageTextEntities) {
      const damageText = this.ecs.getComponent(entity, DamageText);
      if (!damageText) continue;

      // Testi fissi sopra l'entità - non muovere la posizione Y
      // Solo aggiorna lifetime
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

      // Disegna il testo
      ctx.fillText(damageText.value.toString(), damageText.x, damageText.y);

      // Ripristina il contesto
      ctx.restore();
    }
  }

  /**
   * Crea un nuovo testo di danno
   */
  createDamageText(value: number, x: number, y: number, color: string = '#ffffff'): void {
    const damageTextEntity = this.ecs.createEntity();
    const damageText = new DamageText(value, x, y, color);
    this.ecs.addComponent(damageTextEntity, DamageText, damageText);
  }
}
