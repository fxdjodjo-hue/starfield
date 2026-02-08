export class ConfirmationModal {
    private container: HTMLElement;
    private isVisible: boolean = false;
    private onConfirm: (() => void) | null = null;
    private onCancel: (() => void) | null = null;

    public isModalVisible(): boolean {
        return this.isVisible;
    }

    constructor() {
        this.container = this.createContainer();
        document.body.appendChild(this.container);
    }

    private createContainer(): HTMLElement {
        const el = document.createElement('div');
        el.id = 'system-confirmation-modal';
        el.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
            z-index: 20000;
        `;

        const card = document.createElement('div');
        card.style.cssText = `
            background: rgba(20, 20, 30, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 0 30px rgba(0, 0, 0, 0.8), inset 0 0 20px rgba(255, 255, 255, 0.02);
            padding: 30px;
            border-radius: 12px;
            width: 400px;
            max-width: 90%;
            text-align: center;
            transform: scale(0.9);
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        `;

        // Title
        const title = document.createElement('h3');
        title.id = 'confirmation-title';
        title.style.cssText = `
            margin: 0 0 15px 0;
            color: #ffffff;
            font-family: 'Segoe UI', sans-serif;
            font-size: 20px;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
        `;
        card.appendChild(title);

        // Message
        const message = document.createElement('p');
        message.id = 'confirmation-message';
        message.style.cssText = `
            margin: 0 0 25px 0;
            color: rgba(255, 255, 255, 0.8);
            font-family: 'Segoe UI', sans-serif;
            font-size: 16px;
            line-height: 1.5;
        `;
        card.appendChild(message);

        // Buttons Container
        const buttons = document.createElement('div');
        buttons.style.cssText = `
            display: flex;
            justify-content: center;
            gap: 15px;
        `;

        // Cancel Button
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'CANCEL';
        cancelBtn.style.cssText = `
            padding: 10px 24px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.8);
            cursor: pointer;
            border-radius: 4px;
            font-weight: 600;
            font-family: 'Segoe UI', sans-serif;
            transition: all 0.2s;
        `;
        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
            cancelBtn.style.color = '#ffffff';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.background = 'rgba(255, 255, 255, 0.05)';
            cancelBtn.style.color = 'rgba(255, 255, 255, 0.8)';
        });
        cancelBtn.addEventListener('click', () => this.handleCancel());
        buttons.appendChild(cancelBtn);

        // Confirm Button
        const confirmBtn = document.createElement('button');
        confirmBtn.id = 'confirmation-confirm-btn';
        confirmBtn.textContent = 'CONFIRM';
        confirmBtn.style.cssText = `
            padding: 10px 24px;
            background: rgba(220, 38, 38, 0.2);
            border: 1px solid rgba(220, 38, 38, 0.5);
            color: #ef4444; /* Default red for destructive */
            cursor: pointer;
            border-radius: 4px;
            font-weight: 600;
            font-family: 'Segoe UI', sans-serif;
            transition: all 0.2s;
        `;
        confirmBtn.addEventListener('mouseenter', () => {
            confirmBtn.style.background = 'rgba(220, 38, 38, 0.8)';
            confirmBtn.style.color = '#ffffff';
        });
        confirmBtn.addEventListener('mouseleave', () => {
            confirmBtn.style.background = 'rgba(220, 38, 38, 0.2)';
            confirmBtn.style.color = '#ef4444';
        });
        confirmBtn.addEventListener('click', () => this.handleConfirm());
        buttons.appendChild(confirmBtn);

        card.appendChild(buttons);
        el.appendChild(card);

        return el;
    }

    public show(title: string, message: string, onConfirm: () => void, onCancel?: () => void, isDestructive: boolean = true): void {
        const titleEl = this.container.querySelector('#confirmation-title');
        const msgEl = this.container.querySelector('#confirmation-message');
        const confirmBtn = this.container.querySelector('#confirmation-confirm-btn') as HTMLElement;

        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;

        this.onConfirm = onConfirm;
        this.onCancel = onCancel || null;

        // Styling based on type
        if (isDestructive) {
            confirmBtn.style.borderColor = 'rgba(220, 38, 38, 0.5)';
            confirmBtn.style.color = '#ef4444';
            confirmBtn.style.background = 'rgba(220, 38, 38, 0.2)';
            confirmBtn.onmouseenter = () => {
                confirmBtn.style.background = 'rgba(220, 38, 38, 0.8)';
                confirmBtn.style.color = '#ffffff';
            };
            confirmBtn.onmouseleave = () => {
                confirmBtn.style.background = 'rgba(220, 38, 38, 0.2)';
                confirmBtn.style.color = '#ef4444';
            };
        } else {
            // Standard Style (Blue/Green?)
            confirmBtn.style.borderColor = 'rgba(38, 220, 38, 0.5)';
            confirmBtn.style.color = '#44ef44';
            confirmBtn.style.background = 'rgba(38, 220, 38, 0.2)';
            confirmBtn.onmouseenter = () => {
                confirmBtn.style.background = 'rgba(38, 220, 38, 0.8)';
                confirmBtn.style.color = '#ffffff';
            };
            confirmBtn.onmouseleave = () => {
                confirmBtn.style.background = 'rgba(38, 220, 38, 0.2)';
                confirmBtn.style.color = '#44ef44';
            };
        }

        // Show
        this.container.style.pointerEvents = 'auto'; // Enable interaction
        this.container.style.opacity = '1';

        const card = this.container.firstElementChild as HTMLElement;
        if (card) {
            card.style.transform = 'scale(1)';
        }

        this.isVisible = true;
    }

    public hide(): void {
        this.container.style.pointerEvents = 'none';
        this.container.style.opacity = '0';

        const card = this.container.firstElementChild as HTMLElement;
        if (card) {
            card.style.transform = 'scale(0.9)';
        }

        this.isVisible = false;

        // Cleanup callbacks
        this.onConfirm = null;
        this.onCancel = null;
    }

    private handleConfirm(): void {
        if (this.onConfirm) {
            this.onConfirm();
        }
        this.hide();
    }

    private handleCancel(): void {
        if (this.onCancel) {
            this.onCancel();
        }
        this.hide();
    }

    public destroy(): void {
        if (document.body.contains(this.container)) {
            document.body.removeChild(this.container);
        }
    }
}
