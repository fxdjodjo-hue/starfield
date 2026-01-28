export class FpsCounter {
    private container: HTMLElement;
    private fps: number = 0;
    private frameCount: number = 0;
    private timeAccumulator: number = 0;
    private lastTime: number = 0;
    private visible: boolean = false;
    private animationFrameId: number | null = null;

    constructor() {
        this.container = document.createElement('div');
        this.setupElement();
        document.body.appendChild(this.container);
        this.hide(); // Hidden by default
    }

    private setupElement(): void {
        this.container.id = 'fps-counter';
        this.container.style.cssText = `
      position: absolute;
      top: 5px;
      left: 5px;
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-weight: bold;
      font-size: 13px;
      pointer-events: none;
      z-index: 1000;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9);
    `;
        this.container.textContent = 'FPS: --';
    }

    // Self-driven loop to measure actual RENDER FPS (not logic UPS)
    private loop = (timestamp: number): void => {
        if (!this.lastTime) this.lastTime = timestamp;
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.frameCount++;
        this.timeAccumulator += deltaTime;

        // Update FPS display every 0.5 seconds
        if (this.timeAccumulator >= 500) {
            // Calculate FPS
            this.fps = Math.round((this.frameCount * 1000) / this.timeAccumulator);
            this.updateDisplay();
            this.frameCount = 0;
            this.timeAccumulator = 0;
        }

        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    private updateDisplay(): void {
        this.container.textContent = `FPS: ${this.fps}`;

        // Color coding
        if (this.fps >= 50) {
            this.container.style.color = '#00ff00'; // Green
        } else if (this.fps >= 30) {
            this.container.style.color = '#ffff00'; // Yellow
        } else {
            this.container.style.color = '#ff0000'; // Red
        }
    }

    public show(): void {
        if (this.visible) return;
        this.visible = true;
        this.container.style.display = 'block';
        this.frameCount = 0;
        this.timeAccumulator = 0;
        this.lastTime = 0;
        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    public hide(): void {
        this.visible = false;
        this.container.style.display = 'none';
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
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
        this.hide(); // Stop loop
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
