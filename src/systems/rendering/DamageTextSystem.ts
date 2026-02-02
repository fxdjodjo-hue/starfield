import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { GameSettings } from '../../core/settings/GameSettings';
import { DamageText } from '../../entities/combat/DamageText';
import { Transform } from '../../entities/spatial/Transform';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';
import { Authority, AuthorityLevel } from '../../entities/spatial/Authority';
import type { DamageSystem } from '../combat/DamageSystem';
import { DisplayManager } from '../../infrastructure/display';
import { NumberFormatter } from '../../core/utils/ui/NumberFormatter';
import { RemotePlayer } from '../../entities/player/RemotePlayer';

/**
 * Sistema per il rendering dei testi di danno fluttuanti
 * Gestisce animazione e visualizzazione dei numeri danno
 */
export class DamageTextSystem extends BaseSystem {
  private cameraSystem: any = null; // Cache del sistema camera
  private damageSystem: DamageSystem | null = null; // Riferimento al DamageSystem per gestire i contatori dei testi
  private visible: boolean = true;

  constructor(ecs: ECS, cameraSystem?: any, damageSystem?: DamageSystem) {
    super(ecs);

    // Initialize visibility from settings
    this.visible = GameSettings.getInstance().interface.showDamageNumbers;
    // Usa il cameraSystem passato o cercalo
    this.cameraSystem = cameraSystem || this.findCameraSystem();
    // Salva il riferimento al DamageSystem
    this.damageSystem = damageSystem || null;

    // Listen for settings changes
    document.addEventListener('settings:ui:damage_numbers', (e: any) => {
      this.visible = e.detail;
    });
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
   * @deprecated Rendering moved to PixiRenderSystem
   */
  render(ctx: CanvasRenderingContext2D): void {
    // Deprecated: PixiRenderSystem handles rendering now
  }
}
