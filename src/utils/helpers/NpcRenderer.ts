import { Npc } from '../../entities/ai/Npc';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';

/**
 * Helper for NPC rendering logic (rotation calculations)
 */
export class NpcRenderer {
  /**
   * Get the appropriate rotation angle for NPC rendering based on behavior and velocity
   */
  static getRenderRotation(npc: Npc, transform: Transform, velocity?: Velocity): number {
    // Priority: transform.rotation (for remote/interpolated NPCs)
    // Fallback: velocity-based calculation for local NPCs

    // Se abbiamo una rotazione valida nel transform, usala (per NPC remoti/interpolati)
    if (transform.rotation !== 0 && Number.isFinite(transform.rotation)) {
      return transform.rotation;
    }

    // Fallback per NPC locali: calcola basato su velocity
    if (npc.behavior === 'aggressive') {
      return transform.rotation; // Combat system rotation
    } else if (npc.behavior === 'flee' && velocity) {
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      if (speed > 0.1) {
        return Math.atan2(velocity.y, velocity.x) + Math.PI / 2;
      }
    } else if (velocity) {
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      if (speed > 0.1) {
        return Math.atan2(velocity.y, velocity.x) + Math.PI / 2;
      }
    }

    return transform.rotation; // Default fallback
  }
}
