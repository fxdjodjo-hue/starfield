import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InterpolationTarget } from '../../../entities/spatial/InterpolationTarget';

// Mock NETWORK_CONFIG
vi.mock('../../../config/NetworkConfig', () => ({
    NETWORK_CONFIG: {
        INTERPOLATION_DELAY: 100,
        MAX_SNAPSHOT_BUFFER_SIZE: 5
    }
}));

describe('InterpolationTarget (Snapshot Buffer)', () => {
    let target: InterpolationTarget;
    let dateNowSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // Mock Date.now() for deterministic tests (InterpolationTarget uses Date.now(), not performance.now)
        dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);
        target = new InterpolationTarget(0, 0, 0);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should initialize with a single snapshot', () => {
        // renderX/Y should be initial values
        expect(target.renderX).toBe(0);
        expect(target.renderY).toBe(0);
    });

    it('should add snapshots via updateTarget', () => {
        dateNowSpy.mockReturnValue(1100);
        target.updateTarget(10, 20, 0, 1100);

        // targetX/Y getters should return latest snapshot
        expect(target.targetX).toBe(10);
        expect(target.targetY).toBe(20);
    });

    it('should accept all snapshots (buffer is append-only FIFO)', () => {
        dateNowSpy.mockReturnValue(1100);
        target.updateTarget(10, 20, 0, 1100);

        dateNowSpy.mockReturnValue(1050);
        target.updateTarget(5, 5, 0, 1050);

        // The buffer is append-only FIFO — last pushed snapshot is the target
        expect(target.targetX).toBe(5);
    });

    it('should clamp buffer size', () => {
        for (let i = 1; i <= 10; i++) {
            dateNowSpy.mockReturnValue(1000 + i * 100);
            target.updateTarget(i, i, 0, 1000 + i * 100);
        }
        // Buffer max is 5, so we should have snapshots from i=6 to i=10
        // targetX should be the last one (i=10)
        expect(target.targetX).toBe(10);
    });

    describe('interpolate()', () => {
        it('should snap to oldest if renderTime is before all snapshots', () => {
            dateNowSpy.mockReturnValue(1100);
            target.updateTarget(10, 10, 0, 1100);

            // Set Date.now so that renderServerTime = clientNow + clockOffset - RENDER_DELAY
            // clockOffset after updateTarget(serverTime=1100, clientNow=1100) = 1100-1100 = 0
            // renderServerTime = clientNow + 0 - 100 = clientNow - 100
            // To get renderServerTime < 1000 (oldest), need clientNow < 1100
            // e.g. clientNow = 900 => renderServerTime = 900 - 100 = 800 < 1000 ✓
            dateNowSpy.mockReturnValue(900);
            target.interpolate(0);

            // Should snap to the oldest snapshot (initial one at t=1000: position 0,0)
            expect(target.renderX).toBe(0);
            expect(target.renderY).toBe(0);
        });

        it('should hold last known position with extrapolation when past all snapshots (zero velocity)', () => {
            dateNowSpy.mockReturnValue(1100);
            target.updateTarget(10, 10, 0, 1100);

            // clockOffset = 0, renderServerTime = clientNow - 100
            // To get renderServerTime > 1100 (newest), need clientNow > 1200
            dateNowSpy.mockReturnValue(2100);
            target.interpolate(0);

            // With zero velocity snapshots, extrapolation stays at last position
            expect(target.renderX).toBe(10);
            expect(target.renderY).toBe(10);
        });

        it('should extrapolate using velocity when past all snapshots', () => {
            dateNowSpy.mockReturnValue(1100);
            target.updateTarget(10, 10, 0, 1100, 1000, 0); // vx=1000 px/s

            // clockOffset = 0, renderServerTime = clientNow - 100
            // renderServerTime = 1300 - 100 = 1200, overrun = 1200 - 1100 = 100ms
            // extrapolated x = 10 + 1000 * (100/1000) = 110
            dateNowSpy.mockReturnValue(1300);
            target.interpolate(0);

            expect(target.renderX).toBe(110);
            expect(target.renderY).toBe(10);
        });

        it('should interpolate between two snapshots (zero velocity = linear)', () => {
            // Initial snapshot at t=1000: (0,0), v=(0,0)
            // Second snapshot at t=1100: (100,100), v=(0,0)
            dateNowSpy.mockReturnValue(1100);
            target.updateTarget(100, 100, 0, 1100);

            // clockOffset = 0, renderServerTime = clientNow - 100
            // Want renderServerTime = 1050 => clientNow = 1150
            dateNowSpy.mockReturnValue(1150);
            target.interpolate(0);

            // With zero velocity Hermite degenerates to linear: halfway = (50, 50)
            expect(target.renderX).toBe(50);
            expect(target.renderY).toBe(50);
        });

        it('should handle a burst of snapshots gracefully', () => {
            // Simulate a burst: 10 snapshots in rapid succession (tab switch scenario)
            for (let i = 1; i <= 10; i++) {
                dateNowSpy.mockReturnValue(1000 + i * 10);
                target.updateTarget(i * 10, i * 10, 0, 1000 + i * 10);
            }

            // Buffer clamped to 5: snapshots from i=6..10 → t=1060..1100, pos (60,60)..(100,100)
            // Plus initial snapshot at t=1000 was shifted out.
            // clockOffset stays ~0, renderServerTime = clientNow - 100
            // Want renderServerTime = 1080 => clientNow = 1180
            dateNowSpy.mockReturnValue(1180);
            target.interpolate(0);

            // At t=1080, between snapshot (80,80)@1080 and next.
            // Since 1080 is exactly on a snapshot boundary, t=0, so renderX = 80
            expect(target.renderX).toBe(80);
        });

        it('should handle 500ms gap without acceleration', () => {
            // t=1000: (0,0) initial
            // t=1500: (100, 100) - distance 141px < 500px teleport threshold
            dateNowSpy.mockReturnValue(1500);
            target.updateTarget(100, 100, 0, 1500);

            // clockOffset = 0, renderServerTime = clientNow - 100
            // Want renderServerTime = 1250 => clientNow = 1350
            dateNowSpy.mockReturnValue(1350);
            target.interpolate(0);

            // With zero velocity, Hermite = linear: halfway between (0,0) and (100,100)
            expect(target.renderX).toBe(50);
            expect(target.renderY).toBe(50);
        });
    });

    describe('Hermite Interpolation', () => {
        it('should follow a curved path with velocity', () => {
            // t=1000: (0,0) v=(100,0) -> Moving right fast
            dateNowSpy.mockReturnValue(1000);
            target.updateTarget(0, 0, 0, 1000, 100, 0);

            // t=1100: (100,100) v=(0,100) -> Arriving moving up fast
            dateNowSpy.mockReturnValue(1100);
            target.updateTarget(100, 100, 0, 1100, 0, 100);

            // clockOffset = 0, renderServerTime = clientNow - 100
            // Want renderServerTime = 1050 => clientNow = 1150
            dateNowSpy.mockReturnValue(1150);
            target.interpolate(0);

            // With v0=(100,0) and v1=(0,100), the Hermite curve should bulge:
            // x should be > 50 (started moving right fast), y should be < 50 (arriving moving up)
            expect(target.renderX).not.toBe(50);
            expect(target.renderY).not.toBe(50);
            expect(target.renderX).toBeGreaterThan(50);
        });
    });

    describe('Teleport Detection', () => {
        it('should snap to new position when distance exceeds threshold', () => {
            // Initial at (0,0). Teleport to (1000, 1000) — well above 500px threshold
            dateNowSpy.mockReturnValue(1100);
            target.updateTarget(1000, 1000, 0, 1100);

            // renderX/Y should be snapped immediately (buffer was cleared)
            expect(target.renderX).toBe(1000);
            expect(target.renderY).toBe(1000);
        });

        it('should NOT snap for small position changes', () => {
            // Move from (0,0) to (100,100) — distance 141px < 500px threshold
            dateNowSpy.mockReturnValue(1100);
            target.updateTarget(100, 100, 0, 1100);

            // renderX should NOT be snapped — it stays at old render position until interpolated
            // targetX should be 100 (latest snapshot)
            expect(target.targetX).toBe(100);
        });
    });

    describe('snapTo()', () => {
        it('should immediately set position and clear buffer', () => {
            dateNowSpy.mockReturnValue(1100);
            target.updateTarget(10, 10, 0, 1100);

            dateNowSpy.mockReturnValue(1200);
            target.snapTo(999, 999, 1.5);

            expect(target.renderX).toBe(999);
            expect(target.renderY).toBe(999);
            expect(target.renderRotation).toBe(1.5);

            // After snap, extrapolation with zero velocity holds position
            dateNowSpy.mockReturnValue(2500);
            target.interpolate(0);
            expect(target.renderX).toBe(999);
        });
    });
});
