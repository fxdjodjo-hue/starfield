import { DisplayManager } from '../../../../infrastructure/display';
import { getApiBaseUrl } from '../../../../config/NetworkConfig';

/**
 * PlaytestCodeModal - Popup per l'inserimento del codice playtest prima dell'accesso
 * Blocca e sfoca l'interfaccia di autenticazione finché non viene inserito un codice.
 */
export class PlaytestCodeModal {
    private modal: HTMLElement | null = null;
    private overlay: HTMLElement | null = null;
    private onUnlocked?: (code: string) => void;
    private dprCompensation: number;
    private authContainer: HTMLElement | null = null;

    constructor() {
        const dpr = DisplayManager.getInstance().getDevicePixelRatio();
        this.dprCompensation = 1 / dpr;
    }

    /**
     * Mostra il popup di sblocco playtest
     * @param authContainer L'elemento da sfocare/nascondere
     * @param onUnlocked Callback chiamata quando il codice è inserito
     */
    show(authContainer: HTMLElement, onUnlocked: (code: string) => void): void {
        if (this.modal) return;

        // Se il codice è già stato inserito in questa sessione, sblocca subito
        const savedCode = sessionStorage.getItem('playtest_code');
        if (savedCode) {
            onUnlocked(savedCode);
            return;
        }

        this.onUnlocked = onUnlocked;
        this.authContainer = authContainer;
        const c = this.dprCompensation;

        // Sfoca il container di autenticazione
        this.authContainer.style.filter = 'blur(15px)';
        this.authContainer.style.pointerEvents = 'none';
        this.authContainer.style.transition = 'filter 0.5s ease-out';

        // Overlay con blur ancora più pesante
        this.overlay = document.createElement('div');
        this.overlay.id = 'playtest-gate-overlay';
        this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      animation: fadeIn 0.5s ease-out both;
    `;

        // Modal principale
        this.modal = document.createElement('div');
        this.modal.id = 'playtest-gate-modal';
        this.modal.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(30px);
      -webkit-backdrop-filter: blur(30px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: ${Math.round(24 * c)}px;
      padding: ${Math.round(48 * c)}px;
      max-width: ${Math.round(420 * c)}px;
      width: 90%;
      box-shadow: 0 32px 64px rgba(0, 0, 0, 0.5);
      opacity: 0;
      transform: translateY(30px) scale(0.9);
      animation: modalAppear 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      text-align: center;
    `;

        // Titolo
        const title = document.createElement('h2');
        title.textContent = 'PLAYTEST ACCESS';
        title.style.cssText = `
      color: rgba(255, 255, 255, 0.95);
      font-size: ${Math.round(28 * c)}px;
      margin: 0 0 ${Math.round(12 * c)}px 0;
      font-weight: 200;
      letter-spacing: 4px;
    `;

        // Descrizione
        const desc = document.createElement('p');
        desc.textContent = 'Please enter your verification code to proceed.';
        desc.style.cssText = `
      color: rgba(255, 255, 255, 0.5);
      font-size: ${Math.round(14 * c)}px;
      margin: 0 0 ${Math.round(32 * c)}px 0;
      font-weight: 300;
      line-height: 1.5;
    `;

        // Input container
        const inputGroup = document.createElement('div');
        inputGroup.style.cssText = `margin-bottom: ${Math.round(24 * c)}px;`;

        const codeInput = document.createElement('input');
        codeInput.type = 'text';
        codeInput.placeholder = '••••••••';
        codeInput.style.cssText = `
      width: 100%;
      padding: ${Math.round(16 * c)}px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: ${Math.round(12 * c)}px;
      color: #fff;
      font-size: ${Math.round(18 * c)}px;
      text-align: center;
      letter-spacing: 4px;
      outline: none;
      transition: all 0.3s ease;
      box-sizing: border-box;
    `;

        codeInput.addEventListener('focus', () => {
            codeInput.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            codeInput.style.background = 'rgba(255, 255, 255, 0.08)';
        });

        codeInput.addEventListener('blur', () => {
            codeInput.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            codeInput.style.background = 'rgba(255, 255, 255, 0.04)';
        });

        // Errore
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = `
      color: #ff4444;
      font-size: ${Math.round(12 * c)}px;
      margin-top: ${Math.round(8 * c)}px;
      opacity: 0;
      transition: opacity 0.3s;
    `;

        inputGroup.appendChild(codeInput);
        inputGroup.appendChild(errorMsg);

        // Pulsante
        const button = document.createElement('button');
        button.textContent = 'VERIFY';
        button.style.cssText = `
      width: 100%;
      padding: ${Math.round(16 * c)}px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: ${Math.round(12 * c)}px;
      color: #fff;
      font-size: ${Math.round(14 * c)}px;
      font-weight: 500;
      letter-spacing: 2px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    `;

        const handleVerify = async () => {
            const code = codeInput.value.trim();
            if (!code) {
                errorMsg.textContent = 'Please enter a code';
                errorMsg.style.opacity = '1';
                return;
            }

            // Mostra stato di caricamento
            button.disabled = true;
            button.textContent = 'VERIFYING...';
            button.style.opacity = '0.7';
            button.style.cursor = 'not-allowed';
            errorMsg.style.opacity = '0';

            try {
                const url = `${getApiBaseUrl()}/api/verify-playtest-code`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });

                let result;
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    result = await response.json();
                } else {
                    const text = await response.text();
                    console.error(`[Playtest] Non-JSON response from ${url}:`, text);
                    throw new Error(`Server error: ${response.status}`);
                }

                if (response.ok && result.success) {
                    // Salviamo il codice e sblocchiamo
                    sessionStorage.setItem('playtest_code', code);
                    this.unlock(code);
                } else {
                    // Codice errato
                    errorMsg.textContent = result.error || 'Invalid playtest code';
                    errorMsg.style.opacity = '1';

                    // Ripristina pulsante
                    button.disabled = false;
                    button.textContent = 'VERIFY';
                    button.style.opacity = '1';
                    button.style.cursor = 'pointer';

                    // Animazione shake per l'input
                    codeInput.style.animation = 'shake 0.4s ease-in-out';
                    setTimeout(() => {
                        codeInput.style.animation = '';
                    }, 400);
                }
            } catch (error) {
                console.error('[Playtest] Verification failed:', error);
                errorMsg.textContent = 'Connection error. Check if server is running.';
                errorMsg.style.opacity = '1';

                button.disabled = false;
                button.textContent = 'VERIFY';
                button.style.opacity = '1';
                button.style.cursor = 'pointer';
            }
        };

        button.addEventListener('mouseenter', () => {
            button.style.background = 'rgba(255, 255, 255, 0.15)';
            button.style.transform = 'translateY(-2px)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.background = 'rgba(255, 255, 255, 0.1)';
            button.style.transform = 'translateY(0)';
        });

        button.addEventListener('click', handleVerify);
        codeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleVerify();
        });

        // Assembla
        this.modal.appendChild(title);
        this.modal.appendChild(desc);
        this.modal.appendChild(inputGroup);
        this.modal.appendChild(button);

        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);

        this.addAnimations();

        // Focus automatico
        setTimeout(() => codeInput.focus(), 600);
    }

    /**
     * Sblocca l'interfaccia
     */
    private unlock(code: string): void {
        if (!this.overlay || !this.authContainer) return;

        // Rimuovi sfocatura dallo sfondo
        this.authContainer.style.filter = 'none';
        this.authContainer.style.pointerEvents = 'auto';

        // Fade out del popup
        this.overlay.style.animation = 'fadeOut 0.4s ease-out both';

        setTimeout(() => {
            if (this.overlay && this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
            this.overlay = null;
            this.modal = null;
            if (this.onUnlocked) this.onUnlocked(code);
        }, 400);
    }

    private addAnimations(): void {
        const id = 'playtest-gate-animations';
        if (document.getElementById(id)) return;

        const style = document.createElement('style');
        style.id = id;
        style.textContent = `
      @keyframes modalAppear {
        from { opacity: 0; transform: translateY(30px) scale(0.9); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-8px); }
        50% { transform: translateX(8px); }
        75% { transform: translateX(-8px); }
      }
    `;
        document.head.appendChild(style);
    }
}
