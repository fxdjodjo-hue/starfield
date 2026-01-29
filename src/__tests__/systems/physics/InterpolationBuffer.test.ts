import { describe, it, expect, beforeEach, vi } from 'vitest';
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

    beforeEach(() => {
        // Mock performance.now for deterministic tests
        vi.spyOn(performance, 'now').mockReturnValue(1000);
        target = new InterpolationTarget(0, 0, 0);
    });

    it('should initialize with a single snapshot', () => {
        // renderX/Y should be initial values
        expect(target.renderX).toBe(0);
        expect(target.renderY).toBe(0);
    });

    it('should add snapshots via updateTarget', () => {
        vi.spyOn(performance, 'now').mockReturnValue(1100);
        target.updateTarget(10, 20, 0, 1100);

        // targetX/Y getters should return latest snapshot
        expect(target.targetX).toBe(10);
        expect(target.targetY).toBe(20);
    });

    it('should discard out-of-order snapshots', () => {
        vi.spyOn(performance, 'now').mockReturnValue(1100);
        target.updateTarget(10, 20, 0, 1100);

        vi.spyOn(performance, 'now').mockReturnValue(1050); // earlier timestamp
        target.updateTarget(5, 5, 0, 1050);

        // Should still have the snapshot at 1100, not 1050
        expect(target.targetX).toBe(10);
    });

    it('should clamp buffer size', () => {
        for (let i = 1; i <= 10; i++) {
            vi.spyOn(performance, 'now').mockReturnValue(1000 + i * 100);
            target.updateTarget(i, i, 0, 1000 + i * 100);
        }
        // Buffer max is 5, so we should have snapshots from i=6 to i=10
        // targetX should be the last one (i=10)
        expect(target.targetX).toBe(10);
        // We cannot directly inspect snapshot count, but interpolation should work
    });

    describe('interpolate()', () => {
        it('should snap to oldest if renderTime is before it', () => {
            vi.spyOn(performance, 'now').mockReturnValue(1100);
            target.updateTarget(10, 10, 0, 1100);

            // renderTime before all snapshots
            target.interpolate(900);

            // Should snap to the oldest snapshot (which is the initial one at 1000)
            expect(target.renderX).toBe(0);
            expect(target.renderY).toBe(0);
        });

        it('should snap to newest if renderTime is after it', () => {
            vi.spyOn(performance, 'now').mockReturnValue(1100);
            target.updateTarget(10, 10, 0, 1100);

            // renderTime after all snapshots
            target.interpolate(2000);

            // Should clamp to newest (10, 10)
            expect(target.renderX).toBe(10);
            expect(target.renderY).toBe(10);
        });

        it('should interpolate between two snapshots', () => {
            // Create two snapshots at t=1000 and t=1100
            vi.spyOn(performance, 'now').mockReturnValue(1100);
            target.updateTarget(100, 100, 0, 1100);

            // Interpolate at t=1050 (midpoint)
            target.interpolate(1050);

            // Should be halfway between (0,0) at t=1000 and (100,100) at t=1100
            expect(target.renderX).toBe(50);
            expect(target.renderY).toBe(50);
        });

        it('should handle a burst of snapshots gracefully', () => {
            // Simulate a burst: 10 snapshots in rapid succession (tab switch scenario)
            for (let i = 1; i <= 10; i++) {
                vi.spyOn(performance, 'now').mockReturnValue(1000 + i * 10); // 10ms apart
                target.updateTarget(i * 10, i * 10, 0, 1000 + i * 10);
            }

            // Interpolate at a render time in the middle of the burst
            // The buffer is clamped, so we are working with the last 5 snapshots.
            // Snapshots: i=6 to i=10, so timestamps 1060 to 1100, positions (60,60) to (100,100)
            target.interpolate(1080); // Should be between (80,80) at t=1080

            // t=1080 is exactly on a snapshot boundary if it exists.
            // If not, it interpolates. Let's check a value.
            // Snapshots: 1060:60, 1070:70, 1080:80, 1090:90, 1100:100
            // At 1080, expect 80.
            expect(target.renderX).toBe(80);
        });

        it('should handle 500ms gap without acceleration', () => {
            // Use values under the 200px teleport threshold to avoid snapping.
            // t=1000: (0,0) initial
            // t=1500: (100, 100) - distance from (0,0) is 141px < 200px, so no teleport
            vi.spyOn(performance, 'now').mockReturnValue(1500);
            target.updateTarget(100, 100, 0, 1500);

            // Render at t=1250 (middle of the gap)
            target.interpolate(1250);

            // Should be halfway between (0,0) at t=1000 and (100,100) at t=1500
            expect(target.renderX).toBe(50);
            expect(target.renderY).toBe(50);
        });
    });

    describe('Hermite Interpolation', () => {
        it('should follow a curved path with velocity', () => {
            // t=1000: (0,0) v=(100,0) -> Moving right fast
            vi.spyOn(performance, 'now').mockReturnValue(1000);
            target.updateTarget(0, 0, 0, 1000, 100, 0);

            // t=1100: (100,100) v=(0,100) -> Arriving moving up fast
            vi.spyOn(performance, 'now').mockReturnValue(1100);
            target.updateTarget(100, 100, 0, 1100, 0, 100);

            // Interpolate at t=1050 (mid)
            // Linear would be (50, 50).
            // Hermite should overshoot/curve.
            target.interpolate(1050);

            // With v0=(100,0) and v1=(0,100), the curve should bulge out.
            // Exact math check or just "not 50,50"
            expect(target.renderX).not.toBe(50);
            expect(target.renderY).not.toBe(50);
            // Expect x to be > 50 (started moving right fast)
            expect(target.renderX).toBeGreaterThan(50);
        });
    });

    describe('snapTo()', () => {
        it('should immediately set position and clear buffer', () => {
            vi.spyOn(performance, 'now').mockReturnValue(1100);
            target.updateTarget(10, 10, 0, 1100);

            vi.spyOn(performance, 'now').mockReturnValue(1200);
            target.snapTo(999, 999, 1.5);

            expect(target.renderX).toBe(999);
            expect(target.renderY).toBe(999);
            expect(target.renderRotation).toBe(1.5);

            // After snap, interpolating should return the snapped position
            target.interpolate(1500);
            expect(target.renderX).toBe(999);
        });
    });
});
