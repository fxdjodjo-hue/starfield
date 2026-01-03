/**
 * Component for map background rendering
 * Holds the background image and rendering properties
 */
export class MapBackground {
  public image: HTMLImageElement;
  public width: number;
  public height: number;

  constructor(image: HTMLImageElement) {
    this.image = image;
    this.width = image.width;
    this.height = image.height;
  }

  /**
   * Check if the background image is loaded
   */
  isLoaded(): boolean {
    return this.image.complete && this.image.naturalWidth !== 0;
  }
}
