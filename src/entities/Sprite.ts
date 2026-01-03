/**
 * Component for sprite rendering
 * Holds image data and rendering properties
 */
export class Sprite {
  public image: HTMLImageElement;
  public width: number;
  public height: number;
  public offsetX: number;
  public offsetY: number;

  constructor(image: HTMLImageElement, width?: number, height?: number, offsetX: number = 0, offsetY: number = 0) {
    this.image = image;
    this.width = width ?? image.width;
    this.height = height ?? image.height;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }

  /**
   * Check if the sprite image is loaded
   */
  isLoaded(): boolean {
    return this.image.complete && this.image.naturalWidth !== 0;
  }
}
