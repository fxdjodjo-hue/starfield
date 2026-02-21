import { ECS } from '../../../infrastructure/ecs/ECS';
import { LogSystem } from '../../../systems/rendering/LogSystem';
import { Transform } from '../../../entities/spatial/Transform';
import { Health } from '../../../entities/combat/Health';
import { Active } from '../../../entities/tags/Active';
import { DamageText } from '../../../entities/combat/DamageText';

/**
 * PerformanceMonitor - Utility for tracking and logging game performance metrics.
 */
export class PerformanceMonitor {
    private lastLogTime: number = 0;
    private readonly logInterval: number = 1000; // Log every 1 second
    private startTime: number = Date.now();

    private lastSanityCheckTime: number = 0;
    private readonly sanityCheckInterval: number = 30000; // Log sanity check every 30 seconds

    constructor(
        private readonly ecs: ECS,
        private readonly logSystem: LogSystem
    ) {
        console.log('[PerformanceMonitor] Initialized');
        this.printCSVHeader();
        this.initSoakTest();
    }

    private initSoakTest(): void {
        (window as any).runSoakTest = (durationMs: number = 600000, entitiesCount: number = 1000) => {
            console.log(`🚀 Starting Soak Test for ${durationMs / 1000}s with ${entitiesCount} baseline entities...`);

            // Spawn dummy entities
            const testEntities: any[] = [];
            for (let i = 0; i < entitiesCount; i++) {
                const e = this.ecs.createEntity();
                this.ecs.addComponent(e, Transform, new Transform(0, 0, 0));
                this.ecs.addComponent(e, Health, new Health(100, 100));
                this.ecs.addComponent(e, Active, new Active(true));
                testEntities.push(e);
            }

            console.log(`✅ Spawned ${entitiesCount} entities. Starting mutation churn...`);

            // Churn interval
            const interval = setInterval(() => {
                const churnCount = Math.floor(entitiesCount * 0.1); // 10% churn per tick
                for (let i = 0; i < churnCount; i++) {
                    const idx = Math.floor(Math.random() * entitiesCount);
                    const e = testEntities[idx];

                    // Toggle Active state (in-place mutation, no structural churn)
                    const active = this.ecs.getComponent(e, Active);
                    if (active) {
                        active.isEnabled = !active.isEnabled;
                    }

                    // Mutate Health (in-place mutation)
                    const health = this.ecs.getComponent(e, Health);
                    if (health) {
                        health.setHealth(Math.random() * 100);
                    }

                    // Note: We avoid testing structural create/removeEntity loops here 
                    // because the new architecture specifically avoids them in hot paths.
                    // If a structural churn test is explicitly needed, use a separate test.
                }
            }, 100);

            // Cleanup timeout
            setTimeout(() => {
                clearInterval(interval);
                console.log(`🛑 Soak Test Finished. Cleaning up ${testEntities.length} entities...`);
                for (const e of testEntities) {
                    this.ecs.removeEntity(e);
                }
                this.runSanityCheck();
                console.log(`✅ Cleanup complete. Check ECS Sanity Check logs above.`);
            }, durationMs);
        };
        console.log(`🧪 [Soak Test] Available via console: window.runSoakTest(durationMs, entitiesCount)`);
    }

    private printCSVHeader(): void {
        const header = [
            'Timestamp(ms)',
            'EntityCount',
            'QueryInvalidations',
            'QueryRecomputations',
            'CacheSize',
            'InvalidTime(ms)',
            'TopInvalidators',
            'LogHistoryCount',
            'HeapUsed(MB)',
            'HeapTotal(MB)'
        ].join(',');
        console.log(`PERF_METRICS_START\n${header}`);
    }

    public update(): void {
        const now = Date.now();
        if (now - this.lastLogTime < this.logInterval) return;
        this.lastLogTime = now;

        const metrics = this.collectMetrics();
        this.logMetricsCSV(metrics);

        if (now - this.lastSanityCheckTime >= this.sanityCheckInterval) {
            this.lastSanityCheckTime = now;
            this.runSanityCheck();
        }
    }

    private runSanityCheck(): void {
        const stats = this.ecs.queryCache.getCacheStats();
        console.log(`\n--- [ECS Sanity Check] ---`);
        console.log(`Cache Size: ${stats.cacheSize}`);
        console.log(`Query Components Size: ${stats.queryComponentsSize}`);
        console.log(`Reverse Index Total Size: ${stats.reverseIndexTotalSize}`);

        const top5Str = stats.top5ReverseIndex
            .map(s => `${s.key} (${s.size})`)
            .join(' | ');
        console.log(`Top 5 Reverse Index Keys:\n  ${top5Str}`);

        if (stats.reverseIndexTotalSize > (stats.cacheSize + stats.queryComponentsSize) * 3) {
            console.warn(`[ECS WARNING] Reverse Index is growing much larger than Cache! Check for stale keys.`);
        }
        console.log(`--------------------------\n`);
    }

    private collectMetrics(): any {
        const ecsStats = this.ecs.queryCache;
        const memory = (performance as any).memory;

        // Top 5 compo che causano invalidazioni
        const top5 = Array.from(ecsStats.componentInvalidationStats.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => `${name}:${count}`)
            .join('|');

        return {
            timestamp: Date.now() - this.startTime,
            entityCount: (this.ecs as any).entities.size,
            queryInvalidations: ecsStats.totalInvalidations,
            queryRecomputations: ecsStats.totalRecomputations,
            cacheSize: (ecsStats as any).cache.size,
            invalidationTime: Math.round(ecsStats.totalInvalidationTimeMs),
            topComponents: top5 || 'None',
            logHistoryCount: this.logSystem.getHistoryEntries().length,
            heapUsed: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0,
            heapTotal: memory ? Math.round(memory.totalJSHeapSize / 1024 / 1024) : 0
        };
    }

    private logMetricsCSV(metrics: any): void {
        const row = [
            metrics.timestamp,
            metrics.entityCount,
            metrics.queryInvalidations,
            metrics.queryRecomputations,
            metrics.cacheSize,
            metrics.invalidationTime,
            `"${metrics.topComponents}"`,
            metrics.logHistoryCount,
            metrics.heapUsed,
            metrics.heapTotal
        ].join(',');
        console.log(metrics.timestamp > 1000 ? row : ''); // Skip first very noisy log if needed, or just log all
        if (metrics.timestamp <= 1000) console.log(row);
    }
}
