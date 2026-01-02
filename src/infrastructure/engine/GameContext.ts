export class GameContext {
  public playerNickname: string = '';
  public canvas: HTMLCanvasElement;
  public gameContainer: HTMLElement;

  constructor(canvas: HTMLCanvasElement, gameContainer: HTMLElement) {
    this.canvas = canvas;
    this.gameContainer = gameContainer;
  }
}
