import { NETWORK_CONFIG } from '../../config/NetworkConfig';

/**
 * Snapshot of entity state at a specific server timestamp.
 */
export interface Snapshot {
    x: number;
    y: number;
    rotation: number;
    serverTime: number;
    vx: number;
    vy: number;
}

/**
 * InterpolationTarget - Pure Timeline-Based Interpolation
 * 
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║ KEY CHANGE: REMOVED DOUBLE-SMOOTHING                                      ║
 * ║                                                                           ║
 * ║ Previous version had:                                                     ║
 * ║ 1. Interpolation between snapshots → targetX/Y                           ║
 * ║ 2. Smoothing layer: renderX lerps towards targetX at 12%/frame           ║
 * ║                                                                           ║
 * ║ This caused OSCILLATION when:                                             ║
 * ║ - Deadzone threshold was crossed repeatedly                               ║
 * ║ - Frame rate varied (non-delta-time smoothing)                            ║
 * ║                                                                           ║
 * ║ FIX: renderX/Y = interpolated position DIRECTLY (no extra smoothing)     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */
export class InterpolationTarget {
    // ==========================================
    // RENDERED POSITION (visual output)
    // ==========================================
    renderX: number;
    renderY: number;
    renderRotation: number;

    // ==========================================
    // SNAPSHOT BUFFER
    // ==========================================
    private snapshots: Snapshot[] = [];
    private readonly MAX_BUFFER_SIZE = NETWORK_CONFIG.MAX_SNAPSHOT_BUFFER_SIZE || 10;

    // ==========================================
    // TIMING
    // ==========================================
    private clockOffset: number | null = null;
    private readonly RENDER_DELAY_MS = NETWORK_CONFIG.INTERPOLATION_DELAY || 150;

    // ==========================================
    // DEBUG
    // ==========================================
    private _isExtrapolating: boolean = false;

    constructor(initialX: number, initialY: number, initialRotation: number) {
        this.renderX = initialX;
        this.renderY = initialY;
        this.renderRotation = initialRotation;

        const now = Date.now();
        this.snapshots.push({
            x: initialX,
            y: initialY,
            rotation: initialRotation,
            serverTime: now,
            vx: 0,
            vy: 0
        });
    }

    updateTarget(
        x: number,
        y: number,
        rotation: number,
        serverTime: number,
        vx: number = 0,
        vy: number = 0
    ): void {
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return;
        }

        const clientNow = Date.now();

        // Calculate clock offset with SMOOTHING (exponential moving average)
        // This prevents a single bad packet from permanently skewing timing
        const newOffset = serverTime - clientNow;
        if (this.clockOffset === null) {
            this.clockOffset = newOffset;
        } else {
            const diff = newOffset - this.clockOffset;
            const absDiff = Math.abs(diff);

            // ADAPTIVE SMOOTHING LOGIC
            // Solves "Persistent Extrapolating" issue by converging faster when drift is significant.
            if (absDiff > 300) {
                // Hard Snap: for massive lag spikes or system sleep resume
                this.clockOffset = newOffset;
            } else {
                // Dynamic Alpha:
                // - 0.1 (Fast): When error > 50ms. Re-aligns clock in ~0.5s.
                // - 0.005 (Stable): When error is small. Filters pure jitter.
                const alpha = absDiff > 50 ? 0.1 : 0.005;
                this.clockOffset = this.clockOffset + diff * alpha;
            }
        }

        // TELEPORT DETECTION: If position jumped far (portal, respawn), snap instead of interpolating
        const TELEPORT_THRESHOLD_SQ = 500 * 500; // 500px
        if (this.snapshots.length > 0) {
            const last = this.snapshots[this.snapshots.length - 1];
            const dx = x - last.x;
            const dy = y - last.y;
            if (dx * dx + dy * dy > TELEPORT_THRESHOLD_SQ) {
                // Clear all old snapshots and start fresh from this position
                this.snapshots = [];
                this.renderX = x;
                this.renderY = y;
                this.renderRotation = rotation;
            }
        }

        // Add snapshot to buffer
        this.snapshots.push({ x, y, rotation, serverTime, vx, vy });

        // Keep buffer from growing too large (FIFO)
        while (this.snapshots.length > this.MAX_BUFFER_SIZE) {
            this.snapshots.shift();
        }
    }

    /**
     * Called every render frame to update renderX, renderY, renderRotation.
     * Uses PURE interpolation - no additional smoothing layer.
     */
    interpolate(_renderTime: number): void {
        if (this.snapshots.length === 0 || this.clockOffset === null) {
            return;
        }

        const clientNow = Date.now();
        const renderServerTime = clientNow + this.clockOffset - this.RENDER_DELAY_MS;

        // Prune old snapshots (keep at least 2)
        while (this.snapshots.length > 2 && this.snapshots[1].serverTime < renderServerTime) {
            this.snapshots.shift();
        }

        // Find interpolation pair
        let prev: Snapshot | null = null;
        let next: Snapshot | null = null;

        for (let i = 0; i < this.snapshots.length; i++) {
            if (this.snapshots[i].serverTime > renderServerTime) {
                next = this.snapshots[i];
                prev = i > 0 ? this.snapshots[i - 1] : null;
                break;
            }
        }

        // Calculate and apply position DIRECTLY (no extra smoothing)
        if (!next) {
            // Buffer underrun - extrapolate using last known velocity
            this._isExtrapolating = true;
            const last = this.snapshots[this.snapshots.length - 1];
            const overrunMs = renderServerTime - last.serverTime;
            const MAX_EXTRAPOLATION_MS = 150; // Cap to avoid runaway drift
            const clampedMs = Math.min(Math.max(overrunMs, 0), MAX_EXTRAPOLATION_MS);
            this.renderX = last.x + last.vx * (clampedMs / 1000);
            this.renderY = last.y + last.vy * (clampedMs / 1000);
            this.renderRotation = last.rotation;
        } else if (!prev) {
            // Too far in past - snap to oldest
            this._isExtrapolating = false;
            this.renderX = next.x;
            this.renderY = next.y;
            this.renderRotation = next.rotation;
        } else {
            // NORMAL INTERPOLATION - Hermite cubic spline using velocity
            this._isExtrapolating = false;
            const totalTime = next.serverTime - prev.serverTime;
            const elapsedTime = renderServerTime - prev.serverTime;
            let t = totalTime > 0 ? elapsedTime / totalTime : 0;
            t = Math.max(0, Math.min(1, t));

            // Hermite interpolation: velocity tangents scaled to the interval duration (seconds)
            const dtSec = totalTime / 1000;
            this.renderX = this.hermite(prev.x, prev.vx * dtSec, next.x, next.vx * dtSec, t);
            this.renderY = this.hermite(prev.y, prev.vy * dtSec, next.y, next.vy * dtSec, t);
            this.renderRotation = this.lerpAngle(prev.rotation, next.rotation, t);
        }
    }

    /**
     * Force-set the position (for respawn, teleport, etc.)
     */
    snapTo(x: number, y: number, rotation: number): void {
        this.renderX = x;
        this.renderY = y;
        this.renderRotation = rotation;

        const now = Date.now();
        const serverTime = this.clockOffset !== null ? now + this.clockOffset : now;

        this.snapshots = [{ x, y, rotation, serverTime, vx: 0, vy: 0 }];
    }

    // ==========================================
    // DEBUG GETTERS
    // ==========================================
    get bufferSize(): number { return this.snapshots.length; }
    get currentOffset(): number { return this.clockOffset || 0; }
    get jitterMs(): number { return 0; }
    get isExtrapolating(): boolean { return this._isExtrapolating; }

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
    // HELPERS
    // ==========================================

    /**
     * Cubic Hermite spline: smooth interpolation that respects velocity at both endpoints.
     * h(t) = (2t³ - 3t² + 1)p0 + (t³ - 2t² + t)m0 + (-2t³ + 3t²)p1 + (t³ - t²)m1
     * @param p0 Start position
     * @param m0 Start tangent (velocity * dt)
     * @param p1 End position
     * @param m1 End tangent (velocity * dt)
     * @param t  Interpolation factor [0, 1]
     */
    private hermite(p0: number, m0: number, p1: number, m1: number, t: number): number {
        const t2 = t * t;
        const t3 = t2 * t;
        return (2 * t3 - 3 * t2 + 1) * p0
            + (t3 - 2 * t2 + t) * m0
            + (-2 * t3 + 3 * t2) * p1
            + (t3 - t2) * m1;
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
