import { InputValidator } from '../../core/utils/InputValidator';
import { NETWORK_CONFIG } from '../../config/NetworkConfig';

/**
 * Snapshot of entity state at a specific server timestamp.
 * Used for timeline-based interpolation (MMO-grade).
 */
export interface Snapshot {
  x: number;
  y: number;
  rotation: number;
  timestamp: number; // Local monotonic timestamp (performance.now() based)
  serverTime: number; // Absolute Server Time (ms) - derived from tick or raw timestamp
  vx: number;       // Velocity X for Hermite spline
  vy: number;       // Velocity Y for Hermite spline
}

/**
 * InterpolationTarget - MMO-Grade Snapshot Interpolation System (Pro)
 * 
 * Features:
 * - Smoothed Offset (alpha 0.05) vs Hard Reset
 * - Hermite Cubic Spline Interpolation (uses velocity)
 * - Soft Overrun Decay (no freeze on lag)
 * - Jitter & Gap Detection
 */
export class InterpolationTarget {
  // ==========================================
  // POSIZIONE RENDERIZZATA (visibile)
  // ==========================================
  renderX: number;
  renderY: number;
  renderRotation: number;

  // ==========================================
  // SNAPSHOT BUFFER
  // ==========================================
  private snapshots: Snapshot[] = [];
  private readonly MAX_SNAPSHOT_BUFFER_SIZE = NETWORK_CONFIG.MAX_SNAPSHOT_BUFFER_SIZE || 20;

  // ==========================================
  // CONFIGURAZIONE TIMELINE
  // ==========================================
  private readonly TICK_MS = 50; // Server base tick (20Hz)
  private readonly CLAMP_TIMESTAMP_GAP = 1000; // 1 second gap causes hard reset
  // FIX: Reduced alpha from 0.05 to 0.005 to "lock" the offset and ignore minor jitter
  private readonly OFFSET_SMOOTHING_ALPHA = 0.005;
  private readonly MAX_GAP_THRESHOLD = 150; // 3 * 50ms (Linear fallback)

  private tickOffset: number | null = null;
  private lastSnapshotTimestamp: number = 0;

  // Debug Metrics
  private _isExtrapolating: boolean = false;
  private _jitterBufferMs: number = 0;
  private _currentJitter: number = 0;

  constructor(initialX: number, initialY: number, initialRotation: number) {
    this.renderX = initialX;
    this.renderY = initialY;
    this.renderRotation = initialRotation;

    // Snapshot iniziale
    const now = performance.now();
    this.snapshots.push({
      x: initialX,
      y: initialY,
      rotation: initialRotation,
      timestamp: now,
      serverTime: 0,
      vx: 0,
      vy: 0
    });
    this.lastSnapshotTimestamp = now;
  }

  /**
   * UPDATE: Riceve dati dal server.
   * IMPORTANTE: 'serverTime' (ms) deve essere passato esplicitamente.
   * Se il sistema usa tick, il chiamante deve convertire tick * 50ms prima di chiamare.
   */
  updateTarget(
    x: number,
    y: number,
    rotation: number,
    serverTime: number,
    vx: number = 0,
    vy: number = 0
  ): void {
    const now = performance.now();

    // 1. DETERMINE OFFSET
    // ----------------------------------------------------
    const currentOffset = now - serverTime;

    if (this.tickOffset === null) {
      this.tickOffset = currentOffset;
    } else {
      const delta = currentOffset - this.tickOffset;

      // Calcolo Jitter istantaneo per debug
      this._currentJitter = Math.abs(delta);

      if (Math.abs(delta) > this.CLAMP_TIMESTAMP_GAP) {
        // Hard Reset se drift > 1 secondo
        this.tickOffset = currentOffset;
      } else if (Math.abs(delta) > 5) { // Deadzone: ignore jitter < 5ms
        // Smooth drift correction solo se il drift è significativo
        this.tickOffset += delta * this.OFFSET_SMOOTHING_ALPHA;
      }
    }

    // 2. PREPARE DATA
    // ----------------------------------------------------
    const sanitizedPos = InterpolationTarget.sanitizePosition(x, y, this.renderX, this.renderY);
    let sanitizedRotation = rotation;
    if (!InputValidator.validateNumber(rotation, 'rotation').isValid) {
      sanitizedRotation = this.renderRotation;
    }

    // Local Monotonic Time per questo snapshot
    const localTimestamp = serverTime + this.tickOffset;

    // 3. TELEPORT DETECTION (Anti-Teleport)
    // ----------------------------------------------------
    if (this.snapshots.length > 0) {
      const lastSnap = this.snapshots[this.snapshots.length - 1];
      const dx = sanitizedPos.x - lastSnap.x;
      const dy = sanitizedPos.y - lastSnap.y;
      const distSq = dx * dx + dy * dy;
      const timeDiff = Math.abs(localTimestamp - lastSnap.timestamp);

      // Se spostamento > 500px in < 100ms -> Teleport immediato
      if (distSq > 500 * 500 && timeDiff < 100) {
        this.snapTo(sanitizedPos.x, sanitizedPos.y, sanitizedRotation);
        return;
      }
    }

    // 4. ADD SNAPSHOT
    // ----------------------------------------------------
    const newSnapshot: Snapshot = {
      x: sanitizedPos.x,
      y: sanitizedPos.y,
      rotation: sanitizedRotation,
      timestamp: localTimestamp,
      serverTime: serverTime,
      vx: vx,
      vy: vy
    };

    // Insert sorted (handle out-of-order)
    this.insertSnapshot(newSnapshot);

    this.lastSnapshotTimestamp = Math.max(this.lastSnapshotTimestamp, localTimestamp);
  }

  // Helper per inserimento ordinato
  private insertSnapshot(newSnapshot: Snapshot): void {
    // Caso comune: pacchetto più recente
    if (this.snapshots.length === 0 || newSnapshot.timestamp >= this.snapshots[this.snapshots.length - 1].timestamp) {
      this.snapshots.push(newSnapshot);
    } else {
      // Caso raro: pacchetto arrivato in ritardo (out-of-order)
      let insertIndex = this.snapshots.length;
      for (let i = this.snapshots.length - 1; i >= 0; i--) {
        if (this.snapshots[i].timestamp < newSnapshot.timestamp) {
          insertIndex = i + 1;
          break;
        }
        if (i === 0) insertIndex = 0;
      }

      // Evita duplicati esatti di timestamp
      const prev = this.snapshots[insertIndex - 1];
      const next = this.snapshots[insertIndex];
      const isDuplicate = (prev && Math.abs(prev.timestamp - newSnapshot.timestamp) < 0.01) ||
        (next && Math.abs(next.timestamp - newSnapshot.timestamp) < 0.01);

      if (!isDuplicate) {
        this.snapshots.splice(insertIndex, 0, newSnapshot);
      }
    }

    // Trim buffer
    while (this.snapshots.length > this.MAX_SNAPSHOT_BUFFER_SIZE) {
      this.snapshots.shift();
    }
  }

  /**
   * INTERPOLATE: Calcola la posizione attuale basata sul renderTime.
   */
  interpolate(renderTime: number): void {
    const count = this.snapshots.length;
    if (count === 0) return;

    // Reset flags
    this._isExtrapolating = false;

    // 1. BUFFER UNDERRUN (Too far in past) -> Snap to oldest
    const oldest = this.snapshots[0];
    if (renderTime < oldest.timestamp) {
      this.renderX = oldest.x;
      this.renderY = oldest.y;
      this.renderRotation = oldest.rotation;
      return;
    }

    // 2. BUFFER OVERRUN (Future/Lag) -> Soft Extrapolation
    const newest = this.snapshots[count - 1];
    if (renderTime > newest.timestamp) {
      this._isExtrapolating = true;
      const dt = (renderTime - newest.timestamp) / 1000; // Seconds

      // Limita extrapolation time a ~1.25 frame o un cutoff ragionevole (es. 200ms)
      if (dt < 0.2) {
        // Soft Decay: Rallenta invece di continuare all'infinito o freezare
        // vx *= exp(-k * dt) simula attrito
        const decay = Math.exp(-5 * dt);

        const vx = newest.vx * decay;
        const vy = newest.vy * decay;

        this.renderX = newest.x + vx * dt;
        this.renderY = newest.y + vy * dt;
        this.renderRotation = newest.rotation; // Rotation extrapolation is risky, keep static
      } else {
        // Se lagga troppo (>200ms), ferma lì (freeze è meglio di overshoot enorme)
        this.renderX = newest.x;
        this.renderY = newest.y;
        this.renderRotation = newest.rotation;
      }
      return;
    }

    // 3. INTERPOLATION (Normal) -> Find Pair
    let low = 0;
    let high = count - 1;

    // Binary search per trovare l'intervallo [prev, next]
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (this.snapshots[mid].timestamp <= renderTime) low = mid;
      else high = mid;
    }

    const prev = this.snapshots[low];
    const next = this.snapshots[high];

    const timeDelta = next.timestamp - prev.timestamp;

    // Safety check div by zero
    if (timeDelta <= 0.0001) {
      this.renderX = next.x;
      this.renderY = next.y;
      this.renderRotation = next.rotation;
      return;
    }

    // Normalized Time (0..1)
    let t = (renderTime - prev.timestamp) / timeDelta;
    // Clamp robusto
    t = Math.max(0, Math.min(1, t));

    // GAP DETECTION -> Fallback to Linear if gap is huge (packet loss)
    if (timeDelta > this.MAX_GAP_THRESHOLD) {
      // Linear fallback
      this.renderX = prev.x + (next.x - prev.x) * t;
      this.renderY = prev.y + (next.y - prev.y) * t;
      this.renderRotation = this.lerpAngle(prev.rotation, next.rotation, t);
    } else {
      // HERMITE CUBIC SPLINE (MMO-Pro)
      // Richiede vx, vy dai pacchetti
      const dt = timeDelta / 1000;

      const tt = t * t;
      const ttt = tt * t;

      // Basis functions
      const h00 = 2 * ttt - 3 * tt + 1;
      const h10 = ttt - 2 * tt + t;
      const h01 = -2 * ttt + 3 * tt;
      const h11 = ttt - tt;

      const v0x = prev.vx;
      const v0y = prev.vy;
      const v1x = next.vx;
      const v1y = next.vy;

      // x(t)
      this.renderX =
        h00 * prev.x +
        h10 * v0x * dt +
        h01 * next.x +
        h11 * v1x * dt;

      // y(t)
      this.renderY =
        h00 * prev.y +
        h10 * v0y * dt +
        h01 * next.y +
        h11 * v1y * dt;

      // Rotation interpolata linearmente (Slerp 2D)
      this.renderRotation = this.lerpAngle(prev.rotation, next.rotation, t);
    }
  }

  snapTo(x: number, y: number, rotation: number): void {
    const sanitized = InterpolationTarget.sanitizePosition(x, y, this.renderX, this.renderY);
    this.renderX = sanitized.x;
    this.renderY = sanitized.y;
    this.renderRotation = rotation;

    // Reset buffer completamente
    const now = performance.now();
    this.snapshots = [{
      x: sanitized.x,
      y: sanitized.y,
      rotation,
      timestamp: now,
      serverTime: 0, // Reset time state
      vx: 0,
      vy: 0
    }];
    this.lastSnapshotTimestamp = now;
    // Non resettiamo l'offset qui perché snapTo può essere gameplay (teleport skill)
    // Se fosse un reset di rete, l'offset si aggiusterebbe da solo col tempo.
  }

  // ==========================================
  // VIEW METHODS (Debugging)
  // ==========================================
  get bufferSize(): number { return this.snapshots.length; }
  get currentOffset(): number { return this.tickOffset || 0; }
  get jitterMs(): number { return this._currentJitter; }
  get isExtrapolating(): boolean { return this._isExtrapolating; }

  get targetX(): number { return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1].x : this.renderX; }
  get targetY(): number { return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1].y : this.renderY; }
  get targetRotation(): number { return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1].rotation : this.renderRotation; }

  // ==========================================
  // HELPERS
  // ==========================================

  private static isValidPosition(x: number, y: number): boolean {
    return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) < 50000 && Math.abs(y) < 50000;
  }

  private static sanitizePosition(x: number, y: number, fbX: number, fbY: number) {
    return this.isValidPosition(x, y) ? { x, y } : { x: fbX, y: fbY };
  }

  private lerpAngle(from: number, to: number, t: number): number {
    let diff = to - from;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return this.normalizeAngle(from + diff * t);
  }

  private normalizeAngle(angle: number): number {
    angle = angle % (2 * Math.PI);
    return angle < 0 ? angle + 2 * Math.PI : angle;
  }
}
