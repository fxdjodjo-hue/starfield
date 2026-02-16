import type { AnimatedSprite } from '../../entities/AnimatedSprite';
import type { AssetManager } from './AssetManager';
import { getPlayerShipSkinById } from '../../config/ShipSkinConfig';

export async function createPlayerShipAnimatedSprite(
  assetManager: AssetManager,
  shipSkinId?: string | null
): Promise<AnimatedSprite> {
  const shipSkin = getPlayerShipSkinById(shipSkinId);
  const playerSprite = await assetManager.createAnimatedSprite(shipSkin.basePath, shipSkin.inGameScale);
  (playerSprite as AnimatedSprite & { shipSkinId?: string }).shipSkinId = shipSkin.id;

  if (
    typeof shipSkin.rotationFrameCount === 'number' &&
    shipSkin.rotationFrameCount > 0 &&
    playerSprite.spritesheet.frames.length > shipSkin.rotationFrameCount
  ) {
    playerSprite.spritesheet.frames = playerSprite.spritesheet.frames.slice(0, shipSkin.rotationFrameCount);
  }

  return playerSprite;
}
