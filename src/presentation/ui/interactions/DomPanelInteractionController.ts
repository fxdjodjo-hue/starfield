import {
  clampPanelPositionToViewport,
  clampPanelSizeToViewport,
  type PanelPosition,
  type PanelSize
} from './PanelLayoutMath';

interface DomPanelInteractionControllerOptions {
  container: HTMLElement;
  dragHandle: HTMLElement | null;
  minWidth?: number;
  minHeight?: number;
  enableNativeResize?: boolean;
  blockInteractiveSelector?: string;
  onPositionChanged?: (position: PanelPosition) => void;
  onSizeChanged?: (size: PanelSize) => void;
}

type NativeResizeMode = 'none' | 'both' | 'horizontal' | 'vertical';

export class DomPanelInteractionController {
  private static readonly SUPPRESS_CLICK_DATASET_KEY = 'panelSuppressClick';

  private readonly container: HTMLElement;
  private readonly dragHandle: HTMLElement | null;
  private minWidth: number;
  private minHeight: number;
  private readonly enableNativeResize: boolean;
  private nativeResizeMode: NativeResizeMode;
  private readonly blockInteractiveSelector: string;
  private readonly onPositionChanged: ((position: PanelPosition) => void) | null;
  private readonly onSizeChanged: ((size: PanelSize) => void) | null;

  private isDragging: boolean = false;
  private dragMoved: boolean = false;
  private dragStartPointerX: number = 0;
  private dragStartPointerY: number = 0;
  private dragStartLeft: number = 0;
  private dragStartTop: number = 0;
  private dragPreviousTransition: string = '';
  private hasManualPosition: boolean = false;
  private hasManualSize: boolean = false;
  private manualLeft: number = 0;
  private manualTop: number = 0;
  private manualWidth: number = 0;
  private manualHeight: number = 0;
  private suppressClickTimeout: ReturnType<typeof setTimeout> | null = null;

  private readonly dragStartHandler = (event: MouseEvent) => this.handleDragStart(event);
  private readonly dragMoveHandler = (event: MouseEvent) => this.handleDragMove(event);
  private readonly dragEndHandler = () => this.handleDragEnd();
  private readonly resizeSyncHandler = () => this.syncNativeResizedDimensions();
  private readonly viewportResizeHandler = () => this.ensureContainerWithinViewport();

  constructor(options: DomPanelInteractionControllerOptions) {
    this.container = options.container;
    this.dragHandle = options.dragHandle;
    this.minWidth = Math.max(1, Math.floor(Number(options.minWidth ?? 200)));
    this.minHeight = Math.max(1, Math.floor(Number(options.minHeight ?? 120)));
    this.enableNativeResize = options.enableNativeResize !== false;
    this.nativeResizeMode = this.enableNativeResize ? 'both' : 'none';
    this.blockInteractiveSelector = options.blockInteractiveSelector || 'button, input, textarea, select, a';
    this.onPositionChanged = options.onPositionChanged || null;
    this.onSizeChanged = options.onSizeChanged || null;

    this.setup();
  }

  static consumeSuppressedClick(container: HTMLElement | null | undefined): boolean {
    if (!container) return false;
    const suppressed = container.dataset[DomPanelInteractionController.SUPPRESS_CLICK_DATASET_KEY] === '1';
    if (suppressed) {
      delete container.dataset[DomPanelInteractionController.SUPPRESS_CLICK_DATASET_KEY];
    }
    return suppressed;
  }

  applyStoredLayout(): void {
    if (this.hasManualSize) {
      this.container.style.width = `${this.manualWidth}px`;
      this.container.style.height = `${this.manualHeight}px`;
    }

    if (this.hasManualPosition) {
      this.setManualPosition(this.manualLeft, this.manualTop);
    } else {
      this.ensureContainerWithinViewport();
    }
  }

  ensureContainerWithinViewport(): void {
    if (!this.isElementRendered()) return;

    const rect = this.container.getBoundingClientRect();
    const clamped = clampPanelPositionToViewport(
      { left: rect.left, top: rect.top },
      { width: rect.width, height: rect.height },
      this.getViewportSize()
    );

    if (clamped.left === rect.left && clamped.top === rect.top) return;
    this.setManualPosition(clamped.left, clamped.top);
  }

  destroy(): void {
    if (this.dragHandle) {
      this.dragHandle.removeEventListener('mousedown', this.dragStartHandler);
    }

    document.removeEventListener('mousemove', this.dragMoveHandler);
    document.removeEventListener('mouseup', this.dragEndHandler);
    document.removeEventListener('mouseup', this.resizeSyncHandler);
    window.removeEventListener('resize', this.viewportResizeHandler);

    if (this.suppressClickTimeout) {
      clearTimeout(this.suppressClickTimeout);
      this.suppressClickTimeout = null;
    }
  }

  setMinDimensions(minWidth: number, minHeight: number): void {
    this.minWidth = Math.max(1, Math.floor(Number(minWidth)));
    this.minHeight = Math.max(1, Math.floor(Number(minHeight)));

    this.container.style.minWidth = `${this.minWidth}px`;
    this.container.style.minHeight = `${this.minHeight}px`;
  }

  setNativeResizeEnabled(enabled: boolean): void {
    if (!this.enableNativeResize) return;
    this.nativeResizeMode = enabled ? 'both' : 'none';
    this.applyNativeResizeStyles();
  }

  setNativeResizeMode(mode: NativeResizeMode): void {
    if (!this.enableNativeResize) return;
    this.nativeResizeMode = mode;
    this.applyNativeResizeStyles();
  }

  private setup(): void {
    if (this.dragHandle) {
      this.dragHandle.addEventListener('mousedown', this.dragStartHandler);
    }

    if (this.enableNativeResize) {
      this.applyNativeResizeStyles();
      document.addEventListener('mouseup', this.resizeSyncHandler);
    }

    window.addEventListener('resize', this.viewportResizeHandler);
  }

  private applyNativeResizeStyles(): void {
    if (!this.enableNativeResize) return;
    switch (this.nativeResizeMode) {
      case 'horizontal':
        this.container.style.resize = 'horizontal';
        break;
      case 'vertical':
        this.container.style.resize = 'vertical';
        break;
      case 'none':
        this.container.style.resize = 'none';
        break;
      case 'both':
      default:
        this.container.style.resize = 'both';
        break;
    }
    this.container.style.overflow = 'hidden';
    this.container.style.minWidth = `${this.minWidth}px`;
    this.container.style.minHeight = `${this.minHeight}px`;
  }

  private handleDragStart(event: MouseEvent): void {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest(this.blockInteractiveSelector)) return;
    if (!this.isElementRendered()) return;

    const rect = this.container.getBoundingClientRect();
    this.isDragging = true;
    this.dragMoved = false;
    this.dragStartPointerX = event.clientX;
    this.dragStartPointerY = event.clientY;
    this.dragStartLeft = rect.left;
    this.dragStartTop = rect.top;
    this.dragPreviousTransition = this.container.style.transition;
    this.container.style.transition = 'none';

    document.addEventListener('mousemove', this.dragMoveHandler);
    document.addEventListener('mouseup', this.dragEndHandler);
    document.body.style.userSelect = 'none';
    event.preventDefault();
  }

  private handleDragMove(event: MouseEvent): void {
    if (!this.isDragging) return;

    const offsetX = event.clientX - this.dragStartPointerX;
    const offsetY = event.clientY - this.dragStartPointerY;
    if (!this.dragMoved && (Math.abs(offsetX) > 2 || Math.abs(offsetY) > 2)) {
      this.dragMoved = true;
    }

    this.setManualPosition(this.dragStartLeft + offsetX, this.dragStartTop + offsetY);
  }

  private handleDragEnd(): void {
    if (!this.isDragging) return;
    this.isDragging = false;

    document.removeEventListener('mousemove', this.dragMoveHandler);
    document.removeEventListener('mouseup', this.dragEndHandler);
    document.body.style.userSelect = '';
    this.container.style.transition = this.dragPreviousTransition;

    if (this.dragMoved) {
      this.container.dataset[DomPanelInteractionController.SUPPRESS_CLICK_DATASET_KEY] = '1';
      if (this.suppressClickTimeout) {
        clearTimeout(this.suppressClickTimeout);
      }
      this.suppressClickTimeout = setTimeout(() => {
        delete this.container.dataset[DomPanelInteractionController.SUPPRESS_CLICK_DATASET_KEY];
      }, 120);
    }
  }

  private syncNativeResizedDimensions(): void {
    if (!this.enableNativeResize || this.nativeResizeMode === 'none' || this.isDragging || !this.isElementRendered()) return;

    const rect = this.container.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;

    const clampedSize = clampPanelSizeToViewport(
      {
        width: Math.max(this.minWidth, Math.round(this.container.offsetWidth)),
        height: Math.max(this.minHeight, Math.round(this.container.offsetHeight))
      },
      { width: this.minWidth, height: this.minHeight },
      this.getViewportSize()
    );

    const hasChanged = !this.hasManualSize
      || this.manualWidth !== clampedSize.width
      || this.manualHeight !== clampedSize.height;

    if (!hasChanged) return;

    this.manualWidth = clampedSize.width;
    this.manualHeight = clampedSize.height;
    this.hasManualSize = true;
    this.container.style.width = `${clampedSize.width}px`;
    this.container.style.height = `${clampedSize.height}px`;

    if (!this.hasManualPosition) {
      this.manualLeft = rect.left;
      this.manualTop = rect.top;
      this.hasManualPosition = true;
    }

    this.ensureContainerWithinViewport();
    if (this.onSizeChanged) {
      this.onSizeChanged({ width: clampedSize.width, height: clampedSize.height });
    }
  }

  private setManualPosition(left: number, top: number): void {
    const currentSize = this.getCurrentPanelSize();
    const clamped = clampPanelPositionToViewport(
      { left, top },
      currentSize,
      this.getViewportSize()
    );

    this.manualLeft = clamped.left;
    this.manualTop = clamped.top;
    this.hasManualPosition = true;
    this.container.style.left = `${clamped.left}px`;
    this.container.style.top = `${clamped.top}px`;
    this.container.style.right = 'auto';
    this.container.style.bottom = 'auto';

    if (this.onPositionChanged) {
      this.onPositionChanged({ left: clamped.left, top: clamped.top });
    }
  }

  private getCurrentPanelSize(): PanelSize {
    const rect = this.container.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : Math.max(this.minWidth, this.container.offsetWidth || this.manualWidth || this.minWidth);
    const height = rect.height > 0 ? rect.height : Math.max(this.minHeight, this.container.offsetHeight || this.manualHeight || this.minHeight);
    return { width, height };
  }

  private getViewportSize(): { width: number; height: number } {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  private isElementRendered(): boolean {
    return this.container.style.display !== 'none';
  }
}
