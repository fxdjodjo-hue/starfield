import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';

/**
 * Sistema di input per mouse
 * Gestisce click sinistro e posizione del mouse
 */
export class InputSystem extends BaseSystem {
  private canvas: HTMLCanvasElement;
  private mousePosition = { x: 0, y: 0 };
  private isMouseDown = false;
  private onMouseState?: (pressed: boolean, x: number, y: number) => void;
  private onMouseMoveWhilePressed?: (x: number, y: number) => void;
  private onKeyPress?: (key: string) => void;

  constructor(ecs: ECS, canvas: HTMLCanvasElement) {
    super(ecs);
    this.canvas = canvas;
    this.setupEventListeners();
  }

  /**
   * Imposta il callback per lo stato del mouse
   */
  setMouseStateCallback(callback: (pressed: boolean, x: number, y: number) => void): void {
    this.onMouseState = callback;
  }

  /**
   * Imposta il callback per il movimento del mouse mentre è premuto
   */
  setMouseMoveWhilePressedCallback(callback: (x: number, y: number) => void): void {
    this.onMouseMoveWhilePressed = callback;
  }

  /**
   * Imposta il callback per la pressione dei tasti
   */
  setKeyPressCallback(callback: (key: string) => void): void {
    this.onKeyPress = callback;
  }


  update(deltaTime: number): void {
    // Per ora non c'è logica di update specifica
    // In futuro potrebbe gestire input continuo
  }

  /**
   * Restituisce la posizione attuale del mouse
   */
  getMousePosition(): { x: number; y: number } {
    return { ...this.mousePosition };
  }

  /**
   * Verifica se il mouse è premuto
   */
  isMousePressed(): boolean {
    return this.isMouseDown;
  }

  /**
   * Setup degli event listener per mouse
   */
  private setupEventListeners(): void {
    // Mouse move
    this.canvas.addEventListener('mousemove', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePosition.x = event.clientX - rect.left;
      this.mousePosition.y = event.clientY - rect.top;

      // Se il mouse è premuto, notifica il movimento
      if (this.isMouseDown) {
        this.onMouseMoveWhilePressed?.(this.mousePosition.x, this.mousePosition.y);
      }
    });

    // Mouse down
    this.canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) { // Click sinistro
        this.isMouseDown = true;
        this.onMouseState?.(true, this.mousePosition.x, this.mousePosition.y);
      }
    });

    // Mouse up
    this.canvas.addEventListener('mouseup', (event) => {
      if (event.button === 0) {
        this.isMouseDown = false;
        this.onMouseState?.(false, this.mousePosition.x, this.mousePosition.y);
      }
    });

    // Gestione tastiera
    window.addEventListener('keydown', (event) => {
      // Preveniamo comportamenti di default per alcuni tasti
      if (event.code === 'Space') {
        event.preventDefault();
        this.onKeyPress?.('Space');
      }
    });

    // Previene context menu
    this.canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
  }
}
