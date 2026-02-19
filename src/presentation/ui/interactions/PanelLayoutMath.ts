export interface ViewportSize {
  width: number;
  height: number;
}

export interface PanelSize {
  width: number;
  height: number;
}

export interface PanelPosition {
  left: number;
  top: number;
}

function normalizeFinite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function clampPanelPositionToViewport(
  position: PanelPosition,
  size: PanelSize,
  viewport: ViewportSize
): PanelPosition {
  const normalizedWidth = Math.max(0, normalizeFinite(size.width, 0));
  const normalizedHeight = Math.max(0, normalizeFinite(size.height, 0));
  const maxLeft = Math.max(0, normalizeFinite(viewport.width, 0) - normalizedWidth);
  const maxTop = Math.max(0, normalizeFinite(viewport.height, 0) - normalizedHeight);

  return {
    left: Math.min(Math.max(0, normalizeFinite(position.left, 0)), maxLeft),
    top: Math.min(Math.max(0, normalizeFinite(position.top, 0)), maxTop)
  };
}

export function clampPanelSizeToViewport(
  requestedSize: PanelSize,
  minSize: PanelSize,
  viewport: ViewportSize,
  margin: number = 0
): PanelSize {
  const normalizedMargin = Math.max(0, normalizeFinite(margin, 0));
  const maxWidth = Math.max(1, normalizeFinite(viewport.width, 1) - (normalizedMargin * 2));
  const maxHeight = Math.max(1, normalizeFinite(viewport.height, 1) - (normalizedMargin * 2));

  const normalizedMinWidth = Math.max(1, normalizeFinite(minSize.width, 1));
  const normalizedMinHeight = Math.max(1, normalizeFinite(minSize.height, 1));

  const width = Math.min(
    maxWidth,
    Math.max(normalizedMinWidth, Math.round(normalizeFinite(requestedSize.width, normalizedMinWidth)))
  );
  const height = Math.min(
    maxHeight,
    Math.max(normalizedMinHeight, Math.round(normalizeFinite(requestedSize.height, normalizedMinHeight)))
  );

  return { width, height };
}
