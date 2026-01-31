import { RankIconMapper } from '../../../core/utils/ui/RankIconMapper';

/**
 * Manages rendering of nicknames above players, NPCs, and remote players
 */
export class UINicknameManager {
  private playerNicknameElement: HTMLElement | null = null;
  private npcNicknameElements: Map<number, HTMLElement> = new Map();
  private remotePlayerNicknameElements: Map<string, HTMLElement> = new Map();

  // Cache delle posizioni precedenti per ridurre tremolio
  private npcNicknameLastPositions: Map<number, { x: number, y: number }> = new Map();
  private playerNicknameLastPosition: { x: number, y: number } | null = null;
  private remotePlayerNicknameLastPositions: Map<string, { x: number, y: number }> = new Map();

  // Cache stato contenuto remote player per evitare redraw
  private remotePlayerLastState: Map<string, { nickname: string, rank: string }> = new Map();

  // Stile condiviso per tutti i nickname (giocatore locale e remoti)
  private readonly SHARED_NICKNAME_STYLE = `
    position: fixed;
    color: rgba(255, 255, 255, 0.95);
    font-family: 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8), 0 1px 1px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    user-select: none;
    text-align: center;
    line-height: 1;
    white-space: nowrap;
    will-change: left, top;
  `;

  /**
   * Crea l'elemento nickname del giocatore
   */
  createPlayerNicknameElement(nickname: string): void {
    if (this.playerNicknameElement) return;

    this.playerNicknameElement = document.createElement('div');
    this.playerNicknameElement.id = 'player-nickname-uisystem';
    this.playerNicknameElement.style.cssText = this.SHARED_NICKNAME_STYLE;
    this.playerNicknameElement.style.zIndex = '50'; // Giocatore locale sempre sopra

    this.updatePlayerNicknameContent(nickname);
    document.body.appendChild(this.playerNicknameElement);
  }

  /**
   * Aggiorna il contenuto del nickname
   */
  updatePlayerNicknameContent(nickname: string): void {
    if (this.playerNicknameElement) {
      // Formatta il nickname: separa nome e rank (se presente nel formato "Nome\n[Rank]")
      const parts = nickname.split('\n');
      const name = parts[0] || 'Commander';
      const rawRank = parts[1] || '[Basic Space Pilot]';
      const rankName = rawRank.replace('[', '').replace(']', '').trim();

      this.updateNicknameHTML(this.playerNicknameElement, name, rankName);
    }
  }

  /**
   * Aggiorna la posizione del nickname del giocatore basata sulla posizione world
   */
  updatePlayerNicknamePosition(worldX: number, worldY: number, camera: any, canvasSize: any, isZoomAnimating: boolean = false, isVisible: boolean = true): void {
    if (!this.playerNicknameElement) return;

    // Nascondi se non visibile o durante l'animazione zoom
    if (!isVisible || isZoomAnimating) {
      this.playerNicknameElement.style.display = 'none';
      if (isZoomAnimating) {
        this.playerNicknameElement.style.opacity = '0';
        this.playerNicknameElement.style.transition = 'none';
      }
      return;
    }

    // Converte coordinate mondo in coordinate schermo
    const screenPos = camera.worldToScreen(worldX, worldY, canvasSize.width, canvasSize.height);

    // FIX TREMOLIO: Usa coordinate decimali
    // Il rounding aggressivo causava desync visivo (sprite fluido, testo a scatti)

    // Controlla se la posizione è cambiata significativamente (> 0.05px)
    if (this.playerNicknameLastPosition &&
      Math.abs(this.playerNicknameLastPosition.x - screenPos.x) < 0.05 &&
      Math.abs(this.playerNicknameLastPosition.y - screenPos.y) < 0.05) {
      return;
    }

    // Posiziona il nickname centrato orizzontalmente usando trasformazione CSS (più robusto di offsetWidth)
    this.playerNicknameElement.style.left = `${screenPos.x}px`;
    this.playerNicknameElement.style.top = `${screenPos.y + 80}px`;
    this.playerNicknameElement.style.transform = 'translateX(-50%)';
    this.playerNicknameElement.style.display = 'block';

    // Memorizza la posizione per il prossimo confronto
    this.playerNicknameLastPosition = { x: screenPos.x, y: screenPos.y };

    // Mostra con fade quando l'animazione è completata
    if (this.playerNicknameElement.style.opacity === '0') {
      this.playerNicknameElement.style.transition = 'opacity 0.5s ease-in';
      this.playerNicknameElement.style.opacity = '1';
    }
  }

  /**
   * Rimuove l'elemento nickname
   */
  removePlayerNicknameElement(): void {
    if (this.playerNicknameElement) {
      document.body.removeChild(this.playerNicknameElement);
      this.playerNicknameElement = null;
    }
  }

  // ===== GESTIONE NICKNAME NPC =====

  /**
   * Assicura che esista un elemento DOM per il nickname dell'NPC
   */
  ensureNpcNicknameElement(entityId: number, npcType: string, behavior: string): void {
    if (!this.npcNicknameElements.has(entityId)) {
      const element = document.createElement('div');
      element.id = `npc-nickname-${entityId}`;
      element.style.cssText = `
        position: fixed;
        color: rgba(255, 0, 0, 0.9);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-weight: 400;
        font-size: 14px;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
        pointer-events: none;
        user-select: none;
        z-index: 40;
        text-align: center;
        line-height: 1.2;
        white-space: nowrap;
        border-radius: 3px;
        padding: 2px 4px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
      `;
      // Contenuto iniziale: solo nome
      element.innerHTML = `
        <div>${npcType}</div>
      `;
      document.body.appendChild(element);
      this.npcNicknameElements.set(entityId, element);
    }
  }

  /**
   * Aggiorna il contenuto (nome + stato) del nickname NPC
   */
  updateNpcNicknameContent(entityId: number, npcType: string, behavior: string): void {
    const element = this.npcNicknameElements.get(entityId);
    if (element) {
      element.innerHTML = `
        <div>${npcType}</div>
      `;
    }
  }

  /**
   * Aggiorna la posizione dell'elemento DOM del nickname NPC
   */
  updateNpcNicknamePosition(entityId: number, screenX: number, screenY: number): void {
    const element = this.npcNicknameElements.get(entityId);
    if (element) {
      // Forza la visibilità e ricalcola dimensioni
      element.style.display = 'block';

      // FIX TREMOLIO: Usa coordinate decimali

      // Controlla se la posizione è cambiata significativamente (almeno 0.05 pixel)
      const lastPos = this.npcNicknameLastPositions.get(entityId);
      if (lastPos && Math.abs(lastPos.x - screenX) < 0.05 && Math.abs(lastPos.y - screenY) < 0.05) {
        return;
      }

      // Memorizza la larghezza per evitare ricalcoli continui che potrebbero causare instabilità
      const elementWidth = element.offsetWidth || 0;

      // Posiziona il nickname centrato orizzontalmente usando trasformazione CSS
      element.style.left = `${screenX}px`;
      element.style.top = `${screenY + 45}px`;
      element.style.transform = 'translateX(-50%)';
      element.style.display = 'block';

      // Memorizza la posizione per il prossimo confronto
      this.npcNicknameLastPositions.set(entityId, { x: screenX, y: screenY });
    }
  }

  /**
   * Rimuove l'elemento DOM per il nickname di un NPC specifico
   */
  removeNpcNicknameElement(entityId: number): void {
    const element = this.npcNicknameElements.get(entityId);
    if (element) {
      document.body.removeChild(element);
      this.npcNicknameElements.delete(entityId);
      // Rimuovi anche dalla cache delle posizioni
      this.npcNicknameLastPositions.delete(entityId);
    }
  }

  /**
   * Rimuove tutti gli elementi DOM dei nickname NPC
   */
  removeAllNpcNicknameElements(): void {
    for (const [entityId, element] of this.npcNicknameElements) {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
    this.npcNicknameElements.clear();
  }

  /**
   * Ottiene gli entityId degli NPC che hanno elementi nickname attivi
   */
  getNpcNicknameEntityIds(): number[] {
    return Array.from(this.npcNicknameElements.keys());
  }

  // ===== GESTIONE NICKNAME REMOTE PLAYER =====

  /**
   * Assicura che esista un elemento DOM per il nickname del remote player
   */
  ensureRemotePlayerNicknameElement(clientId: string, nickname: string, rank: string): void {
    if (!this.remotePlayerNicknameElements.has(clientId)) {
      const element = document.createElement('div');
      element.id = `remote-player-nickname-${clientId}`;
      element.style.cssText = this.SHARED_NICKNAME_STYLE;
      element.style.zIndex = '45'; // Player remoti leggermente sotto il locale

      this.updateNicknameHTML(element, nickname, rank);

      document.body.appendChild(element);
      this.remotePlayerNicknameElements.set(clientId, element);
      this.remotePlayerLastState.set(clientId, { nickname, rank });
    } else {
      // Check if content changed before updating DOM (fixes flickering) // FIX
      const lastState = this.remotePlayerLastState.get(clientId);
      if (lastState && lastState.nickname === nickname && lastState.rank === rank) {
        return;
      }

      const element = this.remotePlayerNicknameElements.get(clientId)!;
      this.updateNicknameHTML(element, nickname, rank);
      this.remotePlayerLastState.set(clientId, { nickname, rank });
    }
  }

  /**
   * Helper unico per generare l'HTML dei nickname (giocatore locale e remoti)
   */
  private updateNicknameHTML(element: HTMLElement, nickname: string, rank: string): void {
    const rankName = rank.replace('[', '').replace(']', '').trim();
    const iconPath = RankIconMapper.getRankIconPath(rankName);

    element.innerHTML = `
      <div style="position: relative; display: inline-block;">
        <!-- Container Rank Icon (Assoluto a sinistra, non influisce sul centro del nickname) -->
        <div style="position: absolute; right: 100%; top: 50%; transform: translateY(-50%); margin-right: 12px; width: 28px; height: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <img src="${iconPath}" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.6));" />
        </div>
        <!-- Nickname (Sarà il punto centrale del transform: translateX(-50%)) -->
        <div style="font-size: 16px; font-weight: 700; color: #ffffff; text-shadow: 0 1px 5px rgba(0,0,0,0.9); letter-spacing: 0.5px; white-space: nowrap;">${nickname}</div>
      </div>
    `;
  }

  /**
   * Aggiorna la posizione dell'elemento DOM del nickname remote player
   */
  updateRemotePlayerNicknamePosition(clientId: string, screenX: number, screenY: number): void {
    const element = this.remotePlayerNicknameElements.get(clientId);
    if (element) {
      // Forza la visibilità e ricalcola dimensioni
      element.style.display = 'block';

      // FIX TREMOLIO: Usa coordinate decimali per seguire lo sprite interpolato
      // Il rounding aggressivo causava desync visivo (sprite fluido, testo a scatti)

      // Controlla se la posizione è cambiata significativamente
      const lastPos = this.remotePlayerNicknameLastPositions.get(clientId);
      if (lastPos && Math.abs(lastPos.x - screenX) < 0.05 && Math.abs(lastPos.y - screenY) < 0.05) {
        return;
      }

      // Posiziona il nickname centrato orizzontalmente usando trasformazione CSS
      element.style.left = `${screenX}px`;
      element.style.top = `${screenY + 80}px`;
      element.style.transform = 'translateX(-50%)';
      element.style.display = 'block';

      // Memorizza la posizione per il prossimo confronto
      this.remotePlayerNicknameLastPositions.set(clientId, { x: screenX, y: screenY });
    }
  }

  /**
   * Rimuove l'elemento DOM per il nickname di un remote player specifico
   */
  removeRemotePlayerNicknameElement(clientId: string): void {
    const element = this.remotePlayerNicknameElements.get(clientId);
    if (element) {
      document.body.removeChild(element);
      this.remotePlayerNicknameElements.delete(clientId);
      // Rimuovi anche dalla cache delle posizioni e stato
      this.remotePlayerNicknameLastPositions.delete(clientId);
      this.remotePlayerLastState.delete(clientId);
    }
  }

  /**
   * Rimuove tutti gli elementi DOM dei nickname remote player
   */
  removeAllRemotePlayerNicknameElements(): void {
    for (const [clientId, element] of this.remotePlayerNicknameElements) {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
    this.remotePlayerNicknameElements.clear();
    this.remotePlayerLastState.clear();
  }

  /**
   * Ottiene i clientId dei remote player che hanno elementi nickname attivi
   */
  getRemotePlayerNicknameClientIds(): string[] {
    return Array.from(this.remotePlayerNicknameElements.keys());
  }
}
