import { AssetManager } from '../AssetManager';

export class GameContext {
  public playerNickname: string = '';
  public canvas: HTMLCanvasElement;
  public gameContainer: HTMLElement;
  public assetManager: AssetManager;

  constructor(canvas: HTMLCanvasElement, gameContainer: HTMLElement) {
    this.canvas = canvas;
    this.gameContainer = gameContainer;
    this.assetManager = new AssetManager();
  }
}
