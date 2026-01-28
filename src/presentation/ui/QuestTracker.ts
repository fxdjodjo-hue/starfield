import { DisplayManager } from '../../infrastructure/display';
import { applyFadeIn } from '../../core/utils/rendering/UIFadeAnimation';
import type { QuestData } from './QuestPanel';

export class QuestTracker {
    private container: HTMLElement;
    private isVisible: boolean = false;
    private dprCompensation: number;

    constructor() {
        const dpr = DisplayManager.getInstance().getDevicePixelRatio();
        this.dprCompensation = 1 / dpr;
        this.container = this.createTrackerContainer();
        this.setupEventListeners();
    }

    private createTrackerContainer(): HTMLElement {
        const container = document.createElement('div');
        container.id = 'quest-tracker';

        const c = this.dprCompensation;
        const top = Math.round(20 * c);
        const right = Math.round(20 * c);
        const padding = Math.round(16 * c);
        const borderRadius = Math.round(12 * c);
        const width = Math.round(280 * c);

        container.style.cssText = `
      position: fixed;
      top: ${top}px;
      right: ${right}px;
      width: ${width}px;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: ${borderRadius}px;
      padding: ${padding}px;
      display: none;
      flex-direction: column;
      gap: 8px;
      z-index: 900; /* Below PlayerHUD but above game world */
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      pointer-events: none; /* Let clicks pass through */
      user-select: none;
    `;

        return container;
    }

    private setupEventListeners(): void {
        document.addEventListener('questDataUpdate', (event: any) => {
            this.update(event.detail);
        });
    }

    public update(data: QuestData): void {
        // Show only active quests
        const activeQuests = data.activeQuests;

        if (!activeQuests || activeQuests.length === 0) {
            this.hide();
            return;
        }

        // Just show the first active quest for now, or list them? 
        // User asked "mostrare la quest attiva", singular/plural ambiguous but usually tracking one focus quest is best.
        // Let's show all active for now as a list, it's safer.

        this.container.innerHTML = '';
        const c = this.dprCompensation;

        // Header
        const header = document.createElement('div');
        header.textContent = 'ACTIVE MISSION';
        header.style.cssText = `
      color: rgba(255, 255, 255, 0.6);
      font-size: ${Math.round(10 * c)}px;
      font-weight: 700;
      letter-spacing: 1px;
      margin-bottom: 4px;
    `;
        this.container.appendChild(header);

        activeQuests.forEach(quest => {
            const qDiv = document.createElement('div');
            qDiv.style.marginBottom = `${Math.round(12 * c)}px`;

            const title = document.createElement('div');
            title.textContent = quest.title;
            title.style.cssText = `
        color: #fff;
        font-size: ${Math.round(14 * c)}px;
        font-weight: 600;
        margin-bottom: 4px;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      `;
            qDiv.appendChild(title);

            quest.objectives.forEach(obj => {
                const objDiv = document.createElement('div');
                objDiv.style.cssText = `
           display: flex;
           justify-content: space-between;
           color: rgba(255, 255, 255, 0.85);
           font-size: ${Math.round(12 * c)}px;
           margin-top: 2px;
         `;

                const desc = document.createElement('span');
                desc.textContent = obj.description; // Short description?

                const progress = document.createElement('span');
                progress.textContent = `${obj.current}/${obj.target}`;
                progress.style.color = obj.current >= obj.target ? '#4ade80' : 'rgba(255,255,255,0.6)';

                objDiv.appendChild(desc);
                objDiv.appendChild(progress);
                qDiv.appendChild(objDiv);
            });

            this.container.appendChild(qDiv);
        });

        if (!this.isVisible) {
            this.show();
        }
    }

    public show(): void {
        if (!document.body.contains(this.container)) {
            document.body.appendChild(this.container);
        }
        this.container.style.display = 'flex';
        this.isVisible = true;
        applyFadeIn(this.container);
    }

    public hide(): void {
        this.container.style.display = 'none';
        this.isVisible = false;
    }

    public destroy(): void {
        if (document.body.contains(this.container)) {
            document.body.removeChild(this.container);
        }
    }
}
