import { InputValidator } from '../../core/utils/InputValidator';
import { LoggerWrapper, LogCategory } from '../../core/data/LoggerWrapper';
import { NETWORK_CONFIG } from '../../config/NetworkConfig';

/**
 * Snapshot of entity state at a specific server timestamp.
 * Used for timeline-based interpolation (MMO-grade).
 */
export interface Snapshot {
  x: number;
  y: number;
  rotation: number;
  timestamp: number; // Ideally server timestamp, or client-side performance.now() at receive time
}

/**
 * InterpolationTarget - MMO-Grade Snapshot Interpolation System
 *
 * Instead of chasing a single "target" position, this component stores a buffer
 * of recent server snapshots. The render position is then interpolated between
 * two snapshots based on a "render time" that is slightly in the past.
 * This makes rendering completely independent of the logic tick rate or catch-up
 * loops, fixing the NPC acceleration bug on tab switch.
 *
 * How it works:
 * 1. Server sends position updates. `updateTarget` pushes them to `snapshots[]`.
 * 2. During `render`, `interpolate(renderTime)` is called.
 * 3. `interpolate` finds the two snapshots surrounding `renderTime` and lerps.
 * 4. `Transform` is updated with the lerped position.
 *
 * Key properties:
 * - `renderX/Y/Rotation`: The current visual position, output of `interpolate`.
 * - `snapshots`: The buffer of recent server states.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠️ CRITICAL: DO NOT REINTRODUCE THE FOLLOWING PATTERNS ⚠️                ║
 * ║                                                                           ║
 * ║ ❌ pos += (target - pos) * factor  (tick-based easing)                    ║
 * ║ ❌ Interpolating in the logic loop "for convenience"                      ║
 * ║ ❌ Extrapolating forward to "reduce lag"                                  ║
 * ║                                                                           ║
 * ║ If any of these patterns are reintroduced, the NPC acceleration bug       ║
 * ║ WILL RETURN. See: npc_acceleration_post_mortem.md                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */
export class InterpolationTarget {
  // ==========================================
  // POSIZIONE RENDERIZZATA (visibile)
  // ==========================================
  renderX: number;
  renderY: number;
  renderRotation: number;

  // ==========================================
  // SNAPSHOT BUFFER (replaces targetX/Y)
  // ==========================================
  private snapshots: Snapshot[] = [];

  // ==========================================
  // VALIDAZIONE POSIZIONI
  // ==========================================
  private static readonly MAX_POSITION = 50000;
  private static readonly MIN_POSITION = -50000;

  /**
   * Valida che una posizione sia ragionevole (non NaN, non infinita, entro limiti)
   */
  private static isValidPosition(x: number, y: number): boolean {
    return Number.isFinite(x) && Number.isFinite(y) &&
      x >= this.MIN_POSITION && x <= this.MAX_POSITION &&
      y >= this.MIN_POSITION && y <= this.MAX_POSITION;
  }

  /**
   * Sanitizza una posizione, restituendo valori di fallback se invalidi
   */
  private static sanitizePosition(x: number, y: number, fallbackX: number, fallbackY: number): { x: number; y: number } {
    if (!this.isValidPosition(x, y)) {
      console.warn(`[INTERPOLATION] Invalid position (${x}, ${y}), using fallback (${fallbackX}, ${fallbackY})`);
      return { x: fallbackX, y: fallbackY };
    }
    return { x, y };
  }

  // Flag per identificare se è un NPC
  private isNpc: boolean = false;

  // Timestamp of the last snapshot in the buffer (for deduplication)
  private lastSnapshotTimestamp: number = 0;

  constructor(initialX: number, initialY: number, initialRotation: number, isNpc: boolean = false) {
    this.renderX = initialX;
    this.renderY = initialY;
    this.renderRotation = initialRotation;
    this.isNpc = isNpc;

    // Initialize buffer with a single snapshot at t=0
    // This prevents empty-buffer edge cases on first render
    this.snapshots.push({
      x: initialX,
      y: initialY,
      rotation: initialRotation,
      timestamp: performance.now()
    });
  }

  // ==================================================================
  // PUBLIC API: Called by network handlers (e.g., RemoteNpcSystem)
  // ==================================================================

  /**
   * AGGIORNA TARGET DA RETE - Adds a new snapshot to the buffer.
   * Called when a server packet arrives for remote entities.
   * @param x The new x position from the server.
   * @param y The new y position from the server.
   * @param rotation The new rotation from the server.
   * @param serverTimestamp Optional server timestamp. If not provided, uses local receive time.
   */
  updateTarget(x: number, y: number, rotation: number, serverTimestamp?: number): void {
    const timestamp = serverTimestamp ?? performance.now();

    // Discard out-of-order snapshots
    if (timestamp <= this.lastSnapshotTimestamp) {
      return;
    }

    const sanitizedPos = InterpolationTarget.sanitizePosition(x, y, this.renderX, this.renderY);
    let sanitizedRotation = rotation;
    const rotationValidation = InputValidator.validateNumber(rotation, 'rotation');
    if (!rotationValidation.isValid) {
      sanitizedRotation = this.renderRotation;
    }

    // Teleport detection: If distance is too great, snap immediately.
    // This handles respawns, zone changes, etc.
    if (this.snapshots.length > 0) {
      const lastSnap = this.snapshots[this.snapshots.length - 1];
      const dx = sanitizedPos.x - lastSnap.x;
      const dy = sanitizedPos.y - lastSnap.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > 200 * 200) { // Teleport threshold: 200 pixels
        this.snapTo(sanitizedPos.x, sanitizedPos.y, sanitizedRotation);
        return;
      }
    }

    this.snapshots.push({
      x: sanitizedPos.x,
      y: sanitizedPos.y,
      rotation: sanitizedRotation,
      timestamp: timestamp
    });
    this.lastSnapshotTimestamp = timestamp;

    // Clamp buffer size
    while (this.snapshots.length > NETWORK_CONFIG.MAX_SNAPSHOT_BUFFER_SIZE) {
      this.snapshots.shift();
    }
  }

  /**
   * Alias for updateTarget, for backward compatibility.
   */
  updateTargetFromNetwork(x: number, y: number, rotation: number = this.renderRotation): void {
    this.updateTarget(x, y, rotation);
  }

  /**
   * SNAP TO - Immediately sets the render position without interpolation.
   * Used for respawn, teleport, or initial placement. Clears the snapshot buffer.
   */
  snapTo(x: number, y: number, rotation: number): void {
    const sanitizedPos = InterpolationTarget.sanitizePosition(x, y, this.renderX, this.renderY);

    this.renderX = sanitizedPos.x;
    this.renderY = sanitizedPos.y;
    this.renderRotation = rotation;

    // Clear the buffer and add the new position as the only snapshot
    this.snapshots = [{
      x: sanitizedPos.x,
      y: sanitizedPos.y,
      rotation: rotation,
      timestamp: performance.now()
    }];
    this.lastSnapshotTimestamp = this.snapshots[0].timestamp;
  }

  // ==================================================================
  // RENDER-PHASE INTERPOLATION (called from InterpolationSystem.render)
  // ==================================================================

  /**
   * INTERPOLATE - Calculates render position for a given render time.
   * This is the core of the MMO-grade fix. It finds two snapshots
   * surrounding the renderTime and linearly interpolates between them.
   *
   * @param renderTime The time to interpolate for, typically `performance.now() - INTERPOLATION_DELAY`.
   */
  interpolate(renderTime: number): void {
    const count = this.snapshots.length;

    // Edge case: No snapshots (should not happen after constructor)
    if (count === 0) {
      return; // Don't move
    }

    // Edge case: Only one snapshot, snap to it
    if (count === 1) {
      this.renderX = this.snapshots[0].x;
      this.renderY = this.snapshots[0].y;
      this.renderRotation = this.snapshots[0].rotation;
      return;
    }

    const oldest = this.snapshots[0];
    const newest = this.snapshots[count - 1];

    // Edge case: renderTime is before the oldest snapshot. Clamp to oldest.
    if (renderTime <= oldest.timestamp) {
      this.renderX = oldest.x;
      this.renderY = oldest.y;
      this.renderRotation = oldest.rotation;
      return;
    }

    // Edge case: renderTime is after the newest snapshot. Clamp to newest (NO extrapolation).
    if (renderTime >= newest.timestamp) {
      this.renderX = newest.x;
      this.renderY = newest.y;
      this.renderRotation = newest.rotation;
      return;
    }

    // Normal case: Find the two snapshots surrounding renderTime using binary search.
    let low = 0;
    let high = count - 1;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (this.snapshots[mid].timestamp <= renderTime) {
        low = mid;
      } else {
        high = mid;
      }
    }

    const prev = this.snapshots[low];
    const next = this.snapshots[high];

    // Calculate interpolation factor `t`
    const timeDelta = next.timestamp - prev.timestamp;
    // Avoid division by zero if timestamps are identical (shouldn't happen)
    const t = timeDelta > 0 ? (renderTime - prev.timestamp) / timeDelta : 0;

    // Linear interpolation
    this.renderX = prev.x + (next.x - prev.x) * t;
    this.renderY = prev.y + (next.y - prev.y) * t;

    // Angular interpolation (shortest path)
    this.renderRotation = this.lerpAngle(prev.rotation, next.rotation, t);

    // Validazione finale
    if (!InterpolationTarget.isValidPosition(this.renderX, this.renderY)) {
      console.error(`[INTERPOLATION] Render position became invalid, snapping to newest.`);
      this.renderX = newest.x;
      this.renderY = newest.y;
    }
  }

  // ==================================================================
  // NOTE: updateRender(deltaTime) HAS BEEN REMOVED.
  // Interpolation is now ONLY performed via interpolate(renderTime).
  // DO NOT RE-ADD any tick-based smoothing logic here.
  // ==================================================================


  /**
   * Getters for backward compatibility if any code reads targetX/Y.
   * They now return the most recent snapshot's position.
   */
  get targetX(): number {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1].x : this.renderX;
  }

  get targetY(): number {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1].y : this.renderY;
  }

  get targetRotation(): number {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1].rotation : this.renderRotation;
  }

  // ==========================================
  // UTILITIES ANGOLARI
  // ==========================================
  private lerpAngle(from: number, to: number, t: number): number {
    let diff = to - from;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return this.normalizeAngle(from + diff * t);
  }

  private normalizeAngle(angle: number): number {
    while (angle < 0) angle += 2 * Math.PI;
    while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
    return angle;
  }
}
