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

  /**
   * Crea l'elemento nickname del giocatore
   */
  createPlayerNicknameElement(nickname: string): void {
    if (this.playerNicknameElement) return;

    this.playerNicknameElement = document.createElement('div');
    this.playerNicknameElement.id = 'player-nickname-uisystem';
    this.playerNicknameElement.style.cssText = `
      position: fixed;
      color: rgba(255, 255, 255, 0.9);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-weight: 500;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
      pointer-events: none;
      user-select: none;
      z-index: 50;
      text-align: center;
      line-height: 1.4;
      white-space: nowrap;
      border-radius: 5px;
    `;

    this.updatePlayerNicknameContent(nickname);
    document.body.appendChild(this.playerNicknameElement);
  }

  /**
   * Aggiorna il contenuto del nickname
   */
  updatePlayerNicknameContent(nickname: string): void {
    if (this.playerNicknameElement) {
      // Formatta il nickname su due righe: nome sopra, rank sotto
      const parts = nickname.split('\n');
      this.playerNicknameElement.innerHTML = `
        <div style="font-size: 14px; font-weight: 600;">${parts[0] || 'Commander'}</div>
        <div style="font-size: 12px; font-weight: 400; opacity: 0.8;">${parts[1] || '[Recruit]'}</div>
      `;
    }
  }

  /**
   * Aggiorna la posizione del nickname del giocatore basata sulla posizione world
   */
  updatePlayerNicknamePosition(worldX: number, worldY: number, camera: any, canvasSize: any, isZoomAnimating: boolean = false): void {
    if (!this.playerNicknameElement) return;

    // Nascondi durante l'animazione zoom
    if (isZoomAnimating) {
      this.playerNicknameElement.style.opacity = '0';
      this.playerNicknameElement.style.transition = 'none';
      return;
    }

    // Converte coordinate mondo in coordinate schermo
    const screenPos = camera.worldToScreen(worldX, worldY, canvasSize.width, canvasSize.height);

    // Arrotonda le coordinate per evitare tremolio da valori decimali
    const roundedScreenX = Math.round(screenPos.x);
    const roundedScreenY = Math.round(screenPos.y);

    // Controlla se la posizione è cambiata significativamente
    if (this.playerNicknameLastPosition &&
        Math.abs(this.playerNicknameLastPosition.x - roundedScreenX) < 1 &&
        Math.abs(this.playerNicknameLastPosition.y - roundedScreenY) < 1) {
      // Posizione praticamente invariata - evita aggiornamenti inutili
      return;
    }

    // Posiziona il nickname centrato orizzontalmente sotto la nave
    const nicknameX = Math.round(roundedScreenX - this.playerNicknameElement.offsetWidth / 2);
    const nicknameY = Math.round(roundedScreenY + 60); // Sotto la nave (spostato più sotto)

    this.playerNicknameElement.style.left = `${nicknameX}px`;
    this.playerNicknameElement.style.top = `${nicknameY}px`;
    this.playerNicknameElement.style.transform = 'none';
    this.playerNicknameElement.style.display = 'block';

    // Memorizza la posizione per il prossimo confronto
    this.playerNicknameLastPosition = { x: roundedScreenX, y: roundedScreenY };

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

      // Arrotonda le coordinate per evitare tremolio da valori decimali
      const roundedScreenX = Math.round(screenX);
      const roundedScreenY = Math.round(screenY);

      // Controlla se la posizione è cambiata significativamente (almeno 1 pixel)
      const lastPos = this.npcNicknameLastPositions.get(entityId);
      if (lastPos && Math.abs(lastPos.x - roundedScreenX) < 1 && Math.abs(lastPos.y - roundedScreenY) < 1) {
        // Posizione praticamente invariata - evita aggiornamenti inutili che causano tremolio
        return;
      }

      // Memorizza la larghezza per evitare ricalcoli continui che potrebbero causare instabilità
      const elementWidth = element.offsetWidth || 0;

      // Posiziona il nickname centrato orizzontalmente sotto l'NPC
      const nicknameX = Math.round(roundedScreenX - elementWidth / 2);
      const nicknameY = Math.round(roundedScreenY + 45); // Sotto l'NPC

      element.style.left = `${nicknameX}px`;
      element.style.top = `${nicknameY}px`;
      element.style.transform = 'none';
      element.style.display = 'block';

      // Memorizza la posizione per il prossimo confronto
      this.npcNicknameLastPositions.set(entityId, { x: roundedScreenX, y: roundedScreenY });
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
      element.style.cssText = `
        position: fixed;
        color: rgba(255, 255, 255, 0.9);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-weight: 500;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
        pointer-events: none;
        user-select: none;
        z-index: 45;
        text-align: center;
        line-height: 1.4;
        white-space: nowrap;
        border-radius: 5px;
      `;

      // Formatta il nickname su due righe: nome sopra, rank sotto
      element.innerHTML = `
        <div style="font-size: 14px; font-weight: 600;">${nickname}</div>
        <div style="font-size: 12px; font-weight: 400; opacity: 0.8;">[${rank}]</div>
      `;

      document.body.appendChild(element);
      this.remotePlayerNicknameElements.set(clientId, element);
    } else {
      // Aggiorna il contenuto se già esiste
      const element = this.remotePlayerNicknameElements.get(clientId)!;
      element.innerHTML = `
        <div style="font-size: 14px; font-weight: 600;">${nickname}</div>
        <div style="font-size: 12px; font-weight: 400; opacity: 0.8;">[${rank}]</div>
      `;
    }
  }

  /**
   * Aggiorna la posizione dell'elemento DOM del nickname remote player
   */
  updateRemotePlayerNicknamePosition(clientId: string, screenX: number, screenY: number): void {
    const element = this.remotePlayerNicknameElements.get(clientId);
    if (element) {
      // Forza la visibilità e ricalcola dimensioni
      element.style.display = 'block';

      // Arrotonda le coordinate per evitare tremolio da valori decimali
      const roundedScreenX = Math.round(screenX);
      const roundedScreenY = Math.round(screenY);

      // Controlla se la posizione è cambiata significativamente
      const lastPos = this.remotePlayerNicknameLastPositions.get(clientId);
      if (lastPos && Math.abs(lastPos.x - roundedScreenX) < 1 && Math.abs(lastPos.y - roundedScreenY) < 1) {
        // Posizione praticamente invariata - evita aggiornamenti inutili
        return;
      }

      // Posiziona il nickname centrato orizzontalmente sotto il remote player
      const nicknameX = Math.round(roundedScreenX - element.offsetWidth / 2);
      const nicknameY = Math.round(roundedScreenY + 45); // Sotto il remote player

      element.style.left = `${nicknameX}px`;
      element.style.top = `${nicknameY}px`;
      element.style.transform = 'none';
      element.style.display = 'block';

      // Memorizza la posizione per il prossimo confronto
      this.remotePlayerNicknameLastPositions.set(clientId, { x: roundedScreenX, y: roundedScreenY });
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
      // Rimuovi anche dalla cache delle posizioni
      this.remotePlayerNicknameLastPositions.delete(clientId);
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
  }

  /**
   * Ottiene i clientId dei remote player che hanno elementi nickname attivi
   */
  getRemotePlayerNicknameClientIds(): string[] {
    return Array.from(this.remotePlayerNicknameElements.keys());
  }
}
