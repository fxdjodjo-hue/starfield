import { BaseSystem } from '../ecs/System';
import { ECS } from '../ecs/ECS';
import { DamageText } from '../components/DamageText';

/**
 * Sistema per gestire e renderizzare testi di danno fluttuanti
 * Mostra numeri di danno sopra le entità colpite con animazione
 */
export class DamageTextSystem extends BaseSystem {

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Aggiorna i testi di danno (posizione, lifetime)
   */
  update(deltaTime: number): void {
    const deltaTimeSeconds = deltaTime / 1000; // Converti in secondi

    // Trova tutte le entità con DamageText
    const damageTextEntities = this.ecs.getEntitiesWithComponents(DamageText);

    for (const entity of damageTextEntities) {
      const damageText = this.ecs.getComponent(entity, DamageText);
      if (!damageText) continue;

      // Aggiorna posizione (movimento verso l'alto)
      damageText.y += damageText.velocityY * deltaTimeSeconds;

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
