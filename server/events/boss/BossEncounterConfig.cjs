/**
 * BossEncounterConfig - Configurazione centralizzata evento boss.
 * Tutti i parametri sono data-driven per tuning senza toccare logica.
 */

const BOSS_ENCOUNTER_CONFIG = {
  enabled: process.env.BOSS_ENCOUNTER_ENABLED !== 'false',

  // Scheduling
  minPlayersToStart: 1,
  initialDelayMs: Number(process.env.BOSS_ENCOUNTER_INITIAL_DELAY_MS) || 90_000,
  intervalMs: Number(process.env.BOSS_ENCOUNTER_INTERVAL_MS) || 15 * 60 * 1000,
  maxDurationMs: Number(process.env.BOSS_ENCOUNTER_DURATION_MS) || 12 * 60 * 1000,
  preStartAnnouncementsMs: [60_000, 30_000, 10_000],

  // Boss base type (riusa pipeline esistente NPC/proiettili/client)
  bossType: 'ARX-DRONE',
  bossDisplayName: 'ARX-DRONE',

  // Transizione tra fasi
  phaseTransitionInvulnerabilityMs: 2_500,
  phaseTeleportDistanceMin: 1_600,
  phaseTeleportDistanceMax: 2_900,
  phaseTransitionHealthThreshold: Number(process.env.BOSS_PHASE_TRANSITION_HEALTH_THRESHOLD) || 0.10, // 10% HP
  phaseTransitionSpeedMultiplier: Number(process.env.BOSS_PHASE_TRANSITION_SPEED_MULTIPLIER) || 2.8,
  phaseTransitionArrivalRadius: Number(process.env.BOSS_PHASE_TRANSITION_ARRIVAL_RADIUS) || 140,
  phaseTransitionTimeoutMs: Number(process.env.BOSS_PHASE_TRANSITION_TIMEOUT_MS) || 12_000,
  worldEdgePaddingRatio: 0.03,

  // Boss roaming/aggro: movimento libero con evitamento centro.
  bossAutoAggroRange: 2_100,
  bossAvoidCenterRadius: 2_000,

  // Spawn sgherri
  minionSpawnRadiusMin: 260,
  minionSpawnRadiusMax: 560,

  // Confinamento sgherri attorno al boss (niente orbita forzata)
  minionConfinement: {
    softLimit: 700,
    hardLimit: 900,
    failSafeLimit: 1_100
  },

  phases: [
    {
      id: 1,
      minionCount: 3,
      healthMultiplier: 1.0,
      shieldMultiplier: 1.0,
      damageMultiplier: 1.0,
      fireRateMultiplier: 1.0,
      speedMultiplier: 1.0,
      minionPool: ['Guard', 'Scouter']
    },
    {
      id: 2,
      minionCount: 6,
      healthMultiplier: 1.3,
      shieldMultiplier: 1.3,
      damageMultiplier: 1.15,
      fireRateMultiplier: 1.10,
      speedMultiplier: 1.05,
      minionPool: ['Guard', 'Scouter', 'Pyramid']
    },
    {
      id: 3,
      minionCount: 12,
      healthMultiplier: 1.7,
      shieldMultiplier: 1.7,
      damageMultiplier: 1.30,
      fireRateMultiplier: 1.20,
      speedMultiplier: 1.10,
      minionPool: ['Guard', 'Pyramid']
    }
  ]
};

module.exports = { BOSS_ENCOUNTER_CONFIG };
