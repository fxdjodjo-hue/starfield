import { ECS } from '../../../infrastructure/ecs/ECS';
import { LogSystem } from '../../../systems/rendering/LogSystem';

/**
 * PerformanceMonitor - Utility for tracking and logging game performance metrics.
 */
export class PerformanceMonitor {
    private lastLogTime: number = 0;
    private readonly logInterval: number = 1000; // Log every 1 second
    private startTime: number = Date.now();

    constructor(
        private readonly ecs: ECS,
        private readonly logSystem: LogSystem
    ) {
        console.log('[PerformanceMonitor] Initialized');
        this.printCSVHeader();
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
