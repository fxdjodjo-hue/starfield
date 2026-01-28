import { BasePanel } from './FloatingIcon';
import type { PanelConfig } from './PanelConfig';
import { GameSettings } from '../../core/settings/GameSettings';

/**
 * SettingsPanel - Gestisce le configurazioni di gioco
 */
export class SettingsPanel extends BasePanel {
    private activeTab: 'graphics' | 'audio' | 'interface' | 'controls' = 'graphics';

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
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(20px) saturate(160%);
      -webkit-backdrop-filter: blur(20px) saturate(160%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 25px;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.05);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

        // Inject styles for sliders and glassmorphism components
        const style = document.createElement('style');
        style.textContent = `
      .settings-slider {
        -webkit-appearance: none;
        width: 100%;
        height: 6px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        outline: none;
        transition: opacity .2s;
      }
      .settings-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.9);
        cursor: pointer;
        box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
        border: 2px solid rgba(255, 255, 255, 0.5);
      }
      .settings-slider::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.9);
        cursor: pointer;
        box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
        border: 2px solid rgba(255, 255, 255, 0.5);
      }
      .settings-tab-active {
        background: rgba(255, 255, 255, 0.2) !important;
        color: white !important;
        border-color: rgba(255, 255, 255, 0.3) !important;
        box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
      }
      /* Custom Scrollbar */
      .settings-panel-content::-webkit-scrollbar,
      #settings-container-inner::-webkit-scrollbar {
        width: 6px;
      }
      .settings-panel-content::-webkit-scrollbar-track,
      #settings-container-inner::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
      }
      .settings-panel-content::-webkit-scrollbar-thumb,
      #settings-container-inner::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
      }
      .settings-panel-content::-webkit-scrollbar-thumb:hover,
      #settings-container-inner::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    `;
        content.appendChild(style);

        // Header Section (Title + Subtitle + Close)
        const headerSection = document.createElement('div');
        headerSection.style.cssText = `
           display: flex;
           justify-content: space-between;
           align-items: flex-start;
           margin-bottom: 8px;
        `;

        const titleGroup = document.createElement('div');
        const title = document.createElement('h2');
        title.textContent = 'SETTINGS';
        title.style.cssText = `
           margin: 0;
           color: #ffffff;
           font-size: 24px;
           font-weight: 800;
           letter-spacing: 3px;
           text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        `;

        const subtitle = document.createElement('p');
        subtitle.textContent = 'GAME CONFIGURATION';
        subtitle.style.cssText = `
            margin: 4px 0 0 0;
            color: rgba(255, 255, 255, 0.6);
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 1px;
            text-transform: uppercase;
        `;

        titleGroup.appendChild(title);
        titleGroup.appendChild(subtitle);

        // Unified Close Button
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.cssText = `
            background: rgba(255, 255, 255, 0.05);
            border: none;
            color: rgba(255, 255, 255, 0.6);
            font-size: 24px;
            line-height: 1;
            cursor: pointer;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        `;
        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.background = 'rgba(239, 68, 68, 0.2)';
            closeButton.style.color = '#ef4444';
        });
        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.background = 'rgba(255, 255, 255, 0.05)';
            closeButton.style.color = 'rgba(255, 255, 255, 0.6)';
        });
        closeButton.addEventListener('click', () => this.hide());

        headerSection.appendChild(titleGroup);
        headerSection.appendChild(closeButton);
        content.appendChild(headerSection);

        // Navigation Tabs
        const nav = document.createElement('div');
        nav.style.cssText = `
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
    `;

        ['graphics', 'audio', 'interface', 'controls'].forEach(tab => {
            const btn = document.createElement('button');
            btn.textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
            const isActive = this.activeTab === tab;
            btn.style.cssText = `
                flex: 1;
                padding: 10px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                background: ${isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
                color: rgba(255, 255, 255, ${isActive ? '1' : '0.6'});
                border: 1px solid ${isActive ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
                transition: all 0.2s ease;
                ${isActive ? 'box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);' : ''}
            `;
            btn.addEventListener('click', () => {
                this.activeTab = tab as any;
                this.refreshContent(container);

                // Update tabs visual state
                Array.from(nav.children).forEach((b: any) => {
                    b.style.background = 'rgba(255, 255, 255, 0.05)';
                    b.style.color = 'rgba(255, 255, 255, 0.6)';
                    b.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    b.style.boxShadow = 'none';
                });
                btn.style.background = 'rgba(255, 255, 255, 0.2)';
                btn.style.color = 'rgba(255, 255, 255, 1)';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                btn.style.boxShadow = '0 0 15px rgba(255, 255, 255, 0.1)';
            });
            nav.appendChild(btn);
        });
        content.appendChild(nav);

        // Content container
        const container = document.createElement('div');
        container.id = 'settings-container-inner';
        container.style.cssText = `
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 16px;
            padding-bottom: 30px;
            `;
        this.refreshContent(container);
        content.appendChild(container);

        return content;
    }

    private refreshContent(container: HTMLElement): void {
        container.innerHTML = '';
        const settings = GameSettings.getInstance();

        if (this.activeTab === 'graphics') {
            this.createToggle(container, 'Show FPS', 'Display frames per second', settings.graphics.showFps, (val) => {
                settings.setShowFps(val);
                document.dispatchEvent(new CustomEvent('settings:graphics:show_fps', { detail: val }));
            });
        } else if (this.activeTab === 'audio') {
            this.createSlider(container, 'Master Volume', settings.audio.master, (val) => {
                settings.setAudioVolume('master', val);
                document.dispatchEvent(new CustomEvent('settings:volume:master', { detail: val / 100 }));
            });
            this.createSlider(container, 'SFX Volume', settings.audio.sfx, (val) => {
                settings.setAudioVolume('sfx', val);
                document.dispatchEvent(new CustomEvent('settings:volume:sfx', { detail: val / 100 }));
            });
            this.createSlider(container, 'Music Volume', settings.audio.music, (val) => {
                settings.setAudioVolume('music', val);
                document.dispatchEvent(new CustomEvent('settings:volume:music', { detail: val / 100 }));
            });
        } else if (this.activeTab === 'interface') {
            this.createToggle(container, 'Show Chat', 'Toggle multiplayer chat', settings.interface.showChat, (val) => {
                settings.setShowChat(val);
                document.dispatchEvent(new CustomEvent('settings:ui:chat', { detail: val }));
            });
            this.createToggle(container, 'Show Damage Numbers', 'Display floating damage values', settings.interface.showDamageNumbers, (val) => {
                settings.setShowDamageNumbers(val);
                document.dispatchEvent(new CustomEvent('settings:ui:damage_numbers', { detail: val }));
            });
        } else if (this.activeTab === 'controls') {
            this.createControlsContent(container);
        }
    }

    private createControlsContent(container: HTMLElement): void {
        const section = (title: string) => {
            const t = document.createElement('div');
            t.textContent = title;
            t.style.cssText = 'color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 700; text-transform: uppercase; margin-top: 8px; margin-bottom: 4px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 4px;';
            container.appendChild(t);
        };

        const row = (key: string, action: string, tooltip?: string) => {
            const r = document.createElement('div');
            r.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; margin-bottom: 4px; transition: background 0.2s;';

            if (tooltip) {
                r.title = tooltip;
                r.style.cursor = 'help';
                r.addEventListener('mouseenter', () => {
                    r.style.background = 'rgba(255, 255, 255, 0.1)';
                });
                r.addEventListener('mouseleave', () => {
                    r.style.background = 'rgba(255, 255, 255, 0.05)';
                });
            }

            const k = document.createElement('span');
            k.textContent = key;
            k.style.cssText = 'color: #fff; background: rgba(255, 255, 255, 0.1); padding: 4px 8px; border-radius: 4px; font-family: monospace; font-weight: 700; border: 1px solid rgba(255, 255, 255, 0.2);';

            const a = document.createElement('span');
            a.textContent = action;
            a.style.cssText = 'color: rgba(255, 255, 255, 0.8); font-size: 14px;';

            if (tooltip) {
                const hint = document.createElement('span');
                hint.textContent = ' ⓘ';
                hint.style.cssText = 'color: #00ff88; font-size: 10px; opacity: 0.6; margin-left: 4px;';
                a.appendChild(hint);
            }

            r.appendChild(a);
            r.appendChild(k);
            container.appendChild(r);
        };

        section('Movement');
        row('Mouse Left Click / Hold', 'Move Ship');
        row('W / A / S / D', 'Move Ship');

        section('Combat');
        row('Space / Left Click', 'Attack Selected Target', 'Target must be selected and in range to attack.');
        row('Automatic', 'Hull & Shield Repair', 'Repairs activate automatically when out of combat for a few seconds.');

        section('Interface');
        row('Enter', 'Open/Send Chat');
        row('Esc / -', 'Close Panel / Hide Chat');
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
        slider.className = 'settings-slider';
        slider.min = '0';
        slider.max = '100';
        slider.value = defaultValue.toString();
        // Width handled by class/parent, but explicit set is fine
        // slider.style.width = '100%';

        slider.addEventListener('input', (e) => {
            const val = (e.target as HTMLInputElement).value;
            valueDisplay.textContent = val + '%';
            onChange(parseInt(val));
        });

        row.appendChild(slider);
        parent.appendChild(row);
    }
}
