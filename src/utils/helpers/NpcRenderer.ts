import { Npc } from '../../entities/ai/Npc';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';

/**
 * Helper for NPC rendering logic (rotation calculations)
 */
export class NpcRenderer {
  /**
   * Get the appropriate rotation angle for NPC rendering based on behavior and velocity
   * Used only for local NPCs - remote NPCs use transform.rotation directly
   */
  static getRenderRotation(npc: Npc, transform: Transform, velocity?: Velocity): number {

    // Fallback per NPC locali: calcola basato su velocity
    if (npc.behavior === 'aggressive') {
      return transform.rotation; // Combat system rotation
    } else if (npc.behavior === 'flee' && velocity) {
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      if (speed > 0.1) {
        return Math.atan2(velocity.y, velocity.x);
      }
    } else if (velocity) {
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      if (speed > 0.1) {
        return Math.atan2(velocity.y, velocity.x);
      }
    }

    return transform.rotation; // Default fallback
  }
}
