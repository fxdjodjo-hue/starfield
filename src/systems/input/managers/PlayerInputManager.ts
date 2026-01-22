import type { ECS } from '../../../infrastructure/ecs/ECS';

/**
 * Manages player input (keyboard, mouse)
 */
export class PlayerInputManager {
  private isMousePressed: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private keysPressed: Set<string> = new Set();
  private inputDisabled: boolean = false;

  constructor(
    private readonly ecs: ECS,
    private readonly onSpacePress: () => void,
    private readonly onMouseStateCallback?: (pressed: boolean, x: number, y: number) => void
  ) {}

  /**
   * Abilita o disabilita l'input del player
   */
  setInputDisabled(disabled: boolean): void {
    this.inputDisabled = disabled;
    if (disabled) {
      // Cancella tutti i tasti premuti quando disabilitiamo l'input
      this.keysPressed.clear();
      this.isMousePressed = false;
    }
  }

  /**
   * Handles key press
   */
  handleKeyPress(key: string): void {
    if (this.inputDisabled) return;

    if (key === 'Space') {
      this.onSpacePress();
    } else {
      this.keysPressed.add(key.toLowerCase());
    }
  }

  /**
   * Handles key release (only for movement keys)
   */
  handleKeyRelease(key: string): void {
    if (this.inputDisabled) return;

    if (key !== 'Space') {
      this.keysPressed.delete(key.toLowerCase());
    }
  }

  /**
   * Handles mouse state (pressed/released)
   */
  handleMouseState(pressed: boolean, x: number, y: number): void {
    if (this.inputDisabled) return;

    this.isMousePressed = pressed;
    if (pressed) {
      this.lastMouseX = x;
      this.lastMouseY = y;
    }

    if (this.onMouseStateCallback) {
      this.onMouseStateCallback(pressed, x, y);
    }
  }

  /**
   * Handles mouse move while pressed
   */
  handleMouseMoveWhilePressed(x: number, y: number): void {
    if (!this.isMousePressed) return;

    this.lastMouseX = x;
    this.lastMouseY = y;
  }

  /**
   * Checks if keyboard movement keys are pressed
   */
  isKeyboardMoving(): boolean {
    return this.keysPressed.has('w') || this.keysPressed.has('a') ||
           this.keysPressed.has('s') || this.keysPressed.has('d');
  }

  /**
   * Gets mouse pressed state
   */
  getIsMousePressed(): boolean {
    return this.isMousePressed;
  }

  /**
   * Sets mouse pressed state
   */
  setIsMousePressed(pressed: boolean): void {
    this.isMousePressed = pressed;
  }

  /**
   * Gets last mouse X position
   */
  getLastMouseX(): number {
    return this.lastMouseX;
  }

  /**
   * Gets last mouse Y position
   */
  getLastMouseY(): number {
    return this.lastMouseY;
  }

  /**
   * Gets pressed keys set
   */
  getKeysPressed(): Set<string> {
    return this.keysPressed;
  }
}
