import { BasePanel } from './FloatingIcon';
import type { PanelConfig } from './PanelConfig';

/**
 * SettingsPanel - Gestisce le configurazioni di gioco
 */
export class SettingsPanel extends BasePanel {
    private activeTab: 'graphics' | 'audio' | 'interface' = 'graphics';

    constructor(config: PanelConfig) {
        super(config);
    }

    protected createPanelContent(): HTMLElement {
        // Initialize default tab if not set (constructor order issue fix)
        if (!this.activeTab) this.activeTab = 'graphics';

        const content = document.createElement('div');
        content.className = 'settings-panel-content';
        content.style.cssText = `
      padding: 24px;
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 20px;
      position: relative;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 25px;
      overflow-y: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    `;

        // Close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        closeButton.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(239, 68, 68, 0.9);
      border: 1px solid rgba(239, 68, 68, 0.5);
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      transition: all 0.2s ease;
    `;
        closeButton.addEventListener('click', () => this.hide());
        content.appendChild(closeButton);

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
      text-align: center;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 8px;
    `;
        const title = document.createElement('h2');
        title.textContent = 'Settings';
        title.style.cssText = `
      margin: 0;
      color: rgba(255, 255, 255, 0.95);
      font-size: 22px;
      font-weight: 700;
    `;
        header.appendChild(title);
        content.appendChild(header);

        // Navigation Tabs
        const nav = document.createElement('div');
        nav.style.cssText = `
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
    `;

        ['graphics', 'audio', 'interface'].forEach(tab => {
            const btn = document.createElement('button');
            btn.textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
            const isActive = this.activeTab === tab;
            btn.style.cssText = `
        flex: 1;
        padding: 10px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        background: ${isActive ? 'rgba(59, 130, 246, 0.6)' : 'rgba(255, 255, 255, 0.05)'};
        color: rgba(255, 255, 255, ${isActive ? '1' : '0.6'});
        border: 1px solid ${isActive ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)'};
        transition: all 0.2s ease;
      `;
            btn.addEventListener('click', () => {
                this.activeTab = tab as any;
                this.refreshContent(container);

                // Update tabs visual state
                Array.from(nav.children).forEach((b: any) => {
                    b.style.background = 'rgba(255, 255, 255, 0.05)';
                    b.style.color = 'rgba(255, 255, 255, 0.6)';
                    b.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                });
                btn.style.background = 'rgba(59, 130, 246, 0.6)';
                btn.style.color = 'rgba(255, 255, 255, 1)';
                btn.style.borderColor = 'rgba(59, 130, 246, 0.4)';
            });
            nav.appendChild(btn);
        });
        content.appendChild(nav);

        // Content container
        const container = document.createElement('div');
        container.style.cssText = `
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;
        this.refreshContent(container);
        content.appendChild(container);

        return content;
    }

    private refreshContent(container: HTMLElement): void {
        container.innerHTML = '';

        if (this.activeTab === 'graphics') {
            this.createToggle(container, 'Show FPS', 'Display frames per second', false, (val) => {
                document.dispatchEvent(new CustomEvent('settings:graphics:show_fps', { detail: val }));
            });
        } else if (this.activeTab === 'audio') {
            this.createSlider(container, 'Master Volume', 100, (val) => {
                document.dispatchEvent(new CustomEvent('settings:volume:master', { detail: val / 100 }));
            });
            this.createSlider(container, 'SFX Volume', 80, (val) => {
                document.dispatchEvent(new CustomEvent('settings:volume:sfx', { detail: val / 100 }));
            });
            this.createSlider(container, 'Music Volume', 60, (val) => {
                document.dispatchEvent(new CustomEvent('settings:volume:music', { detail: val / 100 }));
            });
        } else if (this.activeTab === 'interface') {

            this.createToggle(container, 'Show Chat', 'Toggle multiplayer chat', true, (val) => {
                document.dispatchEvent(new CustomEvent('settings:ui:chat', { detail: val }));
            });
            this.createToggle(container, 'Show Damage Numbers', 'Display floating damage values', true, (val) => {
                document.dispatchEvent(new CustomEvent('settings:ui:damage_numbers', { detail: val }));
            });
        }
    }

    private createToggle(parent: HTMLElement, label: string, desc: string, defaultValue: boolean, onChange: (val: boolean) => void): void {
        const row = document.createElement('div');
        row.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
    `;

        const info = document.createElement('div');
        const title = document.createElement('div');
        title.textContent = label;
        title.style.fontWeight = '600';
        title.style.color = 'white';

        const subtitle = document.createElement('div');
        subtitle.textContent = desc;
        subtitle.style.fontSize = '12px';
        subtitle.style.color = 'rgba(255, 255, 255, 0.6)';

        info.appendChild(title);
        info.appendChild(subtitle);
        row.appendChild(info);

        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.checked = defaultValue;
        toggle.addEventListener('change', (e) => onChange((e.target as HTMLInputElement).checked));

        row.appendChild(toggle);
        parent.appendChild(row);
    }

    private createSlider(parent: HTMLElement, label: string, defaultValue: number, onChange: (val: number) => void): void {
        const row = document.createElement('div');
        row.style.cssText = `
        padding: 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; color: white; font-weight: 600;';
        header.textContent = label;

        const valueDisplay = document.createElement('span');
        valueDisplay.textContent = defaultValue + '%';
        header.appendChild(valueDisplay);
        row.appendChild(header);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.value = defaultValue.toString();
        slider.style.width = '100%';

        slider.addEventListener('input', (e) => {
            const val = (e.target as HTMLInputElement).value;
            valueDisplay.textContent = val + '%';
            onChange(parseInt(val));
        });

        row.appendChild(slider);
        parent.appendChild(row);
    }
}
