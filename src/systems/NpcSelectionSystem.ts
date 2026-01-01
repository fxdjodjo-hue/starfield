import { BaseSystem } from '../ecs/System.js';
import { ECS } from '../ecs/ECS.js';
import { Npc } from '../components/Npc.js';
import { Transform } from '../components/Transform.js';
import { SelectedNpc } from '../components/SelectedNpc.js';

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
   * Gestisce un click del mouse alle coordinate schermo
   */
  handleMouseClick(screenX: number, screenY: number): void {
    // Trova l'NPC più vicino al punto di click (se entro una certa distanza)
    const clickedNpc = this.findNpcAtScreenPosition(screenX, screenY);

    if (clickedNpc) {
      this.selectNpc(clickedNpc);
      this.onNpcClick?.(clickedNpc);
      console.log(`NPC selected at screen position: (${screenX}, ${screenY})`);
    } else {
      // Click su area vuota - deseleziona tutti gli NPC
      this.deselectAllNpcs();
      console.log('No NPC clicked - deselected all');
    }
  }

  /**
   * Trova l'NPC più vicino alla posizione schermo (se entro 30px)
   */
  private findNpcAtScreenPosition(screenX: number, screenY: number): any | null {
    const npcs = this.ecs.getEntitiesWithComponents(Npc, Transform);
    let closestNpc: any = null;
    let closestDistance = 30; // Distanza massima per il click (30px)

    for (const npcEntity of npcs) {
      const transform = this.ecs.getComponent(npcEntity, Transform);
      if (transform) {
        // Converti coordinate mondo in schermo (semplificato, assumendo camera centrata su player)
        // In un sistema reale, dovremmo usare la camera per la conversione precisa
        const npcScreenX = transform.x; // Per ora semplificato
        const npcScreenY = transform.y;

        const distance = Math.sqrt(
          Math.pow(screenX - npcScreenX, 2) +
          Math.pow(screenY - npcScreenY, 2)
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
