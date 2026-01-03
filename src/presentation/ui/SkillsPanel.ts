import { BasePanel } from './UIManager';
import type { PanelConfig } from './PanelConfig';

/**
 * SkillsPanel - Pannello per gestire punti abilità e skill tree
 * Per ora struttura base, logica verrà aggiunta dopo
 */
export class SkillsPanel extends BasePanel {
  constructor(config: PanelConfig) {
    super(config);
  }

  /**
   * Crea il contenuto del pannello skills
   */
  protected createPanelContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'skills-content';
    content.style.cssText = `
      padding: 24px;
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 20px;
      position: relative;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
      border-radius: 16px;
      overflow-y: auto;
    `;

    // Pulsante di chiusura "X" nell'angolo superiore destro
    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
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
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
      transition: all 0.2s ease;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(239, 68, 68, 1)';
      closeButton.style.borderColor = 'rgba(239, 68, 68, 0.8)';
      closeButton.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
      closeButton.style.transform = 'translateY(-1px)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(239, 68, 68, 0.9)';
      closeButton.style.borderColor = 'rgba(239, 68, 68, 0.5)';
      closeButton.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3)';
      closeButton.style.transform = 'translateY(0)';
    });

    closeButton.addEventListener('click', () => {
      this.hide();
    });

    content.appendChild(closeButton);

    // Header con gradiente
    const header = document.createElement('div');
    header.style.cssText = `
      text-align: center;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 8px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
    `;

    const title = document.createElement('h2');
    title.textContent = '⚡ Skills & Abilità';
    title.style.cssText = `
      margin: 0;
      color: rgba(255, 255, 255, 0.95);
      font-size: 22px;
      font-weight: 700;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      background: linear-gradient(135deg, #60a5fa, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Sistema abilità e potenziamenti';
    subtitle.style.cssText = `
      margin: 4px 0 0 0;
      color: rgba(148, 163, 184, 0.7);
      font-size: 12px;
      font-weight: 400;
    `;

    header.appendChild(title);
    header.appendChild(subtitle);
    content.appendChild(header);

    // Contenuto placeholder per il pannello skills
    const placeholder = document.createElement('div');
    placeholder.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: rgba(148, 163, 184, 0.6);
      font-size: 16px;
      gap: 16px;
    `;

    const placeholderIcon = document.createElement('div');
    placeholderIcon.textContent = '⚡';
    placeholderIcon.style.cssText = `
      font-size: 48px;
      opacity: 0.3;
    `;

    const placeholderText = document.createElement('div');
    placeholderText.textContent = 'Sistema Skills in sviluppo...';
    placeholderText.style.cssText = `
      font-weight: 500;
    `;

    placeholder.appendChild(placeholderIcon);
    placeholder.appendChild(placeholderText);
    content.appendChild(placeholder);

    return content;
  }

  /**
   * Callback quando il pannello viene mostrato
   */
  protected onShow(): void {
    // Placeholder per logica futura
  }

  /**
   * Callback quando il pannello viene nascosto
   */
  protected onHide(): void {
    // Placeholder per logica futura
  }
}
