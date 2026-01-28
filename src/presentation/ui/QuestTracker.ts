import { DisplayManager } from '../../infrastructure/display';
import { applyFadeIn } from '../../core/utils/rendering/UIFadeAnimation';
import type { QuestData } from './QuestPanel';

export class QuestTracker {
    private container: HTMLElement;
    private isVisible: boolean = false;
    private isMinimized: boolean = false;
    private dprCompensation: number;
    private readonly STORAGE_KEY = 'starspace_quest_tracker_minimized';

    constructor() {
        this.isMinimized = localStorage.getItem(this.STORAGE_KEY) === 'true';
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
      pointer-events: none; /* Let clicks pass through by default */
      user-select: none;
      transition: background 0.3s ease;
    `;

        return container;
    }

    private toggleMinimized(): void {
        this.isMinimized = !this.isMinimized;
        localStorage.setItem(this.STORAGE_KEY, this.isMinimized.toString());

        // We don't need a full re-render, but for simplicity since update() 
        // is called frequently, let's just trigger a visual refresh or wait for next update.
        // Actually, let's just update the visibility of the content div if it exists.
        const content = this.container.querySelector('#quest-tracker-content') as HTMLElement;
        const toggleBtn = this.container.querySelector('#quest-tracker-toggle') as HTMLElement;

        if (content) {
            content.style.display = this.isMinimized ? 'none' : 'flex';
        }

        if (toggleBtn) {
            toggleBtn.textContent = this.isMinimized ? '＋' : '－';
        }

        // Adjust container background when minimized
        this.container.style.background = this.isMinimized ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.45)';
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

        // Header Row
        const headerRow = document.createElement('div');
        headerRow.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: ${this.isMinimized ? '0' : Math.round(8 * c) + 'px'};
          pointer-events: auto; /* Enable interaction for this row */
          cursor: pointer;
        `;
        headerRow.onclick = () => this.toggleMinimized();

        const headerTitle = document.createElement('div');
        headerTitle.textContent = 'ACTIVE MISSION';
        headerTitle.style.cssText = `
          color: rgba(255, 255, 255, 0.6);
          font-size: ${Math.round(10 * c)}px;
          font-weight: 700;
          letter-spacing: 1px;
        `;

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'quest-tracker-toggle';
        toggleBtn.textContent = this.isMinimized ? '＋' : '－';
        toggleBtn.style.cssText = `
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          font-size: ${Math.round(14 * c)}px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          margin: 0;
          width: ${Math.round(20 * c)}px;
          height: ${Math.round(20 * c)}px;
          transition: color 0.2s ease;
        `;
        toggleBtn.onmouseenter = () => toggleBtn.style.color = '#fff';
        toggleBtn.onmouseleave = () => toggleBtn.style.color = 'rgba(255, 255, 255, 0.6)';

        headerRow.appendChild(headerTitle);
        headerRow.appendChild(toggleBtn);
        this.container.appendChild(headerRow);

        // Content Container
        const contentDiv = document.createElement('div');
        contentDiv.id = 'quest-tracker-content';
        contentDiv.style.cssText = `
          display: ${this.isMinimized ? 'none' : 'flex'};
          flex-direction: column;
          gap: 8px;
        `;

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
                desc.textContent = obj.description;

                const progress = document.createElement('span');
                progress.textContent = `${obj.current}/${obj.target}`;
                progress.style.color = obj.current >= obj.target ? '#4ade80' : 'rgba(255,255,255,0.6)';

                objDiv.appendChild(desc);
                objDiv.appendChild(progress);
                qDiv.appendChild(objDiv);
            });

            contentDiv.appendChild(qDiv);
        });

        this.container.appendChild(contentDiv);

        // Adjust background instantly
        this.container.style.background = this.isMinimized ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.45)';

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
