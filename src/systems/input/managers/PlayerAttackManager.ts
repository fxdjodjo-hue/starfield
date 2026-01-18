import type { ECS } from '../../../infrastructure/ecs/ECS';
import type { LogSystem } from '../../rendering/LogSystem';
import { Transform } from '../../../entities/spatial/Transform';
import { InterpolationTarget } from '../../../entities/spatial/InterpolationTarget';
import { Velocity } from '../../../entities/spatial/Velocity';
import { Damage } from '../../../entities/combat/Damage';
import { SelectedNpc } from '../../../entities/combat/SelectedNpc';
import { Npc } from '../../../entities/ai/Npc';
import { LogType } from '../../../presentation/ui/LogMessage';
import { getPlayerRangeWidth, getPlayerRangeHeight } from '../../../config/PlayerConfig';
import { PlayerControlSystem } from '../PlayerControlSystem';
import { MathUtils } from '../../../core/utils/MathUtils';

/**
 * Manages player attack, NPC selection, and range validation
 */
export class PlayerAttackManager {
  private attackActivated: boolean = false;
  private lastInputTime: number = 0;
  private lastSpacePressTime: number = 0;
  private lastFaceUpdateTime: number = 0;
  private lastFaceAngle: number = 0;
  private readonly FACE_UPDATE_INTERVAL = 50; // ms tra aggiornamenti rotazione
  private readonly MIN_ANGLE_CHANGE = 0.05; // radianti minimi per aggiornare

  // Mantiene riferimento all'ultimo target per face-up anche quando deselezionato temporaneamente
  private lastFaceTarget: { x: number; y: number } | null = null;

  constructor(
    private readonly ecs: ECS,
    private readonly getPlayerEntity: () => any | null,
    private readonly getLogSystem: () => LogSystem | null,
    private readonly forceCombatCheck: () => void,
    private readonly stopCombatIfActive: () => void,
    private readonly setAttackActivated: (activated: boolean) => void
  ) {}

  /**
   * Handles SPACE press for attack activation (toggle mode)
   */
  public handleSpacePress(): void {
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);

    if (selectedNpcs.length === 0) {
      const nearestNpc = this.findNearestNpcInRange();
      if (nearestNpc) {
        this.selectNpc(nearestNpc, true);
      } else {
        const logSystem = this.getLogSystem();
        if (logSystem) {
          logSystem.addLogMessage('No target available nearby', LogType.ATTACK_FAILED, 2000);
        }
        return;
      }
    }

    const inRange = this.isSelectedNpcInRange();

    if (!inRange) {
      this.showOutOfRangeMessage();
      return;
    }

    this.attackActivated = true;
    this.lastInputTime = Date.now();
    this.setAttackActivated(true);
    this.forceCombatCheck();
  }

  /**
   * Handles key press with SPACE handling
   */
  handleKeyPress(key: string): void {
    if (key === 'Space') {
      const now = Date.now();
      if (now - this.lastSpacePressTime > 300) {
        this.lastSpacePressTime = now;

        const nearbyNpc = this.findNearbyNpcForSelection();
        const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
        const currentlySelectedNpc = selectedNpcs.length > 0 ? selectedNpcs[0] : null;

        if (nearbyNpc && this.isNpcInPlayerRange(nearbyNpc) &&
            (!currentlySelectedNpc || nearbyNpc.id !== currentlySelectedNpc.id)) {
          // Non disattivare l'attacco quando selezioni un nuovo NPC con spazio,
          // perché stai già per attivarlo subito dopo
          this.selectNpc(nearbyNpc, false);
          this.handleSpacePress();
        } else {
          if (currentlySelectedNpc) {
            if (this.attackActivated) {
              this.attackActivated = false;
              this.setAttackActivated(false);
              this.deactivateAttack();

              // Quando finisce l'attacco, DESELEZIONA l'NPC per permettere al movimento di controllare la rotazione
              this.deselectCurrentNpc();

              // Aggiorna immediatamente la rotazione del player verso la direzione corrente del movimento
              this.updatePlayerRotationAfterCombatEnd();
            } else {
              this.handleSpacePress();
            }
          } else {
            const logSystem = this.getLogSystem();
            if (logSystem) {
              logSystem.addLogMessage('No target available nearby', LogType.ATTACK_FAILED, 2000);
            }
          }
        }
      }
    }
  }

  /**
   * Finds nearest NPC in attack range (rectangular area)
   */
  private findNearestNpcInRange(): any | null {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return null;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    if (!playerTransform) return null;

    const npcs = this.ecs.getEntitiesWithComponents(Npc, Transform);
    const rangeWidth = getPlayerRangeWidth();
    const rangeHeight = getPlayerRangeHeight();

    let nearestNpc: any = null;
    let nearestDistance = Math.sqrt(rangeWidth * rangeWidth + rangeHeight * rangeHeight); // Max possible distance

    for (const npcEntity of npcs) {
      const npcTransform = this.ecs.getComponent(npcEntity, Transform);
      if (!npcTransform) continue;

      // Check if NPC is within rectangular range
      const dx = Math.abs(npcTransform.x - playerTransform.x);
      const dy = Math.abs(npcTransform.y - playerTransform.y);

      if (dx <= rangeWidth / 2 && dy <= rangeHeight / 2) {
        // NPC is within rectangle, calculate distance for "nearest"
        const distance = MathUtils.calculateDistance(npcTransform.x, npcTransform.y, playerTransform.x, playerTransform.y);
        if (distance < nearestDistance) {
          nearestNpc = npcEntity;
          nearestDistance = distance;
        }
      }
    }

    return nearestNpc;
  }

  /**
   * Finds nearby NPC for selection (within player attack range rectangle)
   */
  private findNearbyNpcForSelection(): any | null {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return null;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    if (!playerTransform) return null;

    const npcs = this.ecs.getEntitiesWithComponents(Npc, Transform);
    const rangeWidth = getPlayerRangeWidth();
    const rangeHeight = getPlayerRangeHeight();

    let closestNpc: any = null;
    let closestDistance = Math.sqrt(rangeWidth * rangeWidth + rangeHeight * rangeHeight); // Max possible distance

    for (const npcEntity of npcs) {
      const transform = this.ecs.getComponent(npcEntity, Transform);
      if (transform) {
        // Check if NPC is within rectangular range
        const dx = Math.abs(transform.x - playerTransform.x);
        const dy = Math.abs(transform.y - playerTransform.y);

        if (dx <= rangeWidth / 2 && dy <= rangeHeight / 2) {
          // NPC is within rectangle, calculate distance for "nearest"
          const distance = MathUtils.calculateDistance(transform.x, transform.y, playerTransform.x, playerTransform.y);
          if (distance < closestDistance) {
            closestNpc = npcEntity;
            closestDistance = distance;
          }
        }
      }
    }

    return closestNpc;
  }

  /**
   * Checks if selected NPC is in attack range (rectangular area)
   */
  private isSelectedNpcInRange(): boolean {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return false;

    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    if (selectedNpcs.length === 0) return false;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    const npcTransform = this.ecs.getComponent(selectedNpcs[0], Transform);

    if (!playerTransform || !npcTransform) return false;

    const rangeWidth = getPlayerRangeWidth();
    const rangeHeight = getPlayerRangeHeight();

    // Check if NPC is within rectangular range
    const dx = Math.abs(npcTransform.x - playerTransform.x);
    const dy = Math.abs(npcTransform.y - playerTransform.y);

    return dx <= rangeWidth / 2 && dy <= rangeHeight / 2;
  }

  /**
   * Checks if a specific NPC is in player range (rectangular area)
   */
  private isNpcInPlayerRange(npcEntity: any): boolean {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return false;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    const npcTransform = this.ecs.getComponent(npcEntity, Transform);

    if (!playerTransform || !npcTransform) return false;

    const rangeWidth = getPlayerRangeWidth();
    const rangeHeight = getPlayerRangeHeight();

    // Check if NPC is within rectangular range
    const dx = Math.abs(npcTransform.x - playerTransform.x);
    const dy = Math.abs(npcTransform.y - playerTransform.y);

    return dx <= rangeWidth / 2 && dy <= rangeHeight / 2;
  }

  /**
   * Shows out of range message
   */
  private showOutOfRangeMessage(): void {
    const logSystem = this.getLogSystem();
    if (logSystem) {
      logSystem.addLogMessage('Target out of range! Move closer to attack.', LogType.ATTACK_FAILED, 2000);
    }
  }

  /**
   * Gets player attack cooldown
   */
  private getPlayerAttackCooldown(): number {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return 1000;

    const damage = this.ecs.getComponent(playerEntity, Damage);
    return damage ? damage.attackCooldown : 1000;
  }

  /**
   * Returns if attack is currently activated
   */
  isAttackActivated(): boolean {
    return this.attackActivated;
  }

  /**
   * Deactivates attack forcefully
   */
  deactivateAttack(): void {
    if (this.attackActivated) {
      this.attackActivated = false;
      this.setAttackActivated(false);

      // Deselect all selected NPCs and reset rotation (definitivo)
      const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
      for (const npcEntity of selectedNpcs) {
        this.deselectNpcAndReset(npcEntity, false); // Definitivo
      }

      this.stopCombatIfActive();
    }
  }

  /**
   * Deseleziona un NPC specifico - può essere temporaneo o definitivo
   * Salva l'ultimo target per mantenere face-up se temporaneo
   */
  deselectNpcAndReset(npcEntity: any, isTemporary: boolean = false): void {
    console.log(`[PlayerAttackManager] deselectNpcAndReset called for NPC ${npcEntity?.id} (temporary: ${isTemporary})`);
    if (!npcEntity) {
      console.log(`[PlayerAttackManager] NPC entity is null/undefined`);
      return;
    }

    // Prima di rimuovere, salva la posizione per face-up temporaneo
    if (isTemporary) {
      const npcTransform = this.ecs.getComponent(npcEntity, Transform);
      if (npcTransform) {
        this.lastFaceTarget = { x: npcTransform.x, y: npcTransform.y };
        console.log(`[PlayerAttackManager] Saved lastFaceTarget for temporary deselection: ${this.lastFaceTarget.x}, ${this.lastFaceTarget.y}`);
      } else {
        console.log(`[PlayerAttackManager] No transform found for temporary NPC ${npcEntity.id}`);
      }
    } else {
      // Se deselezione definitiva, cancella anche l'ultimo target
      console.log(`[PlayerAttackManager] Clearing lastFaceTarget for permanent deselection`);
      this.lastFaceTarget = null;
    }

    // Rimuovi il componente SelectedNpc
    this.ecs.removeComponent(npcEntity, SelectedNpc);
    console.log(`[PlayerAttackManager] Removed SelectedNpc component from NPC ${npcEntity.id}`);

    // Per deselezioni definitive, resetta sempre la rotazione
    if (!isTemporary) {
      console.log(`[PlayerAttackManager] Calling resetShipRotation for permanent deselection`);
      this.resetShipRotation();
    }
  }

  /**
   * Reset ship rotation when deselecting NPC
   * Sets rotation to movement direction or neutral (0) if stationary
   * Also updates InterpolationTarget to prevent interpolation conflicts
   */
  private resetShipRotation(): void {
    console.log('[SHIP_ROTATION_RESET] Resetting ship rotation...');
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return;

    const transform = this.ecs.getComponent(playerEntity, Transform);
    const velocity = this.ecs.getComponent(playerEntity, Velocity);
    const interpolationTarget = this.ecs.getComponent(playerEntity, InterpolationTarget);

    if (!transform) {
      console.log('[SHIP_ROTATION_RESET] No transform component found');
      return;
    }

    let newRotation = 0;
    const oldRotation = transform.rotation;

    if (velocity && (velocity.x !== 0 || velocity.y !== 0)) {
      // If moving, set rotation to movement direction
      newRotation = Math.atan2(velocity.y, velocity.x);
      console.log(`[SHIP_ROTATION_RESET] Moving - set rotation to movement direction: ${newRotation.toFixed(3)} (was ${oldRotation.toFixed(3)})`);
    } else {
      // If stationary, set to neutral direction (0 = right)
      newRotation = 0;
      console.log(`[SHIP_ROTATION_RESET] Stationary - set rotation to neutral: 0 (was ${oldRotation.toFixed(3)})`);
    }

    // CRITICAL: Reset both transform AND interpolation target immediately
    // This prevents any interpolation conflicts or stuck rotations
    transform.rotation = newRotation;
    if (interpolationTarget) {
      // Force immediate update without interpolation lag
      interpolationTarget.renderRotation = newRotation;
      interpolationTarget.targetRotation = newRotation;
      console.log('[SHIP_ROTATION_RESET] Force-updated InterpolationTarget to prevent conflicts');
    }
  }

  /**
   * Ruota la nave verso l'NPC selezionato durante combattimento
   * Se non ci sono NPC selezionati, usa l'ultimo target salvato (per deselezioni temporanee)
   * Usa InterpolationTarget per rotazioni fluide senza vibrazioni
   */
  faceSelectedNpc(): void {
    const now = Date.now();

    // Throttling: non aggiornare troppo frequentemente
    if (now - this.lastFaceUpdateTime < this.FACE_UPDATE_INTERVAL) {
      return;
    }

    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return;

    let targetX: number | null = null;
    let targetY: number | null = null;

    console.log(`[faceSelectedNpc] Checking for face targets...`);

    // Prima priorità: NPC attualmente selezionato
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    console.log(`[faceSelectedNpc] Found ${selectedNpcs.length} selected NPCs`);
    if (selectedNpcs.length > 0) {
      const selectedNpc = selectedNpcs[0];
      const npcTransform = this.ecs.getComponent(selectedNpc, Transform);
      if (npcTransform) {
        targetX = npcTransform.x;
        targetY = npcTransform.y;
        console.log(`[faceSelectedNpc] Using selected NPC position: ${targetX}, ${targetY}`);
      } else {
        console.log(`[faceSelectedNpc] Selected NPC ${selectedNpc.id} has no transform`);
      }
    }
    // Seconda priorità: ultimo target salvato (per deselezioni temporanee)
    else if (this.lastFaceTarget) {
      targetX = this.lastFaceTarget.x;
      targetY = this.lastFaceTarget.y;
      console.log(`[faceSelectedNpc] Using lastFaceTarget: ${targetX}, ${targetY}`);
    } else {
      console.log(`[faceSelectedNpc] No face target available`);
    }

    // Se non abbiamo nessun target, esci
    if (targetX === null || targetY === null) {
      console.log(`[faceSelectedNpc] No valid target, exiting`);
      return;
    }

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    const playerInterpolation = this.ecs.getComponent(playerEntity, InterpolationTarget);

    if (!playerTransform) {
      console.log(`[faceSelectedNpc] No player transform found`);
      return;
    }

    const dx = targetX - playerTransform.x;
    const dy = targetY - playerTransform.y;
    const angle = Math.atan2(dy, dx);

    console.log(`[faceSelectedNpc] Calculated angle: ${angle.toFixed(3)} towards target at ${targetX.toFixed(1)}, ${targetY.toFixed(1)}`);

    // Controllo cambio minimo: evita aggiornamenti per cambiamenti piccoli
    const angleDiff = Math.abs(angle - this.lastFaceAngle);
    if (angleDiff < this.MIN_ANGLE_CHANGE) {
      console.log(`[faceSelectedNpc] Angle change too small (${angleDiff.toFixed(3)}), skipping`);
      return; // Angolo cambiato troppo poco
    }

    // Usa InterpolationTarget per rotazione fluida invece di impostare direttamente
    if (playerInterpolation) {
      playerInterpolation.updateTarget(playerTransform.x, playerTransform.y, angle);
      console.log(`[faceSelectedNpc] Updated InterpolationTarget to angle ${angle.toFixed(3)}`);
    } else {
      // Fallback se non c'è InterpolationTarget
      playerTransform.rotation = angle;
      console.log(`[faceSelectedNpc] Set transform.rotation directly to ${angle.toFixed(3)}`);
    }

    // Aggiorna timestamp e ultimo angolo
    this.lastFaceUpdateTime = now;
    this.lastFaceAngle = angle;
  }

  /**
   * Aggiorna la rotazione del player verso la direzione del movimento corrente
   * quando finisce il combattimento (per evitare che la nave rimanga "bloccata" nella rotazione del face-up)
   */
  private updatePlayerRotationAfterCombatEnd(): void {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    const playerVelocity = this.ecs.getComponent(playerEntity, Velocity);
    const playerInterpolation = this.ecs.getComponent(playerEntity, InterpolationTarget);

    if (!playerTransform || !playerVelocity) return;

    // Se il player si sta muovendo, aggiorna la rotazione verso la direzione del movimento
    if (playerVelocity.x !== 0 || playerVelocity.y !== 0) {
      const angle = Math.atan2(playerVelocity.y, playerVelocity.x);

      // Usa InterpolationTarget per rotazione fluida invece di impostare direttamente
      if (playerInterpolation) {
        playerInterpolation.updateTarget(playerTransform.x, playerTransform.y, angle);
      } else {
        playerTransform.rotation = angle;
      }
    }
  }

  /**
   * Deseleziona l'NPC attualmente selezionato
   */
  private deselectCurrentNpc(): void {
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    for (const npcEntity of selectedNpcs) {
      this.deselectNpcAndReset(npcEntity, false); // Definitivo
    }
  }

  /**
   * Selects a specific NPC
   */
  private selectNpc(npcEntity: any, deactivateAttack: boolean = true): void {
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    const alreadySelected = selectedNpcs.length > 0 && selectedNpcs[0].id === npcEntity.id;
    
    if (deactivateAttack) {
      this.deactivateAttackOnAnySelection();
    }

    this.deselectAllNpcs();

    this.ecs.addComponent(npcEntity, SelectedNpc, new SelectedNpc());

    // Selection logged removed
  }

  /**
   * Deactivates attack on any selection
   */
  private deactivateAttackOnAnySelection(): void {
    const playerControlSystem = this.ecs.systems?.find((system) =>
      system instanceof PlayerControlSystem
    ) as PlayerControlSystem | undefined;

    if (playerControlSystem) {
      playerControlSystem.deactivateAttack();
    }
  }

  /**
   * Deselects all NPCs
   */
  private deselectAllNpcs(): void {
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    for (const npcEntity of selectedNpcs) {
      this.deselectNpcAndReset(npcEntity, false); // Definitivo
    }
  }
}
