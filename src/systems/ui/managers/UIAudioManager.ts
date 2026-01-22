/**
 * Manages UI click sounds and audio feedback
 */
export class UIAudioManager {
  private audioSystem: any = null;
  private mutationObserver: MutationObserver | null = null;

  /**
   * Imposta il sistema audio per i suoni UI
   */
  setAudioSystem(audioSystem: any): void {
    this.audioSystem = audioSystem;
    this.setupUIClickSounds();
  }

  /**
   * Configura suoni click per tutti gli elementi UI interattivi
   */
  private setupUIClickSounds(): void {
    // Selettori estesi per catturare tutti gli elementi interattivi
    const selectors = [
      'button',           // Tutti i pulsanti
      '.ui-panel button', // Pulsanti nei pannelli
      '.clickable',       // Elementi con classe clickable
      '[role="button"]',  // Elementi con role button
      '.ui-floating-icon', // Icone flottanti (principale!)
      '.upgrade-button',  // Pulsanti upgrade nel skills panel
      '.hud-icon',        // Icone HUD
      '.panel-icon',      // Icone pannelli
      '.ui-icon',         // Icone UI generiche
      '[data-clickable="true"]', // Elementi con attributo data
      '.icon-button',     // Pulsanti a forma di icona
      '[onclick]',        // Elementi con onclick
      '.interactive'      // Elementi interattivi
    ];

    const selectorString = selectors.join(', ');
    const clickableElements = document.querySelectorAll(selectorString);

    clickableElements.forEach(element => {
      // Evita duplicati se già ha il listener
      if (!(element as any)._uiClickSoundAdded) {
        element.addEventListener('click', (event) => {
          // Evita suoni per elementi disabilitati
          if ((event.target as HTMLElement).hasAttribute('disabled') ||
              (event.target as HTMLElement).classList.contains('disabled')) {
            return;
          }

          if (this.audioSystem) {
            this.audioSystem.playSound('click', 0.3, false, true, 'ui');
          }
        });
        (element as any)._uiClickSoundAdded = true;
      }
    });

    // Osserva per nuovi elementi aggiunti dinamicamente
    this.setupMutationObserver();
  }

  /**
   * Osserva cambiamenti DOM per aggiungere suoni ai nuovi elementi
   */
  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;

            // Selettori estesi per nuovi elementi
            const selectors = [
              'button', '.ui-panel button', '.clickable', '[role="button"]',
              '.ui-floating-icon', '.upgrade-button', '.hud-icon', '.panel-icon',
              '.ui-icon', '[data-clickable="true"]', '.icon-button', '[onclick]', '.interactive'
            ];

            const selectorString = selectors.join(', ');
            const newClickableElements = element.querySelectorAll(selectorString);

            newClickableElements.forEach(clickableElement => {
              if (!(clickableElement as any)._uiClickSoundAdded) {
                clickableElement.addEventListener('click', (event) => {
                  // Evita suoni per elementi disabilitati
                  if ((event.target as HTMLElement).hasAttribute('disabled') ||
                      (event.target as HTMLElement).classList.contains('disabled')) {
                    return;
                  }

                  if (this.audioSystem) {
                    this.audioSystem.playSound('click', 0.3, false, true, 'ui');
                  }
                });
                (clickableElement as any)._uiClickSoundAdded = true;
              }
            });

            // Se l'elemento stesso è cliccabile
            const isClickable = selectors.some(selector => {
              if (selector.startsWith('.')) {
                return element.classList.contains(selector.substring(1));
              } else if (selector.startsWith('[')) {
                const attr = selector.substring(1, selector.indexOf('=') || selector.indexOf(']'));
                return element.hasAttribute(attr);
              } else {
                return element.tagName === selector.toUpperCase();
              }
            });

            if (isClickable && !(element as any)._uiClickSoundAdded) {
              element.addEventListener('click', (event) => {
                // Evita suoni per elementi disabilitati
                if ((event.target as HTMLElement).hasAttribute('disabled') ||
                    (event.target as HTMLElement).classList.contains('disabled')) {
                  return;
                }

                if (this.audioSystem) {
                  this.audioSystem.playSound('click', 0.3, false, true, 'ui');
                }
              });
              (element as any)._uiClickSoundAdded = true;
            }
          }
        });
      });
    });

    // Osserva tutto il documento per cambiamenti
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Distrugge l'observer
   */
  destroy(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }
}
