import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { Sprite as EcsSprite } from '../../entities/Sprite';
import { AnimatedSprite as EcsAnimatedSprite } from '../../entities/AnimatedSprite';
import { CameraSystem } from './CameraSystem';
import { PixiRenderer } from '../../infrastructure/rendering/PixiRenderer';
import { DisplayManager } from '../../infrastructure/display/DisplayManager';
import { Sprite, Texture, Container, AnimatedSprite, Rectangle, Graphics, Text, TextStyle } from 'pixi.js';
import { Projectile } from '../../entities/combat/Projectile';
import { Health } from '../../entities/combat/Health'; // Import Health
import { Shield } from '../../entities/combat/Shield'; // Import Shield
import { Npc } from '../../entities/ai/Npc'; // Import Npc
import { RemotePlayer } from '../../entities/player/RemotePlayer'; // Import RemotePlayer
import { Velocity } from '../../entities/spatial/Velocity'; // Import Velocity
import { Explosion } from '../../entities/combat/Explosion'; // Import Explosion
import { DamageText } from '../../entities/combat/DamageText'; // Import DamageText
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget'; // Import InterpolationTarget
import { NumberFormatter } from '../../core/utils/ui/NumberFormatter'; // Import NumberFormatter
import { ParallaxLayer } from '../../entities/spatial/ParallaxLayer'; // Import ParallaxLayer

/**
 * PixiRenderSystem - Replaces RenderSystem
 * Synchronizes ECS entities with PixiJS Scene Graph
 */
export class PixiRenderSystem extends System {
    private pixiRenderer: PixiRenderer;
    private cameraSystem: CameraSystem;
    private displayManager: DisplayManager;

    // Map ECS Entity ID -> Pixi Sprite/Container
    private spriteMap: Map<number, Sprite | Container | AnimatedSprite> = new Map();

    // Texture Cache map (URL -> Texture)
    private textureCache: Map<string, Texture> = new Map();

    // State for Engine Flames
    private engflamesSprite: EcsAnimatedSprite | null = null;
    private engflamesOpacity: number = 0;
    private engflamesAnimationTime: number = 0;
    private readonly ENGFLAMES_FADE_SPEED = 0.15;

    // Cache for Player ID to fast-track logic
    private playerId: number | null = null;

    // Static access to player position for UI synchronization (replacing RenderSystem legacy)
    public static smoothedLocalPlayerPos: { x: number; y: number } | null = null;
    public static smoothedLocalPlayerId: number | null = null;

    constructor(ecs: ECS, cameraSystem: CameraSystem) {
        super(ecs);
        this.cameraSystem = cameraSystem;
        this.pixiRenderer = PixiRenderer.getInstance();
        this.displayManager = DisplayManager.getInstance();
    }

    /**
     * Initialize Pixi (if not already done)
     */
    async initialize(): Promise<void> {
        // Assume 'game-canvas' is the ID used in index.html
        await this.pixiRenderer.initialize('game-canvas');
        console.log('[PixiRenderSystem] Initialized');
    }

    // Layout: Internal render loop timer
    private lastRenderTimestamp: number = 0;
    private hasLoggedPlayerCheck: boolean = false; // ONE-SHOT DEBUG FLAG

    /**
     * Update - Logic Phase (Fixed Step)
     * Used only for logic-bound updates, not visual sync.
     */
    update(_deltaTime: number): void {
        // No-op for visual sync. Moved to render().

        // Note: CameraSystem.updateForRender is called in render()
    }

    /**
     * Render - Visual Phase (Variable Step)
     * Synchronizes ECS entities with PixiJS Scene Graph.
     * Called every frame by ECS.render().
     */
    render(_ctx: CanvasRenderingContext2D): void {
        // Calculate smooth delta time for rendering
        const now = performance.now();
        // Cap dt to avoid huge jumps on tab switch (max 100ms)
        const deltaTime = this.lastRenderTimestamp > 0 ? Math.min(now - this.lastRenderTimestamp, 100) : 16;
        this.lastRenderTimestamp = now;
        const worldContainer = this.pixiRenderer.getWorldContainer();
        const camera = this.cameraSystem.getCamera();
        const { width, height } = this.displayManager.getLogicalSize();

        this.engflamesAnimationTime += deltaTime;

        // 0. Update Camera Logic (Smoothing, Shake)
        this.cameraSystem.updateForRender(deltaTime);

        // 1. Update Camera Transform
        const zoom = camera.zoom;
        worldContainer.position.set(
            -camera.x * zoom + width / 2,
            -camera.y * zoom + height / 2
        );
        worldContainer.scale.set(zoom);

        // 2. Query Entities
        const entities = this.ecs.getEntitiesWithComponents(Transform);
        const activeEntityIds = new Set<number>();

        for (const entity of entities) {
            const transform = this.ecs.getComponent(entity, Transform);
            const ecsSprite = this.ecs.getComponent(entity, EcsSprite);
            const ecsAnimSprite = this.ecs.getComponent(entity, EcsAnimatedSprite);
            const projectile = this.ecs.getComponent(entity, Projectile);
            const explosion = this.ecs.getComponent(entity, Explosion); // Added explosion component
            const parallax = this.ecs.getComponent(entity, ParallaxLayer);

            // Skip entities handled by ParallaxSystem (backgrounds, clouds, etc)
            if (parallax) continue;

            // Skip if no visual component or no transform
            if ((!ecsSprite && !ecsAnimSprite && !explosion) || !transform) continue; // Modified condition

            activeEntityIds.add(entity.id);

            // Get or Create Pixi Sprite
            let pixiObject: Sprite | Container | AnimatedSprite | undefined = this.spriteMap.get(entity.id);

            const isPlayer = this.isPlayerEntity(entity);
            if (isPlayer) {
                this.playerId = entity.id;
                // Update static reference for dependent systems (DamageText, etc)
                PixiRenderSystem.smoothedLocalPlayerId = entity.id;
                PixiRenderSystem.smoothedLocalPlayerPos = { x: transform.x, y: transform.y };
            }

            // DEBUG: Analyze entities (Broad Sweep)
            if (!this.hasLoggedPlayerCheck) {
                this.hasLoggedPlayerCheck = true;
                const entityCount = entities.length || (entities as any).size;
                console.log(`[PixiRenderSystem] Debug Sweep: Found ${entityCount} entities with Transform.`);

                // Inspect first few entities
                let count = 0;
                for (const debugEntity of entities) {
                    if (count++ > 5) break;

                    const hasVel = this.ecs.hasComponent(debugEntity, Velocity);
                    const isNpc = this.ecs.hasComponent(debugEntity, Npc);
                    const isRemote = this.ecs.hasComponent(debugEntity, RemotePlayer);
                    const hasHealth = this.ecs.hasComponent(debugEntity, Health);
                    const hasShield = this.ecs.hasComponent(debugEntity, Shield);
                    const animSprite = this.ecs.getComponent(debugEntity, EcsAnimatedSprite);

                    console.log(`[PixiRenderSystem] Entity ${debugEntity.id}:`, {
                        isPlayer: this.isPlayerEntity(debugEntity),
                        hasVelocity: hasVel,
                        isNpc,
                        hasHealth,
                        hasAnimSprite: !!animSprite,
                        animSpriteLoaded: animSprite?.isLoaded(),
                        imgComplete: animSprite?.spritesheet?.image?.complete,
                        imgWidth: animSprite?.spritesheet?.image?.naturalWidth
                    });
                }
            }

            if (!pixiObject) {
                const created = this.createPixiObject(entity, ecsSprite || null, ecsAnimSprite || null, isPlayer, explosion || null);
                if (created) {
                    pixiObject = created;
                    this.spriteMap.set(entity.id, pixiObject);
                    worldContainer.addChild(pixiObject);
                    if (isPlayer) console.log('[PixiRenderSystem] Player Sprite Created!');
                } else if (isPlayer) {
                    // Removed warning to avoid spam if it retries every frame. Debug log above handles it.
                }
            } else if (isPlayer && Math.random() < 0.01) { // Debug log ~1% of frames
                console.log('[PixiRenderSystem] Player Render State:', {
                    pos: { x: transform.x.toFixed(1), y: transform.y.toFixed(1) },
                    pixiPos: { x: pixiObject.position.x.toFixed(1), y: pixiObject.position.y.toFixed(1) },
                    rotation: transform.rotation.toFixed(2),
                    visible: pixiObject.visible,
                    alpha: pixiObject.alpha,
                    scale: pixiObject.scale.x,
                    hasEngFlames: !!this.engflamesSprite,
                    visualType: (pixiObject instanceof Container) ? 'Container' : 'Sprite',
                    children: (pixiObject instanceof Container) ? pixiObject.children.length : 0,
                    camera: { x: camera.x.toFixed(1), y: camera.y.toFixed(1), zoom: camera.zoom.toFixed(2) }
                });
            }

            // Sync Properties (Position, Rotation, Scale)
            if (pixiObject) {
                // For remote entities (NPCs, remote players), use interpolated positions
                const interpolation = this.ecs.getComponent(entity, InterpolationTarget);
                let posX = transform.x;
                let posY = transform.y;
                let rotation = transform.rotation;

                if (interpolation) {
                    // Perform interpolation now (same logic as InterpolationSystem.render)
                    interpolation.interpolate(Date.now());
                    posX = interpolation.renderX;
                    posY = interpolation.renderY;
                    rotation = interpolation.renderRotation;
                }

                // Common Transform Sync
                pixiObject.position.set(posX, posY);
                pixiObject.scale.set(transform.scaleX || 1, transform.scaleY || 1);

                // Resolve Type: Container Wrapper vs Player vs Legacy Sprite
                const visualChild = (pixiObject instanceof Container) ? pixiObject.getChildByLabel('visual') as Sprite : null;

                if (visualChild) {
                    // 1. STANDARD WRAPPED ENTITY (NPC, Projectile, etc)

                    // Rotation Logic
                    if (projectile) {
                        const angle = Math.atan2(projectile.directionY, projectile.directionX);
                        pixiObject.rotation = angle;
                        visualChild.rotation = 0; // Reset visual rotation inside container
                    } else {
                        // Standard Entity Rotation
                        if (rotation !== 0) {
                            // Use interpolated or transform rotation
                            pixiObject.rotation = rotation;
                        } else {
                            // Fallback: Velocity-based rotation for local NPCs (like legacy RenderSystem)
                            const velocity = this.ecs.getComponent(entity, Velocity);
                            if (velocity && (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1)) {
                                pixiObject.rotation = Math.atan2(velocity.y, velocity.x);
                            } else {
                                pixiObject.rotation = transform.rotation;
                            }
                        }
                        // Optional: visualChild.rotation = ecsSprite?.rotationOffset || 0;
                    }

                    // Visual Update Logic
                    visualChild.anchor.set(0.5); // Ensure centered

                    if (ecsAnimSprite) {
                        const frameIndex = ecsAnimSprite.getFrameForRotation(rotation);
                        const textures = this.getFramesFromSpritesheet(ecsAnimSprite.spritesheet);
                        if (textures && textures[frameIndex]) {
                            visualChild.texture = textures[frameIndex];
                        }
                    } else if (explosion) {
                        // Explosion inside Container? (Future proofing)
                    }
                    // Note: Standard Sprite texture is static, no need to update per frame unless needed
                }
                else if (pixiObject instanceof Container && isPlayer) {
                    // 2. PLAYER ENTITY (Complex Structure: [Flames, Ship])
                    // Note: This relies on fixed index structure from createPixiObject

                    // Allow container to rotate? No, player rotation is often visual-only or handled specifically?
                    // Existing logic had container rotation = 0? 
                    // "Here we are inside container rotated at 0 (world relative)." from comments.
                    // So we do NOT rotate pixiObject (Container).
                    pixiObject.rotation = 0;

                    const flamesSprite = pixiObject.children[0] as Sprite;
                    const shipSprite = pixiObject.children[1] as Sprite;

                    // Sync Ship
                    if (shipSprite && ecsAnimSprite) {
                        const frameIndex = ecsAnimSprite.getFrameForRotation(transform.rotation);
                        const textures = this.getFramesFromSpritesheet(ecsAnimSprite.spritesheet);
                        if (textures && textures[frameIndex]) {
                            shipSprite.texture = textures[frameIndex];
                        }
                        shipSprite.rotation = 0; // Prevent doubl-rotation (frame handles direction)
                        shipSprite.anchor.set(0.5);
                    }

                    // Sync Flames
                    if (flamesSprite && this.engflamesSprite) {
                        // Update Opacity based on Velocity
                        const velocity = this.ecs.getComponent(entity, Velocity);
                        const isMoving = velocity ? (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1) : false;

                        // Update Opacity State
                        if (isMoving) {
                            this.engflamesOpacity = Math.min(1, this.engflamesOpacity + this.ENGFLAMES_FADE_SPEED);
                        } else {
                            this.engflamesOpacity = Math.max(0, this.engflamesOpacity - this.ENGFLAMES_FADE_SPEED);
                        }

                        this.engflamesOpacity = Math.max(0, Math.min(1, this.engflamesOpacity));

                        flamesSprite.alpha = this.engflamesOpacity;
                        flamesSprite.visible = this.engflamesOpacity > 0;

                        if (flamesSprite.visible) {
                            const BASE_FLAME_OFFSET = 50;
                            const HORIZONTAL_OFFSET_BONUS = 25;
                            const horizontalFactor = Math.abs(Math.cos(transform.rotation));
                            const offsetDist = BASE_FLAME_OFFSET + (horizontalFactor * HORIZONTAL_OFFSET_BONUS);

                            const flameRot = transform.rotation + Math.PI;
                            flamesSprite.position.set(
                                Math.cos(flameRot) * offsetDist,
                                Math.sin(flameRot) * offsetDist
                            );
                            flamesSprite.rotation = flameRot - Math.PI / 2;

                            const flameFrameIndex = Math.floor((this.engflamesAnimationTime / 100) % (this.engflamesSprite.spritesheet.frames.length || 1));
                            const flameTextures = this.getFramesFromSpritesheet(this.engflamesSprite.spritesheet);
                            if (flameTextures && flameTextures[flameFrameIndex]) {
                                flamesSprite.texture = flameTextures[flameFrameIndex];
                            }
                            flamesSprite.anchor.set(0.5);
                            flamesSprite.scale.set(0.5);
                        }
                    }
                }
                else if (pixiObject instanceof Sprite) {
                    // 3. FALLBACK / EXPLOSION (Raw Sprite)
                    pixiObject.position.set(transform.x, transform.y);
                    pixiObject.scale.set(transform.scaleX || 1, transform.scaleY || 1);

                    if (explosion) {
                        const frame = explosion.getCurrentFrame();
                        if (frame && frame.naturalWidth > 0) {
                            pixiObject.texture = this.getTextureFromImage(frame);
                            pixiObject.anchor.set(0.5);
                            pixiObject.scale.set(0.8);
                        } else {
                            pixiObject.visible = false;
                        }
                    } else if (projectile) {
                        // Legacy projectile sprite?
                        const angle = Math.atan2(projectile.directionY, projectile.directionX);
                        pixiObject.rotation = angle;
                        pixiObject.anchor.set(0.5);
                    } else {
                        pixiObject.rotation = transform.rotation;
                        pixiObject.anchor.set(0.5);
                    }
                }
            }

            // 4. Health & Shield Bars
            const health = this.ecs.getComponent(entity, Health);
            const shield = this.ecs.getComponent(entity, Shield);

            if ((health || shield) && pixiObject) {
                // Skip bars for Explosions or Projectiles
                if (!projectile && !this.ecs.hasComponent(entity, Explosion)) {
                    this.updateHealthBar(pixiObject, health || null, shield || null);
                }
            }
        }

        // 5. Query DamageText Entities (No Transform)
        const damageTextEntities = this.ecs.getEntitiesWithComponents(DamageText);
        for (const entity of damageTextEntities) {
            const damageText = this.ecs.getComponent(entity, DamageText);
            if (!damageText) continue;

            activeEntityIds.add(entity.id);

            let pixiText = this.spriteMap.get(entity.id) as Text | undefined;
            if (!pixiText) {
                const style = new TextStyle({
                    fontFamily: 'Arial',
                    fontSize: 16,
                    fontWeight: 'bold',
                    fill: damageText.color || '#ffffff',
                    stroke: { color: '#000000', width: 3 },
                    dropShadow: {
                        color: '#000000',
                        blur: 4,
                        distance: 2,
                    },
                });
                pixiText = new Text({
                    text: NumberFormatter.format(damageText.value),
                    style
                });
                pixiText.anchor.set(0.5);
                this.spriteMap.set(entity.id, pixiText);
                worldContainer.addChild(pixiText);
            }

            // Sync Position
            const targetEntity = damageText.targetEntityId !== -1 ? this.ecs.getEntity(damageText.targetEntityId) : null;
            let worldX: number;
            let worldY: number;

            if (targetEntity) {
                const targetTransform = this.ecs.getComponent(targetEntity, Transform);
                if (targetTransform) {
                    // Check if it's a remote entity with interpolation
                    const interpolationTarget = this.ecs.getComponent(targetEntity, InterpolationTarget);
                    damageText.lastWorldX = interpolationTarget ? interpolationTarget.renderX : targetTransform.x;
                    damageText.lastWorldY = interpolationTarget ? interpolationTarget.renderY : targetTransform.y;
                }
            }

            worldX = damageText.lastWorldX + damageText.initialOffsetX;
            worldY = damageText.lastWorldY + damageText.currentOffsetY;

            pixiText.position.set(worldX, worldY);
            pixiText.alpha = damageText.getAlpha();
        }

        // 6. Cleanup Removed Entities
        for (const [id, pixiObject] of this.spriteMap.entries()) {
            if (!activeEntityIds.has(id)) {
                worldContainer.removeChild(pixiObject);
                pixiObject.destroy();
                this.spriteMap.delete(id);
            }
        }
    }



    private isPlayerEntity(entity: Entity): boolean {
        // Simple heuristic: Has Transform, Health, Shield, but NOT Npc/RemotePlayer
        // Better: Use SystemFactory identification logic
        // For now, check if it has 'InputComponent' or similar? 
        // Or check unique ID logic if available.
        // Fallback to RenderSystem heuristic:
        return this.ecs.hasComponent(entity, Transform) &&
            this.ecs.hasComponent(entity, Health) &&
            this.ecs.hasComponent(entity, Shield) &&
            !this.ecs.hasComponent(entity, Npc) &&
            !this.ecs.hasComponent(entity, RemotePlayer);
    }

    private updateHealthBar(container: Container, health: Health | null, shield: Shield | null): void {
        const BAR_WIDTH = 60;
        const BAR_HEIGHT = 6;
        const BAR_OFFSET = -50; // Above sprite

        let barContainer = container.getChildByLabel('bars') as Container;
        if (!barContainer) {
            barContainer = new Container();
            barContainer.label = 'bars';
            container.addChild(barContainer);
        }

        // Ensure bars don't rotate with the ship if it's a Sprite
        // But if container is a Sprite, children rotate with it.
        // Solution: Rotate barContainer opposite to container rotation to keep it horizontal
        barContainer.rotation = -container.rotation;
        barContainer.position.set(0, BAR_OFFSET);

        let graphics = barContainer.getChildByLabel('graphics') as Graphics;
        if (!graphics) {
            graphics = new Graphics();
            graphics.label = 'graphics';
            barContainer.addChild(graphics);
        }

        graphics.clear();

        let currentY = 0;

        // Shield Bar
        if (shield && shield.maxValue > 0) {
            const pct = Math.max(0, Math.min(1, shield.currentValue / shield.maxValue));
            // Background
            graphics.rect(-BAR_WIDTH / 2, currentY, BAR_WIDTH, BAR_HEIGHT);
            graphics.fill({ color: 0x000000, alpha: 0.5 });

            // Foreground (Blue)
            graphics.rect(-BAR_WIDTH / 2, currentY, BAR_WIDTH * pct, BAR_HEIGHT);
            graphics.fill(0x00AAFF);

            currentY += BAR_HEIGHT + 2;
        }

        // Health Bar
        if (health && health.maxValue > 0) {
            const pct = Math.max(0, Math.min(1, health.currentValue / health.maxValue));
            // Background
            graphics.rect(-BAR_WIDTH / 2, currentY, BAR_WIDTH, BAR_HEIGHT);
            graphics.fill({ color: 0x000000, alpha: 0.5 });

            // Foreground (Green/Red)
            const color = pct > 0.5 ? 0x00FF00 : 0xFF0000;
            graphics.rect(-BAR_WIDTH / 2, currentY, BAR_WIDTH * pct, BAR_HEIGHT);
            graphics.fill(color);
        }
    }

    private createPixiObject(entity: Entity, ecsSprite: EcsSprite | null, ecsAnimSprite: EcsAnimatedSprite | null, isPlayer: boolean = false, explosion: Explosion | null = null): Sprite | Container | null {
        // EXPLOSION HANDLING
        if (explosion) {
            const frame = explosion.getCurrentFrame();
            if (frame && frame.naturalWidth > 0) {
                const texture = this.getTextureFromImage(frame);
                const sprite = new Sprite(texture);
                sprite.anchor.set(0.5);
                return sprite;
            }
            // Return empty sprite placeholder if frame not ready yet? 
            // Or null to retry next frame. Retrying is safer.
            return null;
        }

        // PLAYER CONTAINER
        if (isPlayer && ecsAnimSprite && this.engflamesSprite) {
            const container = new Container();

            // 1. Flames (Bottom)
            const flameTextures = this.getFramesFromSpritesheet(this.engflamesSprite.spritesheet);
            const flameSprite = new Sprite(flameTextures ? flameTextures[0] : Texture.EMPTY);
            flameSprite.anchor.set(0.5);
            flameSprite.visible = false; // Start invisible
            container.addChild(flameSprite);

            // 2. Ship (Top)
            const shipTextures = this.getFramesFromSpritesheet(ecsAnimSprite.spritesheet);
            const shipSprite = new Sprite(shipTextures ? shipTextures[0] : Texture.EMPTY);
            shipSprite.anchor.set(0.5);
            container.addChild(shipSprite);

            return container;
        }

        if (ecsAnimSprite && ecsAnimSprite.isLoaded()) {
            const textures = this.getFramesFromSpritesheet(ecsAnimSprite.spritesheet);
            if (textures && textures.length > 0) {
                const container = new Container();
                const sprite = new Sprite(textures[0]);
                sprite.anchor.set(0.5);
                sprite.label = 'visual';
                container.addChild(sprite);
                return container;
            }
        } else if (ecsSprite && ecsSprite.image && ecsSprite.isLoaded()) {
            const texture = this.getTextureFromImage(ecsSprite.image);
            const container = new Container();
            const sprite = new Sprite(texture);
            sprite.anchor.set(0.5);
            sprite.label = 'visual';
            container.addChild(sprite);
            return container;
        }
        return null; // Explicitly return null if creation failed
    }

    private getTextureFromImage(image: HTMLImageElement): Texture {
        if (this.textureCache.has(image.src)) {
            return this.textureCache.get(image.src)!;
        }
        const texture = Texture.from(image);
        this.textureCache.set(image.src, texture);
        return texture;
    }

    // Cache for sliced spritesheet textures: Map<ImageSrc, Texture[]>
    private spritesheetCache: Map<string, Texture[]> = new Map();

    private getFramesFromSpritesheet(sheet: any): Texture[] | null {
        if (!sheet || !sheet.image || !sheet.frames) return null;

        const src = sheet.image.src;
        if (this.spritesheetCache.has(src)) {
            return this.spritesheetCache.get(src)!;
        }

        // Slice textures
        const baseTexture = this.getTextureFromImage(sheet.image);
        const textures: Texture[] = [];

        for (const frame of sheet.frames) {
            const rect = new Rectangle(frame.x, frame.y, frame.width, frame.height);
            const texture = new Texture({
                source: baseTexture.source,
                frame: rect
            });

            textures.push(texture);
        }

        this.spritesheetCache.set(src, textures);
        return textures;
    }

    // Compatibility Stubs for SystemFactory
    public setAssetManager(assetManager: any): void { }

    public setEngflamesSprite(sprite: EcsAnimatedSprite): void {
        this.engflamesSprite = sprite;
    }

    public setDamageTextSystem(system: any): void { }
}
