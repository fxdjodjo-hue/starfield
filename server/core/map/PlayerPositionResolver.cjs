/**
 * PlayerPositionResolver - normalizza la posizione player usata da sistemi server.
 * Evita che combat/AI usino policy diverse tra posizione server e lastClientPos.
 */

const DEFAULT_OPTIONS = Object.freeze({
  maxAgeMs: 400,
  maxDrift: 800
});

function asFiniteNumber(value, fallback = null) {
  return Number.isFinite(value) ? value : fallback;
}

function getEffectivePlayerPosition(playerData, now = Date.now(), options = {}) {
  if (!playerData || !playerData.position) return null;

  const maxAgeMs = Number.isFinite(options.maxAgeMs) ? options.maxAgeMs : DEFAULT_OPTIONS.maxAgeMs;
  const maxDrift = Number.isFinite(options.maxDrift) ? options.maxDrift : DEFAULT_OPTIONS.maxDrift;
  const maxDriftSq = maxDrift * maxDrift;

  const serverX = asFiniteNumber(playerData.position.x, 0);
  const serverY = asFiniteNumber(playerData.position.y, 0);
  const serverRotation = asFiniteNumber(playerData.position.rotation, 0);

  const lastClientPos = playerData.lastClientPos;
  if (!lastClientPos) {
    return { x: serverX, y: serverY, rotation: serverRotation, source: 'server' };
  }

  const clientX = asFiniteNumber(lastClientPos.x);
  const clientY = asFiniteNumber(lastClientPos.y);
  const clientTs = asFiniteNumber(lastClientPos.timestamp, 0);
  if (clientX === null || clientY === null || clientTs === 0) {
    return { x: serverX, y: serverY, rotation: serverRotation, source: 'server' };
  }

  const ageMs = now - clientTs;
  if (ageMs < 0 || ageMs > maxAgeMs) {
    return { x: serverX, y: serverY, rotation: serverRotation, source: 'server' };
  }

  const driftX = clientX - serverX;
  const driftY = clientY - serverY;
  if ((driftX * driftX + driftY * driftY) > maxDriftSq) {
    return { x: serverX, y: serverY, rotation: serverRotation, source: 'server' };
  }

  return { x: clientX, y: clientY, rotation: serverRotation, source: 'client_recent' };
}

module.exports = {
  getEffectivePlayerPosition,
  DEFAULT_OPTIONS
};
