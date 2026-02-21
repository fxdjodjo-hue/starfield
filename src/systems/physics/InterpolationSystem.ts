import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';
import { NETWORK_CONFIG } from '../../config/NetworkConfig';

/**
 * InterpolationSystem - MMO-Grade Render-Phase Interpolation
 *
 * This system is responsible for updating the visual representation of remote
 * entities (NPCs and other players). It has been redesigned to ONLY operate
 * in the render phase, not the logic update phase.
 *
 * Why?
 * The game loop uses a fixed timestep for logic updates. When the browser tab
 * is throttled (backgrounded), it catches up by running many logic ticks
 * in a single frame. If interpolation is in the logic loop, it runs N times
 * per frame, causing "acceleration".
 *
 * By moving interpolation to `render()`, it only executes once per visual frame,
 * regardless of how many logic ticks occurred.
 *
 * How?
 * 1. `update()` is now a no-op.
 * 2. `render()` calls `interpolation.interpolate(renderTime)` for each entity.
 * 3. `renderTime` is `performance.now() - INTERPOLATION_DELAY`.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠️ CRITICAL: DO NOT REINTRODUCE THE FOLLOWING PATTERNS ⚠️                ║
 * ║                                                                           ║
 * ║ ❌ pos += (target - pos) * factor  (tick-based easing)                    ║
 * ║ ❌ Interpolating in update() "for convenience"                            ║
 * ║ ❌ Extrapolating forward to "reduce lag"                                  ║
 * ║                                                                           ║
 * ║ If any of these patterns are reintroduced, the NPC acceleration bug       ║
 * ║ WILL RETURN. See: npc_acceleration_post_mortem.md                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */
export class InterpolationSystem extends BaseSystem {
  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * LOGIC UPDATE - Intentionally a no-op.
   * All interpolation is performed in render().
   */
  update(_deltaTime: number): void {
    // No-op. See render() for interpolation logic.
    // This is the core of the MMO-grade fix: logic and render are separated.
  }

  /**
   * RENDER - Updates visual positions of remote entities.
   * Called once per visual frame by the ECS render loop.
   * @param _ctx Canvas rendering context (unused by this system, but required by interface).
   */
  render(_ctx: CanvasRenderingContext2D): void {
    // FIX: The delay is now embedded in the tickOffset calculation in InterpolationTarget.
    // We pass Date.now() directly; the tickOffset will convert it to the correct render time.
    const renderTime = Date.now();

    // Find all entities with interpolation targets
    const entities = this.ecs.getEntitiesWithComponentsReadOnly(Transform, InterpolationTarget);

    for (const entity of entities) {
      const transform = this.ecs.getComponent(entity, Transform);
      const interpolation = this.ecs.getComponent(entity, InterpolationTarget);

      if (transform && interpolation && interpolation.enabled) {
        // Perform snapshot-based interpolation
        interpolation.interpolate(renderTime);

        // Apply interpolated values to Transform for rendering
        transform.x = interpolation.renderX;
        transform.y = interpolation.renderY;
        transform.rotation = interpolation.renderRotation;
      }
    }
  }
}
