interface CustomScrollBarControllerOptions {
  scrollElement: HTMLElement;
  railWidth?: number;
  railTop?: number;
  railRight?: number;
  railBottom?: number;
  minThumbHeight?: number;
}

interface ScrollMetrics {
  hasOverflow: boolean;
  scrollRange: number;
  thumbTravel: number;
}

export class CustomScrollBarController {
  private static readonly HIDDEN_SCROLLBAR_CLASS = 'custom-scrollbar-host';
  private static readonly STYLE_ID = 'custom-scrollbar-controller-style';

  private readonly scrollElement: HTMLElement;
  private readonly rail: HTMLDivElement;
  private readonly thumb: HTMLDivElement;
  private readonly minThumbHeight: number;

  private isDragging: boolean = false;
  private dragStartClientY: number = 0;
  private dragStartScrollTop: number = 0;
  private dragScrollRange: number = 1;
  private dragThumbTravel: number = 1;

  private readonly scrollHandler = () => this.updateThumb();
  private readonly resizeHandler = () => this.updateThumb();
  private readonly thumbMouseDownHandler = (event: MouseEvent) => this.handleThumbMouseDown(event);
  private readonly railMouseDownHandler = (event: MouseEvent) => this.handleRailMouseDown(event);
  private readonly documentMouseMoveHandler = (event: MouseEvent) => this.handleDocumentMouseMove(event);
  private readonly documentMouseUpHandler = () => this.handleDocumentMouseUp();

  constructor(options: CustomScrollBarControllerOptions) {
    this.ensureGlobalStyle();

    this.scrollElement = options.scrollElement;
    this.minThumbHeight = Math.max(12, Math.round(options.minThumbHeight ?? 24));

    this.scrollElement.classList.add(CustomScrollBarController.HIDDEN_SCROLLBAR_CLASS);
    if (window.getComputedStyle(this.scrollElement).position === 'static') {
      this.scrollElement.style.position = 'relative';
    }

    const railWidth = Math.max(6, Math.round(options.railWidth ?? 8));
    const railTop = Math.max(0, Math.round(options.railTop ?? 4));
    const railRight = Math.max(0, Math.round(options.railRight ?? 1));
    const railBottom = Math.max(0, Math.round(options.railBottom ?? 4));

    this.rail = document.createElement('div');
    this.rail.style.cssText = `
      position: absolute;
      top: ${railTop}px;
      right: ${railRight}px;
      bottom: ${railBottom}px;
      width: ${railWidth}px;
      border-radius: 999px;
      border: 1px solid rgba(186, 230, 253, 0.18);
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.42), rgba(2, 6, 23, 0.68));
      box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.35);
      box-sizing: border-box;
      opacity: 0;
      transition: opacity 0.16s ease;
      z-index: 5;
      pointer-events: none;
    `;

    this.thumb = document.createElement('div');
    this.thumb.style.cssText = `
      position: absolute;
      left: 1px;
      right: 1px;
      top: 0;
      height: ${this.minThumbHeight}px;
      border-radius: 999px;
      border: 1px solid rgba(186, 230, 253, 0.56);
      background: linear-gradient(180deg, rgba(125, 211, 252, 0.92), rgba(56, 189, 248, 0.86));
      box-shadow: 0 0 12px rgba(56, 189, 248, 0.24);
      cursor: grab;
      transform: translateY(0);
      box-sizing: border-box;
    `;

    this.rail.appendChild(this.thumb);
    this.scrollElement.appendChild(this.rail);

    this.scrollElement.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('resize', this.resizeHandler);
    this.thumb.addEventListener('mousedown', this.thumbMouseDownHandler);
    this.rail.addEventListener('mousedown', this.railMouseDownHandler);

    this.updateThumb();
  }

  refresh(): void {
    this.updateThumb();
  }

  destroy(): void {
    this.scrollElement.removeEventListener('scroll', this.scrollHandler);
    window.removeEventListener('resize', this.resizeHandler);
    this.thumb.removeEventListener('mousedown', this.thumbMouseDownHandler);
    this.rail.removeEventListener('mousedown', this.railMouseDownHandler);
    this.stopDragging();

    if (this.rail.parentElement === this.scrollElement) {
      this.scrollElement.removeChild(this.rail);
    }
  }

  private ensureGlobalStyle(): void {
    if (typeof document === 'undefined') return;
    if (document.getElementById(CustomScrollBarController.STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = CustomScrollBarController.STYLE_ID;
    style.textContent = `
      .${CustomScrollBarController.HIDDEN_SCROLLBAR_CLASS} {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .${CustomScrollBarController.HIDDEN_SCROLLBAR_CLASS}::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
      }
    `;
    document.head.appendChild(style);
  }

  private handleThumbMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.beginDragging(event.clientY);
  }

  private handleRailMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    if (event.target === this.thumb) return;
    event.preventDefault();
    event.stopPropagation();

    this.scrollToPointer(event.clientY);
    this.beginDragging(event.clientY);
  }

  private beginDragging(clientY: number): void {
    const metrics = this.getScrollMetrics();
    if (!metrics.hasOverflow) return;

    this.isDragging = true;
    this.dragStartClientY = clientY;
    this.dragStartScrollTop = this.scrollElement.scrollTop;
    this.dragScrollRange = Math.max(1, metrics.scrollRange);
    this.dragThumbTravel = Math.max(1, metrics.thumbTravel);
    this.thumb.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', this.documentMouseMoveHandler);
    document.addEventListener('mouseup', this.documentMouseUpHandler);
  }

  private handleDocumentMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;

    const deltaY = event.clientY - this.dragStartClientY;
    const scrollDelta = (deltaY * this.dragScrollRange) / this.dragThumbTravel;
    this.scrollElement.scrollTop = this.dragStartScrollTop + scrollDelta;
    this.updateThumb();
  }

  private handleDocumentMouseUp(): void {
    this.stopDragging();
  }

  private stopDragging(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.thumb.style.cursor = 'grab';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', this.documentMouseMoveHandler);
    document.removeEventListener('mouseup', this.documentMouseUpHandler);
  }

  private scrollToPointer(clientY: number): void {
    const metrics = this.getScrollMetrics();
    if (!metrics.hasOverflow) return;

    const railRect = this.rail.getBoundingClientRect();
    const thumbHeight = this.thumb.offsetHeight;
    const pointerInsideRail = clientY - railRect.top;
    const thumbCenterAligned = pointerInsideRail - (thumbHeight / 2);
    const clampedThumbTop = Math.min(Math.max(0, thumbCenterAligned), metrics.thumbTravel);
    const scrollRatio = metrics.thumbTravel <= 0 ? 0 : (clampedThumbTop / metrics.thumbTravel);
    this.scrollElement.scrollTop = scrollRatio * metrics.scrollRange;
    this.updateThumb();
  }

  private getScrollMetrics(): ScrollMetrics {
    const visibleHeight = this.scrollElement.clientHeight;
    const totalHeight = this.scrollElement.scrollHeight;
    const hasOverflow = totalHeight > visibleHeight + 1;
    const scrollRange = Math.max(0, totalHeight - visibleHeight);
    const thumbTravel = Math.max(0, this.rail.clientHeight - this.thumb.offsetHeight);

    return { hasOverflow, scrollRange, thumbTravel };
  }

  private updateThumb(): void {
    const visibleHeight = this.scrollElement.clientHeight;
    const totalHeight = this.scrollElement.scrollHeight;
    const hasOverflow = totalHeight > visibleHeight + 1;

    if (!hasOverflow || visibleHeight <= 0 || this.rail.clientHeight <= 0) {
      this.rail.style.opacity = '0';
      this.rail.style.pointerEvents = 'none';
      this.thumb.style.transform = 'translateY(0)';
      return;
    }

    this.rail.style.opacity = '1';
    this.rail.style.pointerEvents = 'auto';

    const railHeight = this.rail.clientHeight;
    const rawThumbHeight = railHeight * (visibleHeight / totalHeight);
    const thumbHeight = Math.min(railHeight, Math.max(this.minThumbHeight, Math.round(rawThumbHeight)));
    this.thumb.style.height = `${thumbHeight}px`;

    const scrollRange = Math.max(1, totalHeight - visibleHeight);
    const thumbTravel = Math.max(0, railHeight - thumbHeight);
    const progress = Math.min(1, Math.max(0, this.scrollElement.scrollTop / scrollRange));
    this.thumb.style.transform = `translateY(${Math.round(thumbTravel * progress)}px)`;
  }
}
