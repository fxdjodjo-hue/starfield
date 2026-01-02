import { System as BaseSystem } from '/src/infrastructure/ecs/System';
import { ECS } from '/src/infrastructure/ecs/ECS';
import { DamageText } from '/src/entities/combat/DamageText';
import { Transform } from '/src/entities/spatial/Transform';

/**
 * Rendering testi di danno
 */
export class DamageTextSystem extends BaseSystem {
  private movementSystem: any = null; // Cache del sistema movimento per accesso alla camera

  constructor(ecs: ECS) {
    super(ecs);
    // Trova e cache del movement system per accesso alla camera
    this.movementSystem = this.findMovementSystem();
  }

  /**
   * Trova il sistema movimento per accesso alla camera
   */
  private findMovementSystem(): any {
    // Cerca nei sistemi registrati
    if (this.ecs && (this.ecs as any).systems) {
      return (this.ecs as any).systems.find((system: any) => system.getCamera);
    }
    return null;
  }

  /**
   * Rimuove un testo di danno quando scade naturalmente
   */
  private cleanupDamageText(targetEntityId: number, damageTextEntity: any): void {
    this.ecs.removeEntity(damageTextEntity);
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

      // Muovi il testo verso l'alto nel tempo (con limite massimo)
      const moveSpeed = -40; // Pixel al secondo verso l'alto (ridotto per durata 1s)
      const maxOffset = damageText.initialOffsetY - 100; // Non andare oltre 100px sopra l'entità
      damageText.currentOffsetY = Math.max(maxOffset, damageText.currentOffsetY + moveSpeed * deltaTimeSeconds);

      // Aggiorna lifetime
      damageText.lifetime -= deltaTime;

      // Rimuovi testi scaduti
      if (damageText.isExpired()) {
        this.cleanupDamageText(damageText.targetEntityId, entity);
      }
    }
  }

  /**
   * Renderizza i testi di danno
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (!ctx.canvas || !this.movementSystem) return;

    const camera = this.movementSystem.getCamera();
    if (!camera) return;

    const canvasSize = { width: ctx.canvas.width, height: ctx.canvas.height };

    for (const entity of this.ecs.getEntitiesWithComponents(DamageText)) {
      const damageText = this.ecs.getComponent(entity, DamageText);
      if (!damageText) continue;

      const targetEntity = this.ecs.getEntity(damageText.targetEntityId);
      if (!targetEntity) continue; // Se entità non esiste, testo sparisce

      const targetTransform = this.ecs.getComponent(targetEntity, Transform);
      if (!targetTransform) continue;

      const worldX = targetTransform.x + damageText.initialOffsetX;
      const worldY = targetTransform.y + damageText.currentOffsetY;
      const screenPos = camera.worldToScreen(worldX, worldY, canvasSize.width, canvasSize.height);

      ctx.save();
      ctx.globalAlpha = damageText.getAlpha();
      ctx.fillStyle = damageText.color;
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      ctx.fillText(damageText.value.toString(), screenPos.x, screenPos.y);
      ctx.restore();
    }
  }

}
