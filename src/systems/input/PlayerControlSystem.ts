import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { Damage } from '../../entities/combat/Damage';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';
import { Npc } from '../../entities/ai/Npc';
import { Camera } from '../../entities/spatial/Camera';
import { PlayerUpgrades } from '../../entities/player/PlayerUpgrades';
import { LogSystem } from '../rendering/LogSystem';
import { LogType } from '../../presentation/ui/LogMessage';
import { getPlayerDefinition } from '../../config/PlayerConfig';
import { CONFIG } from '../../utils/config/Config';
import { GAME_CONSTANTS } from '../../config/GameConstants';

/**
 * Sistema di controllo del player - gestisce click-to-move e movimento continuo
 */
export class PlayerControlSystem extends BaseSystem {
  private playerEntity: any = null;
  private camera: Camera | null = null;
  private audioSystem: any = null;
  private onMouseStateCallback?: (pressed: boolean, x: number, y: number) => void;
  private isMousePressed = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private minimapTargetX: number | null = null;
  private minimapTargetY: number | null = null;
    private attackActivated = false; // Flag per tracciare se l'attacco è attivo (toggle mode)
    private lastInputTime = 0; // Timestamp dell'ultimo input per rispettare attack speed
    private lastSpacePressTime = 0; // Timestamp dell'ultima pressione SPACE per evitare toggle troppo rapidi
  private onMinimapMovementComplete?: () => void;
  private isEnginePlaying = false;
  private engineSoundPromise: Promise<void> | null = null;
  private logSystem: LogSystem | null = null;
  private keysPressed = new Set<string>();

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Imposta l'entità player da controllare
   */
  setPlayerEntity(entity: any): void {
    this.playerEntity = entity;
  }

  /**
   * Imposta il callback per lo stato del mouse
   */
  setMouseStateCallback(callback: (pressed: boolean, x: number, y: number) => void): void {
    this.onMouseStateCallback = callback;
  }

  /**
   * Gestisce la pressione dei tasti
   */
  handleKeyPress(key: string): void {
    if (key === 'Space') {
      const now = Date.now();
      // Evita toggle troppo rapidi (minimo 300ms tra pressioni)
      if (now - this.lastSpacePressTime > 300) {
        this.lastSpacePressTime = now;

        // Trova sempre l'NPC più vicino nel range
        const nearbyNpc = this.findNearbyNpcForSelection();
        const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
        const currentlySelectedNpc = selectedNpcs.length > 0 ? selectedNpcs[0] : null;

        // Se c'è un NPC vicino e (non ne abbiamo selezionato nessuno O è diverso da quello selezionato)
        if (nearbyNpc && this.isNpcInPlayerRange(nearbyNpc) &&
            (!currentlySelectedNpc || nearbyNpc.id !== currentlySelectedNpc.id)) {
          // Seleziona il nuovo NPC più vicino
          this.selectNpc(nearbyNpc);
        }

        // Ora gestisci il toggle dell'attacco
        const selectedNpcsAfter = this.ecs.getEntitiesWithComponents(SelectedNpc);
        if (selectedNpcsAfter.length > 0) {
          if (this.attackActivated) {
            // Disattiva attacco se già attivo
            this.attackActivated = false;
            this.deactivateAttack();
          } else {
            // Attiva attacco
            this.handleSpacePress();
          }
        } else {
          // Nessun NPC disponibile per l'attacco
          if (this.logSystem) {
            this.logSystem.addLogMessage('No target available nearby', LogType.ATTACK_FAILED, 2000);
          }
        }
      }
    } else {
      // Gestisci movimento con WASD
      this.keysPressed.add(key.toLowerCase());
    }
  }

  /**
   * Gestisce il rilascio dei tasti (solo per movimento WASD)
   */
  handleKeyRelease(key: string): void {
    if (key !== 'Space') {
      // Rimuovi dal set dei tasti premuti (solo WASD)
      this.keysPressed.delete(key.toLowerCase());
    }
  }

  /**
   * Gestisce l'attivazione dell'attacco con SPACE (toggle mode)
   * ✅ PRE-VALIDATION: Controlla range e target prima di permettere attacco
   */
  private handleSpacePress(): void {
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);

    if (selectedNpcs.length === 0) {
      // 🎯 AUTO-SELEZIONE: Seleziona automaticamente l'NPC più vicino entro range
      const nearestNpc = this.findNearestNpcInRange();
      if (nearestNpc) {
        this.selectNpc(nearestNpc);
        console.log(`[PlayerControlSystem] Auto-selected nearest NPC for attack`);
      } else {
        if (this.logSystem) {
          this.logSystem.addLogMessage('No target available nearby', LogType.ATTACK_FAILED, 2000);
        }
        return;
      }
    }

    // 🔥 PRE-VALIDATION: Controlla se l'NPC è in range prima di permettere l'attacco
    const inRange = this.isSelectedNpcInRange();

    if (!inRange) {
      console.log('[PlayerControlSystem] NPC out of range - aborting attack');
      this.showOutOfRangeMessage();
      return;
    }

    // 🎯 ATTIVA combattimento al keydown
    // ✅ BEST PRACTICE: Client dichiara INTENTO, server gestisce TIMING
    // ❌ NO cooldown client-side - il server ha autorità completa
    this.attackActivated = true;
    this.lastInputTime = Date.now(); // Solo per controlli anti-spam UI
  }

  /**
   * Trova l'NPC più vicino entro il range di attacco del player
   */
  private findNearestNpcInRange(): any | null {
    const playerEntity = this.ecs.getPlayerEntity();
    if (!playerEntity) return null;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    if (!playerTransform) return null;

    const npcs = this.ecs.getEntitiesWithComponents(Npc, Transform);
    const { PLAYER_RANGE } = GAME_CONSTANTS.COMBAT;

    let nearestNpc: any = null;
    let nearestDistance = PLAYER_RANGE;

    for (const npcEntity of npcs) {
      const npcTransform = this.ecs.getComponent(npcEntity, Transform);
      if (!npcTransform) continue;

      const distance = Math.sqrt(
        Math.pow(playerTransform.x - npcTransform.x, 2) +
        Math.pow(playerTransform.y - npcTransform.y, 2)
      );

      if (distance < nearestDistance) {
        nearestNpc = npcEntity;
        nearestDistance = distance;
      }
    }

    return nearestNpc;
  }


  /**
   * Controlla se l'NPC selezionato è nel range di attacco
   */
  private isSelectedNpcInRange(): boolean {
    const playerEntity = this.ecs.getPlayerEntity();
    if (!playerEntity) {
      console.log('[PlayerControlSystem] No player entity found');
      return false;
    }

    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    if (selectedNpcs.length === 0) {
      console.log('[PlayerControlSystem] No selected NPCs found');
      return false;
    }

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    const npcTransform = this.ecs.getComponent(selectedNpcs[0], Transform);

    if (!playerTransform || !npcTransform) {
      console.log('[PlayerControlSystem] Missing transforms - player:', !!playerTransform, 'npc:', !!npcTransform);
      return false;
    }

    // Calcola distanza
    const dx = playerTransform.x - npcTransform.x;
    const dy = playerTransform.y - npcTransform.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Usa la costante centralizzata
    const { PLAYER_RANGE } = GAME_CONSTANTS.COMBAT;
    const inRange = distance <= PLAYER_RANGE;

    console.log(`[PlayerControlSystem] Range check - distance: ${distance.toFixed(1)}, range: ${PLAYER_RANGE}, inRange: ${inRange}`);

    return inRange;
  }

  /**
   * Controlla se un NPC specifico è nel range del player
   */
  private isNpcInPlayerRange(npcEntity: any): boolean {
    const playerEntity = this.ecs.getPlayerEntity();
    if (!playerEntity) return false;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    const npcTransform = this.ecs.getComponent(npcEntity, Transform);

    if (!playerTransform || !npcTransform) return false;

    // Calcola distanza
    const dx = playerTransform.x - npcTransform.x;
    const dy = playerTransform.y - npcTransform.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Usa la costante centralizzata
    const { PLAYER_RANGE } = GAME_CONSTANTS.COMBAT;

    return distance <= PLAYER_RANGE;
  }

  /**
   * Mostra messaggio quando NPC è fuori range
   */
  private showOutOfRangeMessage(): void {
    // Mostra nei log di gioco
    if (this.logSystem) {
      this.logSystem.addLogMessage('Target out of range! Move closer to attack.', LogType.ATTACK_FAILED, 2000);
    }

    // TODO: Implementare feedback visivo nell'UI
    // this.uiSystem?.showNotification('NPC fuori gittata! Avvicinati per attaccare.');
  }

  /**
   * Ottiene il cooldown dell'attacco del player per sincronizzare input e bilanciamento
   */
  private getPlayerAttackCooldown(): number {
    if (!this.playerEntity) return 1000; // Default 1 secondo

    const damage = this.ecs.getComponent(this.playerEntity, Damage);
    return damage ? damage.attackCooldown : 1000;
  }


  /**
   * Restituisce se l'attacco è attualmente attivato
   */
  isAttackActivated(): boolean {
    // Log per debug quando viene chiamato durante combattimento
    return this.attackActivated;
  }

  /**
   * Disattiva forzatamente l'attacco (chiamato quando finisce il combattimento o cambia selezione)
   */
  deactivateAttack(): void {
    if (this.attackActivated) {
      this.attackActivated = false;

      // Ferma immediatamente qualsiasi combattimento in corso
      this.stopCombatIfActive();
    }
  }

  /**
   * Imposta la camera per la conversione coordinate
   */
  setCamera(camera: Camera): void {
    this.camera = camera;
  }

  /**
   * Imposta il sistema audio per i suoni del motore
   */
  setAudioSystem(audioSystem: any): void {
    this.audioSystem = audioSystem;
  }

  /**
   * Imposta il sistema di logging per messaggi in-game
   */
  setLogSystem(logSystem: LogSystem): void {
    this.logSystem = logSystem;
  }

  /**
   * Avvia il suono del motore con fade in
   */
  private async startEngineSound(): Promise<void> {
    if (!this.audioSystem) return;

    try {
      // Se è già in riproduzione, non fare nulla
      if (this.isEnginePlaying) return;

      this.isEnginePlaying = true;

      // Avvia il suono con volume 0 per evitare pop iniziale
      this.audioSystem.playSound('engine', 0, true);

      // Fade in graduale (volume ridotto)
      this.audioSystem.fadeInSound('engine', 800, 0.05);
    } catch (error) {
      console.warn('PlayerControlSystem: Error starting engine sound:', error);
      this.isEnginePlaying = false;
    }
  }

  /**
   * Ferma il suono del motore con fade out
   */
  private async stopEngineSound(): Promise<void> {
    if (!this.audioSystem) return;

    try {
      // Se non è in riproduzione, non fare nulla
      if (!this.isEnginePlaying) return;

      this.isEnginePlaying = false;

      // Fade out graduale
      await this.audioSystem.fadeOutSound('engine', 500);
    } catch (error) {
      console.warn('PlayerControlSystem: Error stopping engine sound:', error);
      // Reset dello stato in caso di errore
      this.isEnginePlaying = false;
    }
  }

  /**
   * Ottiene la velocità del player calcolata con bonus dagli upgrade
   */
  private getPlayerSpeed(): number {
    if (!this.playerEntity) return 300;

    const playerDef = getPlayerDefinition();
    const playerUpgrades = this.ecs.getComponent(this.playerEntity, PlayerUpgrades);

    if (playerUpgrades) {
      const speedBonus = playerUpgrades.getSpeedBonus();
      return Math.floor(playerDef.stats.speed * speedBonus);
    }

    // Fallback se non ci sono upgrade
    return playerDef.stats.speed;
  }

  /**
   * Imposta callback per quando finisce il movimento dalla minimappa
   */
  setMinimapMovementCompleteCallback(callback: () => void): void {
    this.onMinimapMovementComplete = callback;
  }

  update(deltaTime: number): void {
    if (!this.playerEntity) return;

    const isMoving = (this.minimapTargetX !== null && this.minimapTargetY !== null) ||
                     this.isKeyboardMoving() ||
                     this.isMousePressed;

    // Gestisci suono del motore - evita chiamate multiple rapide
    if (isMoving && !this.isEnginePlaying && !this.engineSoundPromise) {
      this.engineSoundPromise = this.startEngineSound().finally(() => {
        this.engineSoundPromise = null;
      });
    } else if (!isMoving && this.isEnginePlaying && !this.engineSoundPromise) {
      this.engineSoundPromise = this.stopEngineSound().finally(() => {
        this.engineSoundPromise = null;
      });
    }

    // Priorità: movimento minimappa > movimento tastiera > movimento mouse > fermo
    if (this.minimapTargetX !== null && this.minimapTargetY !== null) {
      this.movePlayerTowardsMinimapTarget();
    } else if (this.isKeyboardMoving()) {
      this.movePlayerWithKeyboard();
    } else if (this.isMousePressed) {
      this.movePlayerTowardsMouse();
    } else {
      // Quando non c'è movimento richiesto, ferma il player
      this.stopPlayerMovement();
    }

    // Ruota verso l'NPC selezionato SOLO se l'attacco è attivo
    // Questo previene l'agganciamento precoce prima dell'inizio del combattimento
    if (this.attackActivated) {
      this.faceSelectedNpc();
    }
  }

  /**
   * Gestisce lo stato del mouse (premuto/rilasciato)
   */
  handleMouseState(pressed: boolean, x: number, y: number): void {
    if (!this.playerEntity) return;

    // Se si clicca con il mouse normale, cancella il target della minimappa
    if (pressed) {
      this.minimapTargetX = null;
      this.minimapTargetY = null;
    }

    this.isMousePressed = pressed;
    if (pressed) {
      this.lastMouseX = x;
      this.lastMouseY = y;
    }
  }

  /**
   * Gestisce il movimento del mouse mentre è premuto
   */
  handleMouseMoveWhilePressed(x: number, y: number): void {
    if (!this.playerEntity || !this.isMousePressed) return;

    // Aggiorna continuamente la posizione target mentre il mouse si muove
    this.lastMouseX = x;
    this.lastMouseY = y;
  }

  /**
   * Imposta una destinazione per il movimento del player
   * Usato per click-to-move dalla minimappa
   */
  movePlayerTo(worldX: number, worldY: number): void {
    if (!this.playerEntity) return;

    // Salva la destinazione mondo per il movimento dalla minimappa
    this.minimapTargetX = worldX;
    this.minimapTargetY = worldY;

    // Disabilita il movimento normale con mouse
    this.isMousePressed = false;
  }

  /**
   * Muove il player verso la destinazione della minimappa
   */
  private movePlayerTowardsMinimapTarget(): void {
    if (!this.playerEntity || this.minimapTargetX === null || this.minimapTargetY === null) return;

    const transform = this.ecs.getComponent(this.playerEntity, Transform);
    const velocity = this.ecs.getComponent(this.playerEntity, Velocity);

    if (!transform || !velocity) return;

    const dx = this.minimapTargetX - transform.x;
    const dy = this.minimapTargetY - transform.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 50) { // Se siamo abbastanza lontani (soglia più alta per minimappa)
      // Normalizza la direzione
      const dirX = dx / distance;
      const dirY = dy / distance;

      // Imposta velocity verso la destinazione (stessa velocità del player)
      velocity.setVelocity(dirX * this.getPlayerSpeed(), dirY * this.getPlayerSpeed());

      // Ruota verso la direzione del movimento (sempre, dato che è navigazione)
      const angle = Math.atan2(dirY, dirX) + Math.PI / 2;
      transform.rotation = angle;
    } else {
      // Vicino alla destinazione, ferma il movimento e reset target
      velocity.stop();
      this.minimapTargetX = null;
      this.minimapTargetY = null;

      // Notifica che il movimento dalla minimappa è completato
      if (this.onMinimapMovementComplete) {
        this.onMinimapMovementComplete();
      }
    }
  }

  /**
   * Muove il player verso la posizione del mouse
   */
  private movePlayerTowardsMouse(): void {
    if (!this.playerEntity || !this.camera) return;

    const transform = this.ecs.getComponent(this.playerEntity, Transform);
    const velocity = this.ecs.getComponent(this.playerEntity, Velocity);

    if (!transform || !velocity) return;

    // Converti coordinate schermo del mouse in coordinate mondo usando la camera
    const worldMousePos = this.camera.screenToWorld(this.lastMouseX, this.lastMouseY, window.innerWidth, window.innerHeight);
    const worldMouseX = worldMousePos.x;
    const worldMouseY = worldMousePos.y;

    const dx = worldMouseX - transform.x;
    const dy = worldMouseY - transform.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 10) { // Se siamo abbastanza lontani
      // Normalizza la direzione
      const dirX = dx / distance;
      const dirY = dy / distance;

      // Imposta velocity verso il mouse
      velocity.setVelocity(dirX * this.getPlayerSpeed(), dirY * this.getPlayerSpeed());

      // Ruota sempre verso la direzione del movimento per movimento libero
      // L'agganciamento al bersaglio avviene solo durante combattimento attivo
      const angle = Math.atan2(dirY, dirX) + Math.PI / 2;
      transform.rotation = angle;
    } else {
      // Vicino al mouse, ferma il movimento
      velocity.stop();
      this.isMousePressed = false; // Reset mouse pressed state
    }
  }

  /**
   * Ferma il movimento del player
   */
  private stopPlayerMovement(): void {
    if (!this.playerEntity) return;

    const velocity = this.ecs.getComponent(this.playerEntity, Velocity);
    if (velocity) {
      velocity.stop();
    }
  }

  /**
   * Ferma il combattimento attivo quando disattivi manualmente l'attacco
   */
  private stopCombatIfActive(): void {
    // Trova il CombatSystem nell'ECS
    const combatSystem = this.ecs.systems?.find((system: any) =>
      typeof system.stopCombatImmediately === 'function'
    );

    if (combatSystem) {
      combatSystem.stopCombatImmediately();
    }
  }

  /**
   * Ruota il player verso l'NPC selezionato SOLO durante il combattimento attivo
   * (chiamato solo quando attackActivated è true)
   */
  private faceSelectedNpc(): void {
    if (!this.playerEntity) return;

    // Trova l'NPC selezionato
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    if (selectedNpcs.length === 0) return;

    const selectedNpc = selectedNpcs[0];
    const npcTransform = this.ecs.getComponent(selectedNpc, Transform);
    const playerTransform = this.ecs.getComponent(this.playerEntity, Transform);

    if (!npcTransform || !playerTransform) return;

    // Calcola l'angolo verso l'NPC
    const dx = npcTransform.x - playerTransform.x;
    const dy = npcTransform.y - playerTransform.y;

    // Calcola l'angolo e ruota la nave
    const angle = Math.atan2(dy, dx) + Math.PI / 2;
    playerTransform.rotation = angle;
  }

  /**
   * Controlla se ci sono tasti di movimento premuti
   */
  private isKeyboardMoving(): boolean {
    return this.keysPressed.has('w') || this.keysPressed.has('a') ||
           this.keysPressed.has('s') || this.keysPressed.has('d');
  }

  /**
   * Muove il player basato sui tasti WASD premuti
   */
  private movePlayerWithKeyboard(): void {
    if (!this.playerEntity) return;

    const velocity = this.ecs.getComponent(this.playerEntity, Velocity);
    if (!velocity) return;

    const speed = this.getPlayerSpeed();
    let vx = 0;
    let vy = 0;

    // Calcola direzione basata sui tasti premuti
    if (this.keysPressed.has('w')) vy -= 1; // Su
    if (this.keysPressed.has('s')) vy += 1; // Giù
    if (this.keysPressed.has('a')) vx -= 1; // Sinistra
    if (this.keysPressed.has('d')) vx += 1; // Destra

    // Normalizza il vettore se si muovono due direzioni contemporaneamente
    if (vx !== 0 && vy !== 0) {
      const length = Math.sqrt(vx * vx + vy * vy);
      vx /= length;
      vy /= length;
    }

    // Applica velocità
    velocity.setVelocity(vx * speed, vy * speed);

    // Ruota la nave verso la direzione del movimento
    if (vx !== 0 || vy !== 0) {
      const angle = Math.atan2(vy, vx) + Math.PI / 2; // +90° per orientare la nave correttamente
      const transform = this.ecs.getComponent(this.playerEntity, Transform);
      if (transform) {
        transform.rotation = angle;
      }
    }
  }

  /**
   * Trova l'NPC più vicino al player per la selezione automatica (entro 250px)
   */
  private findNearbyNpcForSelection(): any | null {
    if (!this.playerEntity) return null;

    const playerTransform = this.ecs.getComponent(this.playerEntity, Transform);
    if (!playerTransform) return null;

    const npcs = this.ecs.getEntitiesWithComponents(Npc, Transform);

    let closestNpc: any = null;
    let closestDistance = 250; // Distanza massima per selezione automatica con SPACE (250px)

    for (const npcEntity of npcs) {
      const transform = this.ecs.getComponent(npcEntity, Transform);
      if (transform) {
        const distance = Math.sqrt(
          Math.pow(playerTransform.x - transform.x, 2) +
          Math.pow(playerTransform.y - transform.y, 2)
        );

        if (distance < closestDistance) {
          closestNpc = npcEntity;
          closestDistance = distance;
        }
      }
    }

    return closestNpc;
  }

  /**
   * Seleziona un NPC specifico (copia della logica da NpcSelectionSystem)
   */
  private selectNpc(npcEntity: any): void {
    // Disattiva attacco su qualsiasi selezione precedente
    this.deactivateAttackOnAnySelection();

    // Rimuovi selezione da tutti gli NPC
    this.deselectAllNpcs();

    // Aggiungi selezione al NPC selezionato
    this.ecs.addComponent(npcEntity, SelectedNpc, new SelectedNpc());

    // Log selezione
    const npc = this.ecs.getComponent(npcEntity, Npc);
    if (npc && this.logSystem) {
      this.logSystem.addLogMessage(`Selected target: ${npc.npcType}`, LogType.INFO, 1500);
    }
  }

  /**
   * Disattiva attacco su qualsiasi selezione NPC (chiamato quando cambia selezione)
   */
  private deactivateAttackOnAnySelection(): void {
    const playerControlSystem = this.ecs.systems?.find((system) =>
      system instanceof PlayerControlSystem
    ) as PlayerControlSystem | undefined;

    if (playerControlSystem) {
      playerControlSystem.deactivateAttack();
    }
  }

  /**
   * Deseleziona tutti gli NPC
   */
  private deselectAllNpcs(): void {
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    for (const npcEntity of selectedNpcs) {
      this.ecs.removeComponent(npcEntity, SelectedNpc);
    }
  }
}

