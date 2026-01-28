

export class NotificationPopup {
    private container: HTMLElement;
    private isVisible: boolean = false;
    private timeoutId: any = null;

    constructor() {
        this.container = this.createContainer();
        document.body.appendChild(this.container);
    }

    private createContainer(): HTMLElement {
        const el = document.createElement('div');
        el.id = 'system-notification-popup';
        el.style.cssText = `
            position: fixed;
            top: 20%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.9);
            background: rgba(20, 20, 30, 0.9);
            border: 1px solid rgba(255, 50, 50, 0.3);
            box-shadow: 0 0 20px rgba(255, 0, 0, 0.2);
            color: #ffcccc;
            padding: 15px 30px;
            border-radius: 8px;
            font-family: 'Segoe UI', sans-serif;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            opacity: 0;
            pointer-events: none;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            z-index: 10000;
            backdrop-filter: blur(5px);
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        return el;
    }

    public show(message: string, duration: number = 3000): void {
        // Reset state
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }

        // Content
        this.container.innerHTML = `<span>${message}</span>`;

        // Style specific for error/warning (default red-ish)
        // We can add types later if needed (success/info)

        // Show animation
        requestAnimationFrame(() => {
            this.container.style.opacity = '1';
            this.container.style.transform = 'translate(-50%, -50%) scale(1)';
        });

        this.isVisible = true;

        // Auto hide
        this.timeoutId = setTimeout(() => {
            this.hide();
        }, duration);
    }

    public hide(): void {
        this.container.style.opacity = '0';
        this.container.style.transform = 'translate(-50%, -50%) scale(0.9)';
        this.isVisible = false;
    }

    public destroy(): void {
        if (document.body.contains(this.container)) {
            document.body.removeChild(this.container);
        }
    }
}
