import { System as BaseSystem } from '/src/infrastructure/ecs/System';
import { ECS } from '/src/infrastructure/ecs/ECS';
import { DamageText } from '/src/entities/combat/DamageText';
import { Transform } from '/src/entities/spatial/Transform';

/**
 * Rendering testi di danno
 */
export class DamageTextSystem extends BaseSystem {
  private movementSystem: any = null; // Cache del sistema movimento per accesso alla camera

  constructor(ecs: ECS, movementSystem?: any) {
    super(ecs);
    // Usa il movementSystem passato o cercalo
    this.movementSystem = movementSystem || this.findMovementSystem();
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
    // Riprova a trovare il movement system se necessario
    if (!this.movementSystem) {
      this.movementSystem = this.findMovementSystem();
    }

    if (!ctx.canvas || !this.movementSystem) {
      return; // Silenziosamente senza log per evitare spam
    }

    const camera = this.movementSystem.getCamera();
    if (!camera) return;

    const canvasSize = { width: ctx.canvas.width, height: ctx.canvas.height };
    const damageTextEntities = this.ecs.getEntitiesWithComponents(DamageText);

    for (const entity of damageTextEntities) {
      const damageText = this.ecs.getComponent(entity, DamageText);
      if (!damageText) continue;

      let worldX: number;
      let worldY: number;

      const targetEntity = this.ecs.getEntity(damageText.targetEntityId);
      if (targetEntity) {
        const targetTransform = this.ecs.getComponent(targetEntity, Transform);
        if (!targetTransform) continue;

        // Salva la posizione base dell'entità (senza offset di movimento)
        damageText.entityBaseX = targetTransform.x;
        damageText.entityBaseY = targetTransform.y;

        // Calcola posizione del testo con movimento
        worldX = targetTransform.x + damageText.initialOffsetX;
        worldY = targetTransform.y + damageText.currentOffsetY;
      } else {
        // Entità morta - usa posizione base + offset fisso (non si muove più)
        worldX = damageText.entityBaseX + damageText.initialOffsetX;
        worldY = damageText.entityBaseY + damageText.initialOffsetY;
      }

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
