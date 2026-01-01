/**
 * Classe utility per gestire input del mouse
 * Fornisce metodi helper per coordinate e stati del mouse
 */
export class MouseInput {
  private canvas: HTMLCanvasElement;
  private position = { x: 0, y: 0 };
  private buttons = new Set<number>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupEventListeners();
  }

  /**
   * Restituisce la posizione del mouse nel canvas
   */
  getPosition(): { x: number; y: number } {
    return { ...this.position };
  }

  /**
   * Verifica se un pulsante del mouse è premuto
   */
  isButtonPressed(button: number): boolean {
    return this.buttons.has(button);
  }

  /**
   * Verifica se il click sinistro è premuto
   */
  isLeftButtonPressed(): boolean {
    return this.isButtonPressed(0);
  }

  /**
   * Verifica se il click destro è premuto
   */
  isRightButtonPressed(): boolean {
    return this.isButtonPressed(2);
  }

  /**
   * Converte coordinate schermo in coordinate canvas
   */
  private getCanvasCoordinates(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  /**
   * Setup degli event listener
   */
  private setupEventListeners(): void {
    // Mouse move
    this.canvas.addEventListener('mousemove', (event) => {
      const coords = this.getCanvasCoordinates(event.clientX, event.clientY);
      this.position.x = coords.x;
      this.position.y = coords.y;
    });

    // Mouse down
    this.canvas.addEventListener('mousedown', (event) => {
      this.buttons.add(event.button);
    });

    // Mouse up
    this.canvas.addEventListener('mouseup', (event) => {
      this.buttons.delete(event.button);
    });

    // Mouse leave (rilascia tutti i pulsanti)
    this.canvas.addEventListener('mouseleave', () => {
      this.buttons.clear();
    });
  }
}
