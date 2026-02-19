import { ClientNetworkSystem } from '../../multiplayer/client/ClientNetworkSystem';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';

export class NetworkStatsDisplay {
    private container: HTMLElement;
    private networkSystem: ClientNetworkSystem | null = null;
    private visible: boolean = false;
    private updateIntervalId: number | null = null;

    constructor() {
        this.container = document.createElement('div');
        this.setupElement();
        document.body.appendChild(this.container);
        this.hide(); // Hidden by default
    }

    private setupElement(): void {
        this.container.id = 'network-stats-display';
        this.container.style.cssText = `
      position: absolute;
      top: 45px; /* Below FPS counter */
      right: 180px; /* Positioned to the left of the minimap */
      background: rgba(0, 0, 0, 0.45);
      color: #00d4ff; /* Cyan color for network */
      padding: 4px 10px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-weight: bold;
      font-size: 11px; /* Slightly smaller than FPS */
      pointer-events: none;
      z-index: 1000;
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(10px) saturate(160%);
      -webkit-backdrop-filter: blur(10px) saturate(160%);
      box-shadow: 
        0 4px 12px rgba(0, 0, 0, 0.3),
        inset 0 1px 1px rgba(255, 255, 255, 0.05);
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
      white-space: pre; /* Keep formatting */
    `;
        this.container.innerHTML = 'NET IN:  0.0 KB/s<br>NET OUT: 0.0 KB/s';
    }

    public setNetworkSystem(networkSystem: ClientNetworkSystem): void {
        this.networkSystem = networkSystem;
    }

    private updateDisplay(): void {
        if (!this.networkSystem) return;

        const stats = this.networkSystem.getNetworkStats();
        const inStr = stats.kbpsIn.toFixed(1).padStart(4, ' ');
        const outStr = stats.kbpsOut.toFixed(1).padStart(4, ' ');

        let interpStats = '<br>-- NO REMOTE ENTITIES --';

        const ecs = this.networkSystem.getECS();
        if (ecs) {
            // Find a sample interpolation target (first one found)
            const entities = ecs.getEntitiesWithComponents(InterpolationTarget);
            if (entities.length > 0) {
                const target = ecs.getComponent(entities[0], InterpolationTarget);
                if (target) {
                    const buf = target.bufferSize;
                    const off = Math.round(target.currentOffset);
                    const jit = Math.round(target.jitterMs);
                    const mode = target.isExtrapolating ? '<span style="color:#ffaa00">EXTRAP</span>' : '<span style="color:#00ff00">INTERP</span>';

                    interpStats = `<br>BUF: ${buf} | OFF: ${off}ms<br>JIT: ${jit}ms | ${mode}`;
                }
            }
        }

        this.container.innerHTML = `NET IN:  ${inStr} KB/s<br>NET OUT: ${outStr} KB/s${interpStats}`;
    }

    public show(): void {
        if (this.visible) return;
        this.visible = true;
        this.container.style.display = 'block';
        this.updateDisplay();
        this.updateIntervalId = window.setInterval(() => this.updateDisplay(), 500);
    }

    public hide(): void {
        this.visible = false;
        this.container.style.display = 'none';
        if (this.updateIntervalId !== null) {
            clearInterval(this.updateIntervalId);
            this.updateIntervalId = null;
        }
    }

    public setVisibility(visible: boolean): void {
        if (visible) {
            this.show();
        } else {
            this.hide();
        }
    }

    public destroy(): void {
        this.hide();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
