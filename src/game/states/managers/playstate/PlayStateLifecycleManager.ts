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
    private readonly updateRemotePlayerNicknames: () => void,
    private readonly updatePetNicknames: () => void
  ) { }

  /**
   * Updates the gameplay
   */
  update(deltaTime: number): void {
    // Aggiorna il mondo di gioco
    this.world.update(deltaTime);

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
    // FIRST: Render the world (this runs InterpolationSystem.render() which updates positions)
    this.world.render();

    // THEN: Sync nickname positions with the updated interpolated positions
    // This order is critical - if nicknames are updated before interpolation,
    // they lag 1 frame behind the ship, causing visible stuttering
    this.updateNicknamePosition();
    this.updateNpcNicknames();
    this.updateRemotePlayerNicknames();
    this.updatePetNicknames();
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
