export class FpsCounter {
    private container: HTMLElement;
    private fps: number = 0;
    private frameCount: number = 0;
    private timeAccumulator: number = 0;
    private lastUpdate: number = 0;
    private visible: boolean = false;

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
      top: 10px;
      right: 180px; /* Positioned to the left of the minimap */
      background: rgba(0, 0, 0, 0.5);
      color: #00ff00;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-weight: bold;
      font-size: 14px;
      pointer-events: none;
      z-index: 1000;
      border: 1px solid rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(2px);
      text-shadow: 1px 1px 0 #000;
    `;
        this.container.textContent = 'FPS: --';
    }

    public update(deltaTime: number): void {
        if (!this.visible) return;

        this.frameCount++;
        this.timeAccumulator += deltaTime;

        // Update FPS display every 0.5 seconds
        if (this.timeAccumulator >= 500) {
            this.fps = Math.round((this.frameCount * 1000) / this.timeAccumulator);
            this.updateDisplay();
            this.frameCount = 0;
            this.timeAccumulator = 0;
        }
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
        this.visible = true;
        this.container.style.display = 'block';
        this.frameCount = 0;
        this.timeAccumulator = 0;
    }

    public hide(): void {
        this.visible = false;
        this.container.style.display = 'none';
    }

    public setVisibility(visible: boolean): void {
        if (visible) {
            this.show();
        } else {
            this.hide();
        }
    }

    public destroy(): void {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
