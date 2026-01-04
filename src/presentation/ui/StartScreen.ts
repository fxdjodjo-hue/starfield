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
  private titleElement!: HTMLDivElement;
  private versionElement!: HTMLDivElement;
  private headerContainer!: HTMLDivElement;
  private container!: HTMLDivElement;

  // Stato
  private isCreatingUser: boolean = false;

  constructor(context: GameContext) {
    this.context = context;
    this.canvas = context.canvas;

    // Crea elementi DOM
    this.createUI();
  }

  /**
   * Crea l'interfaccia utente DOM
   */
  private createUI(): void {
    // Container principale
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #000011 0%, #001122 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
      z-index: 1000;
      padding: 20px;
      box-sizing: border-box;
    `;

    // Titolo
    this.titleElement = document.createElement('h1');
    this.titleElement.textContent = 'STARFIELD';
    this.titleElement.style.cssText = `
      color: #00ff88;
      font-size: 48px;
      margin: 0;
      text-shadow: 0 0 20px #00ff88;
      letter-spacing: 4px;
      text-align: center;
      width: 100%;
    `;

    // Versione
    this.versionElement = document.createElement('div');
    this.versionElement.textContent = `Version ${getFormattedVersion()}`;
    this.versionElement.style.cssText = `
      color: rgba(255, 255, 255, 0.7);
      font-size: 14px;
      font-family: monospace;
      letter-spacing: 1px;
      text-align: center;
      width: 100%;
    `;

    // Container header per titolo e versione
    this.headerContainer = document.createElement('div');
    this.headerContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-top: 80px;
      margin-bottom: 30px;
      width: 100%;
    `;

    // Container form
    const formContainer = document.createElement('div');
    formContainer.style.cssText = `
      background: rgba(0, 255, 136, 0.1);
      padding: 30px;
      border-radius: 10px;
      border: 2px solid #00ff88;
      box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
      min-width: 300px;
      max-width: 400px;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
    `;

    // Label nickname
    const label = document.createElement('label');
    label.textContent = 'Enter your nickname:';
    label.style.cssText = `
      color: #ffffff;
      display: block;
      margin-bottom: 10px;
      font-size: 16px;
      text-align: center;
      width: 100%;
    `;

    // Input nickname
    this.nicknameInput = document.createElement('input');
    this.nicknameInput.type = 'text';
    this.nicknameInput.placeholder = 'Your nickname...';
    this.nicknameInput.maxLength = 20;
    this.nicknameInput.style.cssText = `
      width: 100%;
      padding: 12px;
      margin-bottom: 20px;
      border: 2px solid #0088ff;
      border-radius: 5px;
      background: rgba(0, 0, 0, 0.5);
      color: #ffffff;
      font-size: 16px;
      box-sizing: border-box;
    `;

    // Pulsante play
    this.playButton = document.createElement('button');
    this.playButton.textContent = 'START';
    this.playButton.style.cssText = `
      width: 100%;
      padding: 15px;
      background: linear-gradient(45deg, #00ff88, #0088ff);
      border: none;
      border-radius: 5px;
      color: #000011;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
    `;

    // Eventi
    this.playButton.addEventListener('click', () => this.handlePlay());
    this.nicknameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handlePlay();
      }
    });

    // Hover effect
    this.playButton.addEventListener('mouseenter', () => {
      this.playButton.style.boxShadow = '0 0 20px rgba(0, 255, 136, 0.5)';
    });

    this.playButton.addEventListener('mouseleave', () => {
      this.playButton.style.boxShadow = 'none';
    });

    // Assembla elementi
    formContainer.appendChild(label);
    formContainer.appendChild(this.nicknameInput);
    formContainer.appendChild(this.playButton);

    // Assembla header (titolo + versione centrati insieme)
    this.headerContainer.appendChild(this.titleElement);
    this.headerContainer.appendChild(this.versionElement);

    this.container.appendChild(this.headerContainer);
    this.container.appendChild(formContainer);

    // Aggiungi al DOM
    document.body.appendChild(this.container);
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
    this.playButton.textContent = 'Connecting...';
    this.playButton.disabled = true;
    this.nicknameInput.disabled = true;

    console.log('👤 [StartScreen] Creando utente per nickname:', nickname);

    try {
      // Usa autenticazione anonima per evitare rate limits di signup
      console.log('🔐 [StartScreen] Tentando autenticazione anonima...');

      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

      if (authError) {
        console.error('❌ [StartScreen] Autenticazione anonima fallita:', authError.message);
        throw new Error(`Anonymous auth failed: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('No user data returned from anonymous auth');
      }

      console.log('✅ [StartScreen] Autenticazione anonima riuscita');
      console.log('👤 [StartScreen] User ID (Supabase):', authData.user.id);

      // Salva l'ID utente nel context
      this.context.localClientId = authData.user.id;

      // Ottieni player_id sequenziale dalla sequence
      const { data: nextId, error: idError } = await supabase.rpc('get_next_player_id');

      if (idError || !nextId) {
        console.error('❌ [StartScreen] Errore generazione player_id:', idError);
        throw new Error('Failed to generate player ID');
      }

      const numericPlayerId = nextId;
      console.log('🔢 [StartScreen] Player ID (Sequenziale):', numericPlayerId);

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
        console.log('✅ [StartScreen] Profilo esistente trovato, uso player_id:', finalPlayerId);

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
        } else {
          console.log('✅ [StartScreen] Nuovo profilo utente creato');
        }

        // Inizializza i dati di default per il nuovo giocatore
        console.log('🎮 [StartScreen] Inizializzazione dati giocatore di default...');

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
        } else {
          console.log('✅ [StartScreen] Tutti i dati giocatore inizializzati con successo');
        }
      }

      // Salva informazioni player nel context per il multiplayer
      this.context.playerId = finalPlayerId;
      this.context.playerNickname = nickname;

      this.playButton.textContent = 'Starting Game...';

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
        this.playButton.textContent = 'START GAME';
        this.playButton.disabled = false;
        this.nicknameInput.disabled = false;
        this.nicknameInput.style.borderColor = '#0088ff';
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
}
