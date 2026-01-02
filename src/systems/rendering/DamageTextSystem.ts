import { System as BaseSystem } from '/src/infrastructure/ecs/System';
import { ECS } from '/src/infrastructure/ecs/ECS';
import { DamageText } from '/src/entities/combat/DamageText';
import { Transform } from '/src/entities/spatial/Transform';

/**
 * Sistema per gestire e renderizzare testi di danno fissi sopra le entità
 * Mostra numeri di danno che seguono le entità colpite durante il movimento
 * I testi continuano a esistere anche quando l'entità muore
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
    const damageTextEntities = this.ecs.getEntitiesWithComponents(DamageText);

    // Se non abbiamo il canvas, non renderizzare
    if (!ctx.canvas) return;

    const canvasSize = { width: ctx.canvas.width, height: ctx.canvas.height };

    // Se non abbiamo la camera, non renderizzare
    if (!this.movementSystem) {
      this.movementSystem = this.findMovementSystem(); // Riprova a trovarla
      if (!this.movementSystem) return;
    }

    const camera = this.movementSystem.getCamera();
    if (!camera) return;

    for (const entity of damageTextEntities) {
      const damageText = this.ecs.getComponent(entity, DamageText);
      if (!damageText) continue;

      let worldX: number;
      let worldY: number;

      // Trova la posizione dell'entità target
      const targetEntity = this.ecs.getEntity(damageText.targetEntityId);
      if (targetEntity) {
        // Entità ancora viva - usa la sua posizione corrente
        const targetTransform = this.ecs.getComponent(targetEntity, Transform);
        if (!targetTransform) continue;

        // Calcola posizione sopra l'entità con offset (X fisso, Y che si muove)
        worldX = targetTransform.x + damageText.initialOffsetX;
        worldY = targetTransform.y + damageText.currentOffsetY;

        // Salva l'ultima posizione conosciuta
        damageText.lastKnownWorldX = worldX;
        damageText.lastKnownWorldY = worldY;
      } else {
        // Entità morta - usa l'ultima posizione conosciuta e FERMati lì (non continuare l'animazione)
        worldX = damageText.lastKnownWorldX;
        worldY = damageText.lastKnownWorldY;
      }

      // Converti coordinate mondo in coordinate schermo
      const screenPos = camera.worldToScreen(worldX, worldY, canvasSize.width, canvasSize.height);

      // Controlla se le coordinate sono valide e visibili (con margine)
      const margin = 50;
      if (screenPos.x < -margin || screenPos.x > canvasSize.width + margin ||
          screenPos.y < -margin || screenPos.y > canvasSize.height + margin) {
        continue; // Salta testi fuori dallo schermo per performance
      }

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
