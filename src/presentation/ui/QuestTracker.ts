import { DisplayManager } from '../../infrastructure/display';
import { applyFadeIn } from '../../core/utils/rendering/UIFadeAnimation';
import { NumberFormatter } from '../../core/utils/ui/NumberFormatter';
import type { QuestData } from './QuestPanel';

export class QuestTracker {
    private container: HTMLElement;
    private isVisible: boolean = false;
    private isMinimized: boolean = false;
    private hasBeenExplicitlyShown: boolean = false;
    private dprCompensation: number;
    private lastData: QuestData | null = null;
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
      box-sizing: border-box;
      overflow: hidden;
      z-index: 900;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      pointer-events: none;
      user-select: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

        this.applyMinimizedStyles(container);

        return container;
    }

    private applyMinimizedStyles(container: HTMLElement): void {
        const c = this.dprCompensation;
        if (this.isMinimized) {
            container.style.width = Math.round(44 * c) + 'px';
            container.style.height = Math.round(44 * c) + 'px';
            container.style.padding = '0px';
            container.style.background = 'rgba(0, 0, 0, 0.4)';
            container.style.borderRadius = Math.round(8 * c) + 'px';
        } else {
            container.style.width = Math.round(280 * c) + 'px';
            container.style.padding = Math.round(16 * c) + 'px';
            container.style.background = 'rgba(0, 0, 0, 0.45)';
            container.style.borderRadius = Math.round(12 * c) + 'px';
        }
    }

    private toggleMinimized(): void {
        if (!this.lastData) return;

        const container = this.container;

        // 1. FIRST: Capture current state
        const first = container.getBoundingClientRect();

        // 2. Update state and re-render instantly
        this.isMinimized = !this.isMinimized;
        localStorage.setItem(this.STORAGE_KEY, this.isMinimized.toString());

        // Temporarily disable transition for setup
        container.style.transition = 'none';
        this.update(this.lastData);

        // 3. LAST: Capture target state
        // Force layout to get the target dimensions
        const last = container.getBoundingClientRect();

        // 4. INVERT: Move from Last back to First instantly
        container.style.width = first.width + 'px';
        container.style.height = first.height + 'px';

        // Force reflow
        container.offsetHeight;

        // 5. PLAY: Animate to Last
        // Re-enable transition with premium cubic-bezier
        container.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

        // Dual requestAnimationFrame ensures the browser acknowledges the "inverted" state 
        // as a separate style change before jumping to the "last" state.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                container.style.width = last.width + 'px';
                container.style.height = last.height + 'px';

                // Cleanup after animation completes
                setTimeout(() => {
                    if (!this.isMinimized) {
                        container.style.height = 'auto';
                    }
                }, 310);
            });
        });
    }

    private setupEventListeners(): void {
        document.addEventListener('questDataUpdate', (event: any) => {
            this.update(event.detail);
        });
    }

    public update(data: QuestData): void {
        this.lastData = data;
        const activeQuests = data.activeQuests;

        if (!activeQuests || activeQuests.length === 0) {
            this.hide();
            return;
        }

        this.container.innerHTML = '';
        const c = this.dprCompensation;

        // Header Row
        const headerRow = document.createElement('div');
        headerRow.id = 'quest-tracker-header';
        headerRow.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: ${this.isMinimized ? '0' : Math.round(8 * c) + 'px'};
          pointer-events: auto;
          cursor: pointer;
          transition: margin-bottom 0.2s ease;
        `;
        headerRow.onclick = () => this.toggleMinimized();

        const headerTitle = document.createElement('div');
        headerTitle.id = 'quest-tracker-title';
        headerTitle.textContent = 'ACTIVE MISSION';
        headerTitle.style.cssText = `
          color: rgba(255, 255, 255, 0.6);
          font-size: ${Math.round(10 * c)}px;
          font-weight: 700;
          letter-spacing: 1px;
          transition: opacity 0.2s ease, transform 0.2s ease;
          opacity: ${this.isMinimized ? '0' : '1'};
          white-space: nowrap;
          overflow: hidden;
          width: ${this.isMinimized ? '0px' : 'auto'};
        `;

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'quest-tracker-toggle';

        if (this.isMinimized) {
            const iconSize = Math.round(24 * c);
            toggleBtn.innerHTML = `
                <div style="
                    width: ${iconSize}px;
                    height: ${iconSize}px;
                    background-color: #fff;
                    mask-image: url('assets/svg/gameUi/gps-f-svgrepo-com.svg');
                    -webkit-mask-image: url('assets/svg/gameUi/gps-f-svgrepo-com.svg');
                    mask-size: contain;
                    mask-repeat: no-repeat;
                    mask-position: center;
                    -webkit-mask-size: contain;
                    -webkit-mask-repeat: no-repeat;
                    -webkit-mask-position: center;
                    opacity: 0.8;
                "></div>
            `;
        } else {
            toggleBtn.textContent = '－';
        }

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
          width: ${this.isMinimized ? Math.round(44 * c) + 'px' : Math.round(20 * c) + 'px'};
          height: ${this.isMinimized ? Math.round(44 * c) + 'px' : Math.round(20 * c) + 'px'};
          transition: color 0.2s ease, opacity 0.2s ease;
          transform: none;
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
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow: hidden;
          transition: max-height 0.2s ease-out, opacity 0.2s ease-out, margin-top 0.2s ease-out;
          max-height: ${this.isMinimized ? '0' : '500px'};
          opacity: ${this.isMinimized ? '0' : '1'};
          margin-top: ${this.isMinimized ? '0' : '8px'};
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

                const f = (n: number) => NumberFormatter.format(n);
                const progress = document.createElement('span');
                progress.textContent = `${f(obj.current)}/${f(obj.target)}`;
                progress.style.color = obj.current >= obj.target ? '#4ade80' : 'rgba(255,255,255,0.6)';

                objDiv.appendChild(desc);
                objDiv.appendChild(progress);
                qDiv.appendChild(objDiv);
            });

            contentDiv.appendChild(qDiv);
        });

        this.container.appendChild(contentDiv);
        this.applyMinimizedStyles(this.container);

        if (!this.isVisible && this.hasBeenExplicitlyShown) {
            this.show();
        }
    }

    public show(): void {
        this.hasBeenExplicitlyShown = true;
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
