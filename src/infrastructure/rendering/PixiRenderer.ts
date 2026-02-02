import { Application, Container, Assets, Sprite, Texture, TextureStyle } from 'pixi.js';
import { DisplayManager } from '../display/DisplayManager';
import { CONFIG } from '../../core/utils/config/GameConfig';

/**
 * Wrapper cor around PixiJS Application
 * Handles canvas initialization, resizing, and scene graph structure
 */
export class PixiRenderer {
    private static instance: PixiRenderer;
    private app: Application | null = null;
    private backgroundContainer: Container;
    private worldContainer: Container;
    private uiContainer: Container;
    private initialized: boolean = false;
    private displayManager: DisplayManager;

    private constructor() {
        this.displayManager = DisplayManager.getInstance();
        this.backgroundContainer = new Container();
        this.worldContainer = new Container();
        this.worldContainer.sortableChildren = true;

        this.uiContainer = new Container();
        this.uiContainer.sortableChildren = true;

        // Set default scale mode to NEAREST for pixel art look
        TextureStyle.defaultOptions.scaleMode = 'nearest';
    }

    static getInstance(): PixiRenderer {
        if (!PixiRenderer.instance) {
            PixiRenderer.instance = new PixiRenderer();
        }
        return PixiRenderer.instance;
    }

    /**
     * Initializes the PixiJS Application on the existing canvas or creates a new one
     */
    async initialize(canvasId: string): Promise<void> {
        if (this.initialized) return;

        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) {
            console.error('[PixiRenderer] Canvas element not found:', canvasId);
            return;
        }


        const logicalSize = this.displayManager.getLogicalSize();
        const dpr = this.displayManager.getDevicePixelRatio();

        // PixiJS v8 Application setup
        this.app = new Application();

        try {
            await this.app.init({
                canvas: canvas,
                width: logicalSize.width,
                height: logicalSize.height,
                resolution: dpr,
                autoDensity: true,
                backgroundAlpha: 1, // Full alpha for background clear
                background: 0x000011, // Match StartState background (Hex number)
                antialias: false,
                // Robustness settings
                preference: 'webgl', // Improve compatibility (WebGL1 fallback)
                failIfMajorPerformanceCaveat: false, // Allow software rendering/slow GPU
                hello: true, // Print Pixi banner for confirmation
                ...({ stencil: true } as any) // Force stencil buffer (missing in v8 types)
            });

            this.initialized = true;

            // Set up scene graph
            this.backgroundContainer = new Container();
            this.backgroundContainer.label = 'BackgroundContainer';

            this.worldContainer = new Container();
            this.worldContainer.label = 'WorldContainer';
            this.worldContainer.sortableChildren = true;

            this.uiContainer = new Container();
            this.uiContainer.label = 'UiContainer';
            this.uiContainer.sortableChildren = true;

            this.app.stage.addChild(this.backgroundContainer); // Index 0 (Back)
            this.app.stage.addChild(this.worldContainer);      // Index 1 (Middle)
            this.app.stage.addChild(this.uiContainer);         // Index 2 (Front)

            // Hook into DisplayManager resize events
            this.displayManager.onResize((info) => {
                if (this.app) {
                    this.app.renderer.resize(info.logical.width, info.logical.height);
                    this.app.renderer.resolution = info.dpr;
                }
            });

            // Set default texture options for pixel art
            TextureStyle.defaultOptions.scaleMode = 'nearest';

            console.log('[PixiRenderer] Initialization successful', {
                rendererType: this.app.renderer.type,
                name: this.app.renderer.name
            });

        } catch (e) {
            console.error('[PixiRenderer] Failed to initialize PixiJS application:', e);
            throw e; // Re-throw to be caught by Game.ts
        }
    }

    /**
     * Get the main Pixi Application
     */
    getApp(): Application {
        if (!this.app) throw new Error('PixiRenderer not initialized');
        return this.app;
    }

    /**
     * Get the container for world entities (camera moves this)
     */
    getWorldContainer(): Container {
        return this.worldContainer;
    }

    /**
     * Get the container for background elements (parallax stars)
     * Renders BEHIND the world container.
     */
    getBackgroundContainer(): Container {
        return this.backgroundContainer;
    }

    /**
     * Get the container for UI elements (static)
     */
    getUIContainer(): Container {
        return this.uiContainer;
    }
}
