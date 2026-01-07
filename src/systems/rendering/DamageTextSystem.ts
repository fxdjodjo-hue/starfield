import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { DamageText } from '../../entities/combat/DamageText';
import { Transform } from '../../entities/spatial/Transform';

/**
 * Sistema per il rendering dei testi di danno fluttuanti
 * Gestisce animazione e visualizzazione dei numeri danno
 */
export class DamageTextSystem extends BaseSystem {
  private cameraSystem: any = null; // Cache del sistema camera
  private combatSystem: any = null; // Riferimento al CombatSystem per gestire i contatori dei testi

  constructor(ecs: ECS, cameraSystem?: any, combatSystem?: any) {
    super(ecs);
    // Usa il cameraSystem passato o cercalo
    this.cameraSystem = cameraSystem || this.findCameraSystem();
    // Salva il riferimento al CombatSystem
    this.combatSystem = combatSystem;
  }

  /**
   * Trova il sistema camera
   */
  private findCameraSystem(): any {
    // Cerca nei sistemi registrati
    if (this.ecs && (this.ecs as any).systems) {
      return (this.ecs as any).systems.find((system: any) => system.constructor?.name === 'CameraSystem');
    }
    return null;
  }

  /**
   * Rimuove un testo di danno quando scade naturalmente
   */
  private cleanupDamageText(targetEntityId: number, damageTextEntity: any): void {
    this.ecs.removeEntity(damageTextEntity);
    // Decrementa il contatore dei testi attivi nel CombatSystem
    if (this.combatSystem && this.combatSystem.decrementDamageTextCount) {
      this.combatSystem.decrementDamageTextCount(targetEntityId);
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
    console.log('🔍 DamageTextSystem.render() called'); // TEMP DEBUG

    if (!ctx.canvas || !this.cameraSystem) {
      console.log('❌ DamageTextSystem: missing canvas or camera'); // TEMP DEBUG
      return; // Silenziosamente senza log per evitare spam
    }

    const camera = this.cameraSystem.getCamera();
    if (!camera) {
      console.log('❌ DamageTextSystem: no camera available'); // TEMP DEBUG
      return;
    }

    const canvasSize = { width: ctx.canvas.width, height: ctx.canvas.height };
    const damageTextEntities = this.ecs.getEntitiesWithComponents(DamageText);
    console.log(`📊 Found ${damageTextEntities.length} damage text entities`); // TEMP DEBUG

    // Log dettagli di ogni entità trovata
    for (const entity of damageTextEntities) {
      console.log(`🎯 Damage text entity: ${entity}`); // TEMP DEBUG
    }

    for (const entity of damageTextEntities) {
      const damageText = this.ecs.getComponent(entity, DamageText);
      if (!damageText) {
        console.log('⚠️ DamageTextSystem: entity without DamageText component'); // TEMP DEBUG
        continue;
      }

      console.log(`🎯 Processing damage text: ${damageText.value} for entity ${damageText.targetEntityId}`); // TEMP DEBUG

      let worldX: number;
      let worldY: number;

      const targetEntity = this.ecs.getEntity(damageText.targetEntityId);
      if (targetEntity) {
        const targetTransform = this.ecs.getComponent(targetEntity, Transform);
        if (!targetTransform) {
          console.log(`❌ DamageTextSystem: target entity ${damageText.targetEntityId} has no Transform`); // TEMP DEBUG
          continue;
        }

        worldX = targetTransform.x + damageText.initialOffsetX;
        worldY = targetTransform.y + damageText.currentOffsetY;
        console.log(`✅ DamageTextSystem: using live coords (${worldX.toFixed(0)}, ${worldY.toFixed(0)})`); // TEMP DEBUG

        worldX = targetTransform.x + damageText.initialOffsetX;
        worldY = targetTransform.y + damageText.currentOffsetY;

        // Salva l'ultima posizione valida
        damageText.lastWorldX = worldX;
        damageText.lastWorldY = worldY;
      } else {
        // Usa l'ultima posizione conosciuta se entità non esiste più
        console.log(`⚠️ DamageTextSystem: target entity ${damageText.targetEntityId} not found, using last coords`); // TEMP DEBUG
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

    console.log(`✅ DamageTextSystem.render() completed, rendered ${damageTextEntities.length} texts`); // TEMP DEBUG
  }

}
