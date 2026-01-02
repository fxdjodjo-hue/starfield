import { BaseSystem } from '../ecs/System';
import { ECS } from '../ecs/ECS';
import { Npc } from '../components/Npc';
import { Transform } from '../components/Transform';
import { SelectedNpc } from '../components/SelectedNpc';

/**
 * Sistema di selezione NPC - gestisce click su NPC e selezione
 */
export class NpcSelectionSystem extends BaseSystem {
  private onNpcClick?: (npcEntity: any) => void;

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Imposta il callback per quando un NPC viene cliccato
   */
  setOnNpcClickCallback(callback: (npcEntity: any) => void): void {
    this.onNpcClick = callback;
  }

  update(deltaTime: number): void {
    // La logica di selezione è gestita tramite callback sui click
  }

  /**
   * Gestisce un click del mouse alle coordinate mondo
   * @returns true se ha selezionato un NPC, false altrimenti
   */
  handleMouseClick(worldX: number, worldY: number): boolean {
    // Trova l'NPC più vicino al punto di click (se entro una certa distanza)
    const clickedNpc = this.findNpcAtWorldPosition(worldX, worldY);

    if (clickedNpc) {
      this.selectNpc(clickedNpc);
      return true; // Ha selezionato un NPC
    }

    return false; // Non ha selezionato nulla
      this.onNpcClick?.(clickedNpc);
    }
    // Nota: Non deselezionare automaticamente se non si clicca su un NPC
    // La selezione rimane attiva fino a quando non si clicca su un altro NPC
  }

  /**
   * Trova l'NPC più vicino alla posizione mondo (se entro 50px)
   */
  private findNpcAtWorldPosition(worldX: number, worldY: number): any | null {
    const npcs = this.ecs.getEntitiesWithComponents(Npc, Transform);
    let closestNpc: any = null;
    let closestDistance = 50; // Distanza massima per il click (50px nel mondo)

    for (const npcEntity of npcs) {
      const transform = this.ecs.getComponent(npcEntity, Transform);
      if (transform) {
        const distance = Math.sqrt(
          Math.pow(worldX - transform.x, 2) +
          Math.pow(worldY - transform.y, 2)
        );

        if (distance < closestDistance) {
          closestNpc = npcEntity;
          closestDistance = distance;
        }
      }
    }

    return closestNpc;
  }

  /**
   * Seleziona un NPC specifico (deselezionando gli altri)
   */
  private selectNpc(npcEntity: any): void {
    // Rimuovi selezione da tutti gli NPC
    this.deselectAllNpcs();

    // Aggiungi selezione al NPC selezionato
    this.ecs.addComponent(npcEntity, SelectedNpc, new SelectedNpc());
  }

  /**
   * Deseleziona tutti gli NPC
   */
  private deselectAllNpcs(): void {
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    for (const entity of selectedNpcs) {
      this.ecs.removeComponent(entity, SelectedNpc);
    }
  }

  /**
   * Restituisce l'NPC attualmente selezionato (se presente)
   */
  getSelectedNpc(): any | null {
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    return selectedNpcs.length > 0 ? selectedNpcs[0] : null;
  }
}