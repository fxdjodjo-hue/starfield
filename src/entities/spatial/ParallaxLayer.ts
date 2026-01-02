import { Component } from '/src/infrastructure/ecs/Component';

/**
 * Componente ParallaxLayer - gestisce elementi con effetto parallax
 * Gli elementi si muovono a velocità diverse rispetto alla camera per creare profondità
 */
export class ParallaxLayer extends Component {
  public speedX: number;      // Velocità orizzontale (0 = fisso, 1 = segue camera)
  public speedY: number;      // Velocità verticale (0 = fisso, 1 = segue camera)
  public offsetX: number;     // Offset orizzontale iniziale
  public offsetY: number;     // Offset verticale iniziale
  public zIndex: number;      // Ordine di rendering (più alto = sopra)

  constructor(
    speedX: number = 1.0,
    speedY: number = 1.0,
    offsetX: number = 0,
    offsetY: number = 0,
    zIndex: number = 0
  ) {
    super();
    this.speedX = speedX;
    this.speedY = speedY;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.zIndex = zIndex;
  }

  /**
   * Imposta velocità parallax
   */
  setSpeed(speedX: number, speedY: number): void {
    this.speedX = speedX;
    this.speedY = speedY;
  }

  /**
   * Imposta offset iniziale
   */
  setOffset(offsetX: number, offsetY: number): void {
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }
}
