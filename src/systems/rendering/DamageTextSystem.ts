import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { DamageText } from '../../entities/combat/DamageText';
import { Transform } from '../../entities/spatial/Transform';
import type { DamageSystem } from '../combat/DamageSystem';
import { DisplayManager } from '../../infrastructure/display';

/**
 * Sistema per il rendering dei testi di danno fluttuanti
 * Gestisce animazione e visualizzazione dei numeri danno
 */
export class DamageTextSystem extends BaseSystem {
  private cameraSystem: any = null; // Cache del sistema camera
  private damageSystem: DamageSystem | null = null; // Riferimento al DamageSystem per gestire i contatori dei testi

  constructor(ecs: ECS, cameraSystem?: any, damageSystem?: DamageSystem) {
    super(ecs);
    // Usa il cameraSystem passato o cercalo
    this.cameraSystem = cameraSystem || this.findCameraSystem();
    // Salva il riferimento al DamageSystem
    this.damageSystem = damageSystem;
  }

  /**
   * Trova il sistema camera
   */
  private findCameraSystem(): any {
    // Cerca nei sistemi registrati (robusto contro minificazione)
    if (this.ecs && (this.ecs as any).systems) {
      return (this.ecs as any).systems.find((system: any) => typeof system.getCamera === 'function');
    }
    return null;
  }

  /**
   * Rimuove un testo di danno quando scade naturalmente
   */
  private cleanupDamageText(targetEntityId: number, damageTextEntity: any): void {
    // Ottieni il projectileType dal componente DamageText prima di rimuoverlo
    const damageText = this.ecs.getComponent(damageTextEntity, DamageText);
    const projectileType = damageText?.projectileType;

    this.ecs.removeEntity(damageTextEntity);
    // Decrementa il contatore dei testi attivi nel DamageSystem
    if (this.damageSystem && this.damageSystem.decrementDamageTextCount) {
      this.damageSystem.decrementDamageTextCount(targetEntityId, projectileType);
    }
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
      const moveSpeed = -40; // Pixel al secondo verso l'alto
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
    if (!ctx.canvas || !this.cameraSystem) {
      return; // Silenziosamente senza log per evitare spam
    }

    const camera = this.cameraSystem.getCamera();
    if (!camera) return;

    const canvasSize = DisplayManager.getInstance().getLogicalSize();
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

        worldX = targetTransform.x + damageText.initialOffsetX;
        worldY = targetTransform.y + damageText.currentOffsetY;

        worldX = targetTransform.x + damageText.initialOffsetX;
        worldY = targetTransform.y + damageText.currentOffsetY;

        // Salva l'ultima posizione valida
        damageText.lastWorldX = worldX;
        damageText.lastWorldY = worldY;
      } else {
        // Usa l'ultima posizione conosciuta se entità non esiste più
        worldX = damageText.lastWorldX;
        worldY = damageText.lastWorldY;
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
