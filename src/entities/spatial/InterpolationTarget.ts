import { NETWORK_CONFIG } from '../../config/NetworkConfig';

/**
 * Snapshot of entity state at a specific server timestamp.
 */
export interface Snapshot {
    x: number;
    y: number;
    rotation: number;
    serverTime: number;
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
            serverTime: now
        });
    }

    updateTarget(
        x: number,
        y: number,
        rotation: number,
        serverTime: number,
        _vx: number = 0,
        _vy: number = 0
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

        // Add snapshot to buffer
        this.snapshots.push({ x, y, rotation, serverTime });

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
            // Buffer underrun - hold last known position
            this._isExtrapolating = true;
            const last = this.snapshots[this.snapshots.length - 1];
            this.renderX = last.x;
            this.renderY = last.y;
            this.renderRotation = last.rotation;
        } else if (!prev) {
            // Too far in past - snap to oldest
            this._isExtrapolating = false;
            this.renderX = next.x;
            this.renderY = next.y;
            this.renderRotation = next.rotation;
        } else {
            // NORMAL INTERPOLATION - This is the core logic
            this._isExtrapolating = false;
            const totalTime = next.serverTime - prev.serverTime;
            const elapsedTime = renderServerTime - prev.serverTime;
            let t = totalTime > 0 ? elapsedTime / totalTime : 0;
            t = Math.max(0, Math.min(1, t));

            // Apply interpolated position DIRECTLY to renderX/Y
            this.renderX = prev.x + (next.x - prev.x) * t;
            this.renderY = prev.y + (next.y - prev.y) * t;
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

        this.snapshots = [{ x, y, rotation, serverTime }];
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
