import type { GameContext } from '../../infrastructure/engine/GameContext';
import { getFormattedVersion } from '../../utils/config/Version';
import { supabase } from '../../lib/supabase';

/**
 * Schermata iniziale del gioco Starfield
 * Gestisce input nickname e avvio partita
 */
export class StartScreen {
  private context: GameContext;
  private canvas: HTMLCanvasElement;
  private onPlayCallback?: (nickname: string) => void;

  // Elementi DOM
  private nicknameInput!: HTMLInputElement;
  private playButton!: HTMLButtonElement;
  private versionElement!: HTMLDivElement;
  private container!: HTMLDivElement;

  // Stato
  private isCreatingUser: boolean = false;

  constructor(context: GameContext) {
    this.context = context;
    this.canvas = context.canvas;

    // Aggiungi stili CSS globali per l'animazione
    this.addGlobalStyles();

    // Crea elementi DOM
    this.createUI();
  }

  /**
   * Crea l'interfaccia utente DOM
   */
  private createUI(): void {
    // Container principale con gradiente più rilassante
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background:
        radial-gradient(circle at 20% 80%, rgba(20, 40, 80, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(40, 20, 60, 0.15) 0%, transparent 50%),
        linear-gradient(135deg, #000011 0%, #001122 50%, #000018 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      z-index: 1000;
      padding: 20px;
      box-sizing: border-box;
      overflow: hidden;
    `;

    // Aggiungi stelle di sfondo per atmosfera spaziale
    this.createStarsBackground();

    // Container form con stile glassmorphism coerente con il gioco
    const formContainer = document.createElement('div');
    formContainer.className = 'startscreen-form';
    formContainer.style.cssText = `
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      padding: 35px;
      border-radius: 25px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.1),
        0 0 30px rgba(20, 40, 80, 0.15),
        0 0 50px rgba(40, 20, 60, 0.1);
      min-width: 320px;
      max-width: 420px;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      opacity: 0; /* Inizia invisibile per l'animazione */
    `;

    // Label nickname con stile migliorato
    const label = document.createElement('label');
    label.textContent = 'ENTER YOUR NICKNAME';
    label.style.cssText = `
      color: rgba(255, 255, 255, 0.9);
      display: block;
      margin-bottom: 15px;
      font-size: 14px;
      font-weight: 500;
      text-align: center;
      width: 100%;
      letter-spacing: 1px;
      text-transform: uppercase;
    `;

    // Input nickname con stile glassmorphism
    this.nicknameInput = document.createElement('input');
    this.nicknameInput.type = 'text';
    this.nicknameInput.placeholder = 'Your nickname...';
    this.nicknameInput.maxLength = 20;
    this.nicknameInput.style.cssText = `
      width: 100%;
      padding: 15px 20px;
      margin-bottom: 25px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 15px;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      color: #ffffff;
      font-size: 16px;
      font-family: 'Segoe UI', sans-serif;
      box-sizing: border-box;
      outline: none;
      transition: all 0.3s ease;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    `;

    // Aggiungi focus effect all'input
    this.nicknameInput.addEventListener('focus', () => {
      this.nicknameInput.style.borderColor = 'rgba(40, 60, 100, 0.6)';
      this.nicknameInput.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 20px rgba(20, 40, 80, 0.3)';
    });

    this.nicknameInput.addEventListener('blur', () => {
      this.nicknameInput.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      this.nicknameInput.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.1)';
    });

    // Pulsante play con stile glassmorphism migliorato
    this.playButton = document.createElement('button');
    this.playButton.innerHTML = `
      <span class="button-text">START GAME</span>
      <div class="loading-spinner" style="display: none;"></div>
    `;
    this.playButton.style.cssText = `
      width: 100%;
      padding: 18px 30px;
      background: linear-gradient(135deg, rgba(20, 40, 80, 0.25), rgba(40, 20, 60, 0.25));
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 15px;
      color: #ffffff;
      font-size: 16px;
      font-weight: 600;
      font-family: 'Segoe UI', sans-serif;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      letter-spacing: 1px;
      text-transform: uppercase;
      box-shadow:
        0 4px 15px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      position: relative;
      overflow: hidden;
    `;

    // Eventi
    this.playButton.addEventListener('click', () => this.handlePlay());
    this.nicknameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handlePlay();
      }
    });

    // Hover effect migliorato
    this.playButton.addEventListener('mouseenter', () => {
      this.playButton.style.transform = 'translateY(-2px)';
      this.playButton.style.boxShadow = `
        0 8px 25px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.2),
        0 0 30px rgba(20, 40, 80, 0.4),
        0 0 50px rgba(40, 20, 60, 0.3)
      `;
      this.playButton.style.borderColor = 'rgba(40, 60, 100, 0.5)';
    });

    this.playButton.addEventListener('mouseleave', () => {
      this.playButton.style.transform = 'translateY(0)';
      this.playButton.style.boxShadow = `
        0 4px 15px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.1)
      `;
      this.playButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });

    // Versione sotto il form
    this.versionElement = document.createElement('div');
    this.versionElement.className = 'startscreen-version';
    this.versionElement.textContent = `Version ${getFormattedVersion()}`;
    this.versionElement.style.cssText = `
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
      font-family: 'Courier New', monospace;
      letter-spacing: 2px;
      text-align: center;
      width: 100%;
      margin-top: 20px;
      opacity: 0; /* Inizia invisibile per l'animazione */
    `;

    // Assembla elementi
    formContainer.appendChild(label);
    formContainer.appendChild(this.nicknameInput);
    formContainer.appendChild(this.playButton);

    this.container.appendChild(formContainer);
    this.container.appendChild(this.versionElement);

    // Aggiungi al DOM
    document.body.appendChild(this.container);
  }

  /**
   * Aggiunge stili CSS globali per animazioni
   */
  private addGlobalStyles(): void {
    const existingStyle = document.getElementById('startscreen-styles');
    if (existingStyle) return;

    const style = document.createElement('style');
    style.id = 'startscreen-styles';
    style.textContent = `
      @keyframes titleGlow {
        0% {
          text-shadow:
            0 0 20px #00ff88,
            0 0 40px rgba(0, 255, 136, 0.5),
            0 0 60px rgba(0, 255, 136, 0.3);
        }
        100% {
          text-shadow:
            0 0 25px #00ff88,
            0 0 50px rgba(0, 255, 136, 0.7),
            0 0 80px rgba(0, 255, 136, 0.5);
        }
      }

      @keyframes starTwinkle {
        0%, 100% { opacity: 0.3; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.2); }
      }

    @keyframes fadeInUp {
        0% {
          opacity: 0;
          transform: translateY(30px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .star-particle {
        position: absolute;
        background: #ffffff;
        border-radius: 50%;
        pointer-events: none;
        animation: starTwinkle 4s ease-in-out infinite;
      }

      .star-particle:nth-child(odd) {
        animation-delay: -2s;
      }

      .star-particle:nth-child(3n) {
        animation-duration: 6s;
      }

      .startscreen-form {
        animation: fadeInUp 1.5s ease-out 0.5s both;
      }

      .startscreen-version {
        animation: fadeInUp 1.5s ease-out 1.5s both;
      }

      .loading-spinner {
        display: inline-block;
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: #ffffff;
        animation: spin 1s ease-in-out infinite;
        margin-right: 8px;
        vertical-align: middle;
        flex-shrink: 0;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .button-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }

      .button-loading .button-text {
        opacity: 0;
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
      }

      .button-loading .loading-spinner {
        margin-right: 0;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Crea stelle di sfondo per atmosfera spaziale
   */
  private createStarsBackground(): void {
    const starCount = 50;

    for (let i = 0; i < starCount; i++) {
      const star = document.createElement('div');
      star.className = 'star-particle';

      // Posizione casuale
      const x = Math.random() * 100;
      const y = Math.random() * 100;

      // Dimensione casuale (più piccole per essere rilassanti)
      const size = Math.random() * 2 + 1;

      star.style.cssText = `
        left: ${x}%;
        top: ${y}%;
        width: ${size}px;
        height: ${size}px;
        animation-delay: ${Math.random() * 4}s;
      `;

      this.container.appendChild(star);
    }
  }

  /**
   * Gestisce il click sul pulsante play
   */
  private async handlePlay(): Promise<void> {
    const nickname = this.nicknameInput.value.trim();

    if (nickname.length === 0) {
      // Mostra errore
      this.nicknameInput.style.borderColor = '#ff4444';
      this.nicknameInput.placeholder = 'Enter a nickname!';
      setTimeout(() => {
        this.nicknameInput.style.borderColor = '#0088ff';
        this.nicknameInput.placeholder = 'Your nickname...';
      }, 2000);
      return;
    }

    if (this.isCreatingUser) {
      return; // Evita multiple richieste
    }

    // Mostra loading
    this.isCreatingUser = true;
    this.showButtonLoading(true);
    this.playButton.disabled = true;
    this.nicknameInput.disabled = true;

    try {
      // Usa autenticazione anonima per evitare rate limits di signup
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

      if (authError) {
        console.error('❌ [StartScreen] Autenticazione anonima fallita:', authError.message);
        throw new Error(`Anonymous auth failed: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('No user data returned from anonymous auth');
      }

      // Salva l'ID utente nel context
      this.context.localClientId = authData.user.id;

      // Ottieni player_id sequenziale dalla sequence
      const { data: nextId, error: idError } = await supabase.rpc('get_next_player_id');

      if (idError || !nextId) {
        console.error('❌ [StartScreen] Errore generazione player_id:', idError);
        throw new Error('Failed to generate player ID');
      }

      const numericPlayerId = nextId;

      // Verifica se esiste già un profilo per questo auth_id
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('player_id')
        .eq('auth_id', authData.user.id)
        .maybeSingle();

      let finalPlayerId = numericPlayerId;

      if (existingProfile) {
        // Usa il player_id esistente
        finalPlayerId = existingProfile.player_id;

        // Aggiorna il profilo esistente
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            username: nickname,
            display_name: nickname,
            updated_at: new Date().toISOString()
          })
          .eq('auth_id', authData.user.id);

        if (updateError) {
          console.warn('⚠️ [StartScreen] Errore aggiornamento profilo esistente:', updateError.message);
        }
      } else {
        // Crea nuovo profilo
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            player_id: numericPlayerId,
            auth_id: authData.user.id,
            username: nickname,
            display_name: nickname
          });

        if (profileError) {
          console.error('❌ [StartScreen] Errore creazione profilo:', profileError.message);
          throw new Error(`Profile creation failed: ${profileError.message}`);
        }

        // Inizializza i dati di default per il nuovo giocatore

        const defaultDataPromises = [
          // Statistiche iniziali
          supabase.from('player_stats').insert({
            player_id: numericPlayerId,
            kills: 0,
            deaths: 0,
            missions_completed: 0,
            play_time: 0
          }),

          // Upgrade iniziali
          supabase.from('player_upgrades').insert({
            player_id: numericPlayerId,
            hp_upgrades: 0,
            shield_upgrades: 0,
            speed_upgrades: 0,
            damage_upgrades: 0
          }),

          // Valute iniziali
          supabase.from('player_currencies').insert({
            player_id: numericPlayerId,
            credits: 1000,
            cosmos: 100,
            experience: 0,
            honor: 0,
            skill_points_current: 0,
            skill_points_total: 0
          })
        ];

        const defaultResults = await Promise.allSettled(defaultDataPromises);

        // Controlla se ci sono stati errori nell'inizializzazione
        const failedInitializations = defaultResults.filter(result => result.status === 'rejected');

        if (failedInitializations.length > 0) {
          console.warn('⚠️ [StartScreen] Alcuni dati di default non sono stati inizializzati:', failedInitializations);
          // Non blocchiamo il gioco per errori di inizializzazione, proseguiamo comunque
        }
      }

      // Salva informazioni player nel context per il multiplayer
      this.context.playerId = finalPlayerId;
      this.context.playerNickname = nickname;

      // Piccolo delay per mostrare il messaggio di successo prima di iniziare il gioco
      setTimeout(() => {
        // Chiama callback
        this.onPlayCallback?.(nickname);
      }, 500);

    } catch (error) {
      console.error('❌ [StartScreen] Errore critico:', error);

      // Mostra errore generico
      this.nicknameInput.style.borderColor = '#ff4444';
      this.nicknameInput.placeholder = 'Connection error! Try again later.';

      // Reset UI dopo delay più lungo per errori critici
      setTimeout(() => {
        this.showButtonLoading(false);
        this.playButton.disabled = false;
        this.nicknameInput.disabled = false;
        this.nicknameInput.style.borderColor = 'rgba(40, 60, 100, 0.6)';
        this.nicknameInput.placeholder = 'Your nickname...';
        this.isCreatingUser = false;
      }, 5000);
    }
  }

  /**
   * Imposta il callback per quando si preme play
   */
  setOnPlayCallback(callback: (nickname: string) => void): void {
    this.onPlayCallback = callback;
  }

  /**
   * Nasconde l'interfaccia utente (senza rimuoverla dal DOM)
   */
  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Mostra l'interfaccia utente
   */
  show(): void {
    if (this.container) {
      this.container.style.display = 'flex';
    }
  }

  /**
   * Rimuove l'interfaccia dal DOM
   */
  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  /**
   * Restituisce il nickname corrente
   */
  getNickname(): string {
    return this.nicknameInput.value;
  }

  /**
   * Mostra o nasconde lo spinner di caricamento nel pulsante
   */
  private showButtonLoading(show: boolean): void {
    const buttonText = this.playButton.querySelector('.button-text') as HTMLElement;
    const spinner = this.playButton.querySelector('.loading-spinner') as HTMLElement;

    if (show) {
      this.playButton.classList.add('button-loading');
      spinner.style.display = 'block';
    } else {
      this.playButton.classList.remove('button-loading');
      spinner.style.display = 'none';
    }
  }
}
