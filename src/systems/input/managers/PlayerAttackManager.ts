import type { ECS } from '../../../infrastructure/ecs/ECS';
import type { LogSystem } from '../../rendering/LogSystem';
import { Transform } from '../../../entities/spatial/Transform';
import { Damage } from '../../../entities/combat/Damage';
import { SelectedNpc } from '../../../entities/combat/SelectedNpc';
import { Npc } from '../../../entities/ai/Npc';
import { LogType } from '../../../presentation/ui/LogMessage';
import { getPlayerRangeWidth, getPlayerRangeHeight } from '../../../config/PlayerConfig';
import { PlayerControlSystem } from '../PlayerControlSystem';

/**
 * Manages player attack, NPC selection, and range validation
 */
export class PlayerAttackManager {
  private attackActivated: boolean = false;
  private lastInputTime: number = 0;
  private lastSpacePressTime: number = 0;

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
        const distance = Math.sqrt(dx * dx + dy * dy);
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
          const distance = Math.sqrt(dx * dx + dy * dy);
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

      // Remove SelectedNpc component from all selected NPCs
      const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
      for (const npcEntity of selectedNpcs) {
        this.ecs.removeComponent(npcEntity, SelectedNpc);
      }

      this.stopCombatIfActive();
    }
  }

  /**
   * Rotates player towards selected NPC (only during active combat)
   */
  faceSelectedNpc(): void {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return;

    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    if (selectedNpcs.length === 0) return;

    const selectedNpc = selectedNpcs[0];
    const npcTransform = this.ecs.getComponent(selectedNpc, Transform);
    const playerTransform = this.ecs.getComponent(playerEntity, Transform);

    if (!npcTransform || !playerTransform) return;

    const dx = npcTransform.x - playerTransform.x;
    const dy = npcTransform.y - playerTransform.y;
    const angle = Math.atan2(dy, dx);
    playerTransform.rotation = angle;
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
      this.ecs.removeComponent(npcEntity, SelectedNpc);
    }
  }
}
