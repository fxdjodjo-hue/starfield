import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { Damage } from '../../entities/combat/Damage';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';
import { Camera } from '../../entities/spatial/Camera';
import { PlayerUpgrades } from '../../entities/player/PlayerUpgrades';
import { getPlayerDefinition } from '../../config/PlayerConfig';
import { CONFIG } from '../../utils/config/Config';

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
  private attackActivated = false; // Flag per tracciare se l'attacco è stato attivato con SPACE
  private lastInputTime = 0; // Timestamp dell'ultimo input per rispettare attack speed
  private lastNpcSelectionTime = 0; // Timestamp dell'ultima selezione NPC
  private onMinimapMovementComplete?: () => void;
  private isEnginePlaying = false;
  private engineSoundPromise: Promise<void> | null = null;

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
      this.handleSpacePress();
    }
  }

  /**
   * Gestisce il rilascio dei tasti
   */
  handleKeyRelease(key: string): void {
    if (key === 'Space') {
      this.spaceKeyPressed = false;
    }
  }

  /**
   * Gestisce la pressione del tasto SPACE per attivare/disattivare l'attacco
   */
  private handleSpacePress(): void {
    const now = Date.now();
    const playerCooldown = this.getPlayerAttackCooldown();

    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);

    if (selectedNpcs.length > 0) {
      if (this.attackActivated) {
        // Disattivazione sempre immediata - giocatore deve poter smettere quando vuole
        this.attackActivated = false;
        console.log('[PlayerControl] Attack deactivated immediately');
        this.stopCombatIfActive();
      } else {
        // Riattivazione con cooldown per prevenire spam
        if (now - this.lastInputTime >= playerCooldown) {
          // Controlla che l'attacco sia attivato dopo l'ultima selezione NPC
          // per evitare auto-attacco quando si cambia selezione
          if (now - this.lastNpcSelectionTime >= 100) { // 100ms di tolleranza
            this.attackActivated = true;
            this.lastInputTime = now;
            console.log('[PlayerControl] Attack activated for current NPC selection');
          } else {
            console.log('[PlayerControl] Attack blocked - NPC selection too recent');
          }
        } else {
          // Cooldown attivo - mostra tempo rimanente
          const remaining = playerCooldown - (now - this.lastInputTime);
          console.log(`[PlayerControl] Reactivation blocked - ${remaining}ms remaining`);
        }
      }
    } else {
      // Nessun NPC selezionato
      this.attackActivated = false;
      console.log('[PlayerControl] No NPC selected');
    }
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
    // console.log(`[PlayerControl] isAttackActivated called: ${this.attackActivated}`);
    return this.attackActivated;
  }

  /**
   * Disattiva forzatamente l'attacco (chiamato quando finisce il combattimento o cambia selezione)
   */
  deactivateAttack(): void {
    if (this.attackActivated) {
      this.attackActivated = false;
      console.log('[PlayerControl] Attack auto-deactivated after combat end');

      // Ferma immediatamente qualsiasi combattimento in corso
      this.stopCombatIfActive();
    }
  }

  /**
   * Chiamato quando viene selezionato un nuovo NPC
   */
  public onNpcSelected(): void {
    this.lastNpcSelectionTime = Date.now();
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

      // Fade in graduale
      this.audioSystem.fadeInSound('engine', 800, 0.08);
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

    const isMoving = (this.minimapTargetX !== null && this.minimapTargetY !== null) || this.isMousePressed;

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

    // Priorità: movimento minimappa > movimento mouse > fermo
    if (this.minimapTargetX !== null && this.minimapTargetY !== null) {
      this.movePlayerTowardsMinimapTarget();
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
}

