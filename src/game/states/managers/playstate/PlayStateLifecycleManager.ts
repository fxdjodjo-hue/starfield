import type { World } from '../../../../infrastructure/engine/World';
import type { ClientNetworkSystem } from '../../../../multiplayer/client/ClientNetworkSystem';
import type { UiSystem } from '../../../../systems/ui/UiSystem';
import type { Entity } from '../../../../infrastructure/ecs/Entity';

/**
 * Manages PlayState lifecycle: update, render, exit, pause, resume
 */
export class PlayStateLifecycleManager {
  constructor(
    private readonly world: World,
    private readonly getClientNetworkSystem: () => ClientNetworkSystem | null,
    private readonly getUiSystem: () => UiSystem | null,
    private readonly getPlayerEntity: () => Entity | null,
    private readonly updateNicknamePosition: () => void,
    private readonly updateNpcNicknames: () => void,
    private readonly updateRemotePlayerNicknames: () => void
  ) {}

  /**
   * Updates the gameplay
   */
  update(deltaTime: number): void {
    // Aggiorna il mondo di gioco
    this.world.update(deltaTime);

    // Aggiorna posizione del nickname del player
    this.updateNicknamePosition();

    // Aggiorna posizioni nickname NPC e remote player
    this.updateNpcNicknames();
    this.updateRemotePlayerNicknames();

    // Aggiorna il sistema di rete multiplayer
    const clientNetworkSystem = this.getClientNetworkSystem();
    if (clientNetworkSystem) {
      clientNetworkSystem.update(deltaTime);
    }
  }

  /**
   * Renders the game
   */
  render(_ctx: CanvasRenderingContext2D): void {
    // Renderizza il mondo di gioco
    this.world.render();
  }

  /**
   * Handles game input
   */
  handleInput(_event: Event): void {
    // Gli input sono gestiti dai sistemi ECS (InputSystem)
    // Questo metodo è disponibile per input speciali se necessario
  }

  /**
   * Exits the gameplay
   */
  exit(): void {
    const uiSystem = this.getUiSystem();
    const audioSystem = this.getClientNetworkSystem()?.getAudioSystem?.();

    // Ferma musica di background e suoni ambientali
    if (audioSystem) {
      audioSystem.stopSound('background');
      audioSystem.stopSound('ambience');
    }

    // Cleanup completo dell'HUD
    if (uiSystem) {
      uiSystem.destroy();
      uiSystem.showMainTitle();
    }
  }
}
