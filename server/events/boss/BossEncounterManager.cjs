/**
 * BossEncounterManager - Evento boss MMO-style a 3 fasi con sgherri.
 * Responsabilita:
 * - Scheduling evento
 * - Spawn/despawn boss e sgherri
 * - Gate danno boss (invulnerabile finche sgherri vivi)
 * - Transizione fasi (trigger a soglia HP, dash verso nuovo punto, poi reset fase)
 */

const ServerLoggerWrapper = require('../../core/infrastructure/ServerLoggerWrapper.cjs');
const { SERVER_CONSTANTS, NPC_CONFIG } = require('../../config/constants.cjs');
const { BOSS_ENCOUNTER_CONFIG } = require('./BossEncounterConfig.cjs');

class BossEncounterManager {
  constructor(mapServer, config = BOSS_ENCOUNTER_CONFIG) {
    this.mapServer = mapServer;
    this.config = config;
    this.activeEncounter = null;
    this.nextEncounterAt = this.computeNextEncounterAt(Date.now(), true);
    this.encounterCounter = 0;
    this.isEndingEncounter = false;
    this.lastPreStartRemainingMs = null;
    this.pendingPreStartAnnouncements = new Set(this.getPreStartAnnouncementThresholds());
  }

  /**
   * Tick evento (invocato dal tick della mappa).
   */
  update(now = Date.now()) {
    if (!this.config.enabled) return;

    if (this.activeEncounter) {
      this.updateActiveEncounter(now);
      return;
    }

    if (now < this.nextEncounterAt) {
      this.emitPreStartAnnouncements(now);
      return;
    }

    this.startEncounter(now);
  }

  /**
   * Gate danno NPC. Se false, il danno viene ignorato.
   */
  canNpcTakeDamage(npcId, _attackerId, now = Date.now()) {
    const encounter = this.activeEncounter;
    if (!encounter) return true;
    if (npcId !== encounter.bossNpcId) return true;

    if (encounter.shieldLocked) return false;
    if (encounter.bossInvulnerableUntil > now) return false;
    return true;
  }

  /**
   * Hook chiamato quando un NPC arriva a 0 HP.
   * Ritorna true se la morte viene consumata dal sistema evento (fase 1/2).
   */
  onNpcHealthDepleted(npc, _attackerId, now = Date.now()) {
    const encounter = this.activeEncounter;
    if (!encounter || !npc) return false;
    if (npc.id !== encounter.bossNpcId) return false;

    const isLastPhase = encounter.phaseIndex >= this.config.phases.length - 1;
    if (isLastPhase) {
      // Fase finale: morte reale gestita dal flow standard.
      return false;
    }

    // Consuma la "morte": il boss non deve essere rimosso nelle fasi non finali.
    // Se e' arrivato a 0, riportalo ad almeno 1 HP per permettere la dash di transizione.
    const transitionFloor = this.getTransitionHealthFloor(npc.maxHealth);
    npc.health = Math.max(1, transitionFloor, Number(npc.health) || 0);

    this.transitionToNextPhase(now, { reason: 'health_depleted' });
    return true;
  }

  /**
   * Hook chiamato quando un NPC viene rimosso dal mondo.
   */
  onNpcRemoved(npcId, npcSnapshot) {
    const encounter = this.activeEncounter;
    if (!encounter) return;

    if (this.isEndingEncounter) {
      // Durante cleanup bulk ignoriamo side effects.
      return;
    }

    if (npcId === encounter.bossNpcId) {
      this.endEncounter('boss_killed', Date.now(), { skipBossRemoval: true });
      return;
    }

    if (encounter.minionNpcIds.has(npcId)) {
      encounter.minionNpcIds.delete(npcId);
      if (encounter.shieldLocked && !encounter.phaseTransition && encounter.minionNpcIds.size === 0) {
        this.unlockBoss(Date.now());
      }
    }

    // Sanity check: se il boss evento sparisce dal registry, chiudi.
    if (npcSnapshot && npcSnapshot.bossEncounterRole === 'boss' && npcSnapshot.bossEncounterId === encounter.encounterId) {
      this.endEncounter('boss_removed', Date.now(), { skipBossRemoval: true });
    }
  }

  startEncounter(now) {
    const spawn = this.findSafeEncounterSpawnPosition();
    const bossNpcId = this.mapServer.npcManager.createNpc(this.config.bossType, spawn.x, spawn.y, true);
    if (!bossNpcId) {
      this.scheduleNextEncounter(now);
      return;
    }

    const bossNpc = this.mapServer.npcManager.getNpc(bossNpcId);
    if (!bossNpc) {
      this.scheduleNextEncounter(now);
      return;
    }

    const encounterId = `${this.mapServer.mapId}_boss_${++this.encounterCounter}_${now}`;
    this.activeEncounter = {
      encounterId,
      bossNpcId,
      phaseIndex: 0,
      minionNpcIds: new Set(),
      shieldLocked: true,
      startedAt: now,
      expiresAt: now + this.config.maxDurationMs,
      bossInvulnerableUntil: now + this.config.phaseTransitionInvulnerabilityMs,
      phaseTransition: null
    };

    this.decorateBossNpcBase(bossNpc, now);
    this.applyPhaseToBoss(bossNpc, this.getCurrentPhaseConfig(), now);
    this.spawnCurrentPhaseMinions(now);

    this.broadcastNpcSpawn(bossNpcId);
    this.broadcastBossEvent({
      code: 'BOSS_EVENT_STARTED',
      severity: 'warning',
      durationMs: 7000,
      content: `ALERT: ${this.config.bossDisplayName} detected in ${this.mapServer.mapName}.`
    });
    this.broadcastPhaseDirective(this.getCurrentPhaseConfig());
    ServerLoggerWrapper.info(
      'BOSS_EVENT',
      `Started encounter ${encounterId} in map ${this.mapServer.mapId} with boss ${bossNpcId}`
    );
  }

  updateActiveEncounter(now) {
    const encounter = this.activeEncounter;
    if (!encounter) return;

    if (now >= encounter.expiresAt) {
      this.endEncounter('timeout', now);
      return;
    }

    const bossNpc = this.mapServer.npcManager.getNpc(encounter.bossNpcId);
    if (!bossNpc) {
      this.endEncounter('boss_missing', now, { skipBossRemoval: true });
      return;
    }

    this.pruneMissingMinions();

    this.maybeStartPhaseTransitionByHealth(bossNpc, now);

    if (encounter.phaseTransition) {
      this.updatePhaseTransitionState(bossNpc, now);
    }

    if (encounter.shieldLocked && !encounter.phaseTransition && encounter.minionNpcIds.size === 0 && now >= encounter.bossInvulnerableUntil) {
      this.unlockBoss(now);
    }

    bossNpc.lastUpdate = now;
  }

  transitionToNextPhase(now, options = {}) {
    const encounter = this.activeEncounter;
    if (!encounter) return;

    const bossNpc = this.mapServer.npcManager.getNpc(encounter.bossNpcId);
    if (!bossNpc) {
      this.endEncounter('boss_missing_during_transition', now, { skipBossRemoval: true });
      return;
    }

    this.startPhaseTransition(bossNpc, now, options.reason || 'phase_threshold');
  }

  maybeStartPhaseTransitionByHealth(bossNpc, now) {
    const encounter = this.activeEncounter;
    if (!encounter || !bossNpc) return;
    if (encounter.phaseTransition) return;

    const isLastPhase = encounter.phaseIndex >= this.config.phases.length - 1;
    if (isLastPhase) return;

    const healthThreshold = this.getTransitionHealthFloor(bossNpc.maxHealth);
    if (bossNpc.health > healthThreshold) return;

    this.startPhaseTransition(bossNpc, now, 'health_threshold');
  }

  startPhaseTransition(bossNpc, now, reason = 'phase_threshold') {
    const encounter = this.activeEncounter;
    if (!encounter || !bossNpc) return;
    if (encounter.phaseTransition) return;

    const nextPhaseIndex = encounter.phaseIndex + 1;
    const nextPhaseConfig = this.config.phases[nextPhaseIndex];
    if (!nextPhaseConfig) {
      this.endEncounter('invalid_phase_config', now);
      return;
    }

    const transitionTarget = this.getBossTransitionPosition(bossNpc.position);
    const currentSpeed = Math.max(
      80,
      Number(bossNpc.speedOverride) || Number(NPC_CONFIG[bossNpc.type]?.stats?.speed) || 250
    );
    const speedMultiplier = Math.max(1, Number(this.config.phaseTransitionSpeedMultiplier) || 2.8);
    const transitionSpeed = Math.max(220, currentSpeed * speedMultiplier);
    const arrivalRadius = Math.max(40, Number(this.config.phaseTransitionArrivalRadius) || 140);
    const timeoutMs = Math.max(2_500, Number(this.config.phaseTransitionTimeoutMs) || 12_000);

    this.clearActiveMinions({ skipRespawn: true });

    encounter.phaseTransition = {
      fromPhaseIndex: encounter.phaseIndex,
      toPhaseIndex: nextPhaseIndex,
      targetPosition: { x: transitionTarget.x, y: transitionTarget.y },
      transitionSpeed,
      arrivalRadius,
      startedAt: now,
      expiresAt: now + timeoutMs,
      reason
    };

    encounter.shieldLocked = true;
    encounter.bossInvulnerableUntil = Number.MAX_SAFE_INTEGER;

    bossNpc.bossShieldLocked = true;
    bossNpc.bossPhaseTransition = {
      targetX: transitionTarget.x,
      targetY: transitionTarget.y,
      arrivalRadius,
      speed: transitionSpeed
    };
    bossNpc.speedOverride = transitionSpeed;
    bossNpc.behavior = 'phase_transition';
    bossNpc.lastDamage = now;
    bossNpc.lastUpdate = now;

    this.broadcastBossEvent({
      code: 'BOSS_PHASE_TRANSITION',
      severity: 'warning',
      durationMs: 5200,
      content: `${this.config.bossDisplayName} is repositioning to a new sector!`
    });

    ServerLoggerWrapper.info(
      'BOSS_EVENT',
      `Encounter ${encounter.encounterId}: phase transition started (${reason}), target=(${transitionTarget.x.toFixed(0)}, ${transitionTarget.y.toFixed(0)}), speed=${transitionSpeed.toFixed(0)}`
    );
  }

  updatePhaseTransitionState(bossNpc, now) {
    const encounter = this.activeEncounter;
    const transition = encounter?.phaseTransition;
    if (!encounter || !transition || !bossNpc) return;

    const dx = transition.targetPosition.x - bossNpc.position.x;
    const dy = transition.targetPosition.y - bossNpc.position.y;
    const distSq = dx * dx + dy * dy;
    const arrived = distSq <= (transition.arrivalRadius * transition.arrivalRadius);
    const expired = now >= transition.expiresAt;

    if (!arrived && !expired) return;

    this.completePhaseTransition(bossNpc, now, { timedOut: expired });
  }

  completePhaseTransition(bossNpc, now, options = {}) {
    const encounter = this.activeEncounter;
    const transition = encounter?.phaseTransition;
    if (!encounter || !transition || !bossNpc) return;

    const previousPhase = this.config.phases[transition.fromPhaseIndex];
    encounter.phaseIndex = transition.toPhaseIndex;
    const phaseConfig = this.getCurrentPhaseConfig();
    if (!phaseConfig) {
      this.endEncounter('invalid_phase_config', now);
      return;
    }

    // Snappa alla destinazione solo al termine della dash (non all'inizio).
    bossNpc.position.x = transition.targetPosition.x;
    bossNpc.position.y = transition.targetPosition.y;
    this.clearBossTransitionState(bossNpc);

    encounter.phaseTransition = null;
    encounter.shieldLocked = true;
    encounter.bossInvulnerableUntil = now + this.config.phaseTransitionInvulnerabilityMs;

    this.applyPhaseToBoss(bossNpc, phaseConfig, now);
    this.spawnCurrentPhaseMinions(now);
    this.broadcastBossEvent({
      code: 'BOSS_PHASE_COMPLETED',
      severity: 'mission',
      durationMs: 5000,
      content: `PHASE ${previousPhase?.id || '?'} completed. ${this.config.bossDisplayName} reached the new sector.`
    });
    this.broadcastPhaseDirective(phaseConfig);

    ServerLoggerWrapper.info(
      'BOSS_EVENT',
      `Encounter ${encounter.encounterId} transitioned to phase ${phaseConfig.id}${options.timedOut ? ' (transition-timeout fallback)' : ''}`
    );
  }

  unlockBoss(now) {
    const encounter = this.activeEncounter;
    if (!encounter) return;
    if (encounter.phaseTransition) return;

    encounter.shieldLocked = false;
    encounter.bossInvulnerableUntil = now;

    const bossNpc = this.mapServer.npcManager.getNpc(encounter.bossNpcId);
    if (bossNpc) {
      bossNpc.bossShieldLocked = false;
      bossNpc.lastUpdate = now;
    }

    this.broadcastBossEvent({
      code: 'BOSS_SHIELD_UNLOCKED',
      severity: 'warning',
      durationMs: 4500,
      content: `${this.config.bossDisplayName}: shields down. Focus fire on the boss!`
    });

    ServerLoggerWrapper.info('BOSS_EVENT', `Encounter ${encounter.encounterId}: boss shield unlocked`);
  }

  endEncounter(reason, now = Date.now(), options = {}) {
    const encounter = this.activeEncounter;
    if (!encounter) return;

    const phaseLabel = this.getCurrentPhaseConfig()?.id || encounter.phaseIndex + 1;
    if (reason === 'boss_killed') {
      this.broadcastBossEvent({
        code: 'BOSS_EVENT_COMPLETED',
        severity: 'success',
        durationMs: 8000,
        content: `${this.config.bossDisplayName} neutralized. Event completed (phase ${phaseLabel}).`
      });
    } else {
      this.broadcastBossEvent({
        code: 'BOSS_EVENT_ENDED',
        severity: 'mission',
        durationMs: 6000,
        content: `${this.config.bossDisplayName} event ended: ${reason}.`
      });
    }

    this.isEndingEncounter = true;
    try {
      this.clearActiveMinions({ skipRespawn: true });

      const bossNpc = this.mapServer.npcManager.getNpc(encounter.bossNpcId);
      if (bossNpc) {
        this.clearBossTransitionState(bossNpc);
      }

      if (!options.skipBossRemoval) {
        if (bossNpc) {
          this.mapServer.npcManager.removeNpc(encounter.bossNpcId, { skipRespawn: true });
        }
      }
    } finally {
      this.isEndingEncounter = false;
      this.activeEncounter = null;
      this.scheduleNextEncounter(now);
    }

    ServerLoggerWrapper.info(
      'BOSS_EVENT',
      `Encounter ${encounter.encounterId} ended (${reason}). Next start at ${new Date(this.nextEncounterAt).toISOString()}`
    );
  }

  clearActiveMinions(options = {}) {
    const encounter = this.activeEncounter;
    if (!encounter) return;

    const minionIds = Array.from(encounter.minionNpcIds);
    encounter.minionNpcIds.clear();

    for (const minionNpcId of minionIds) {
      if (this.mapServer.npcManager.getNpc(minionNpcId)) {
        this.mapServer.npcManager.removeNpc(minionNpcId, { skipRespawn: true, ...options });
      }
    }
  }

  spawnCurrentPhaseMinions(now) {
    const encounter = this.activeEncounter;
    if (!encounter) return;

    const bossNpc = this.mapServer.npcManager.getNpc(encounter.bossNpcId);
    const phaseConfig = this.getCurrentPhaseConfig();
    if (!bossNpc || !phaseConfig) return;

    encounter.shieldLocked = true;
    bossNpc.bossShieldLocked = true;

    const minionCount = Number(phaseConfig.minionCount) || 0;
    for (let i = 0; i < minionCount; i++) {
      const minionType = this.pickMinionType(phaseConfig, i);
      const spawnPos = this.getMinionSpawnPosition(bossNpc.position);
      const minionNpcId = this.mapServer.npcManager.createNpc(minionType, spawnPos.x, spawnPos.y, true);
      if (!minionNpcId) continue;

      const minionNpc = this.mapServer.npcManager.getNpc(minionNpcId);
      if (!minionNpc) continue;

      this.decorateMinionNpc(minionNpc, encounter, now);
      encounter.minionNpcIds.add(minionNpcId);
      this.broadcastNpcSpawn(minionNpcId);
    }
  }

  decorateBossNpcBase(bossNpc, now) {
    const encounter = this.activeEncounter;

    bossNpc.isBossEncounterNpc = true;
    bossNpc.bossEncounterRole = 'boss';
    bossNpc.bossEncounterId = encounter?.encounterId || null;
    bossNpc.bossDisplayName = this.config.bossDisplayName;
    bossNpc.skipRespawnOnDeath = true;
    bossNpc.forceAggressive = false;
    bossNpc.disableFlee = true;
    bossNpc.lastAttackerId = null;
    bossNpc.bossAutoAggroRange = Number(this.config.bossAutoAggroRange) || 2_100;
    bossNpc.bossAvoidCenterRadius = Number(this.config.bossAvoidCenterRadius) || 2_000;
    bossNpc.bossPhaseTransition = null;
    bossNpc.lastUpdate = now;
    bossNpc.lastSignificantMove = now;
  }

  decorateMinionNpc(minionNpc, encounter, now) {
    const nearestPlayerId = this.findNearestPlayerId(minionNpc.position);

    minionNpc.isBossEncounterNpc = true;
    minionNpc.bossEncounterRole = 'minion';
    minionNpc.bossEncounterId = encounter.encounterId;
    minionNpc.skipRespawnOnDeath = true;
    minionNpc.forceAggressive = true;
    minionNpc.disableFlee = true;
    minionNpc.behavior = 'aggressive';
    minionNpc.lastAttackerId = nearestPlayerId || null;
    minionNpc.bossGuard = {
      anchorBossId: encounter.bossNpcId,
      softLimit: this.config.minionConfinement.softLimit,
      hardLimit: this.config.minionConfinement.hardLimit,
      failSafeLimit: this.config.minionConfinement.failSafeLimit
    };
    minionNpc.lastUpdate = now;
    minionNpc.lastSignificantMove = now;
  }

  applyPhaseToBoss(bossNpc, phaseConfig, now) {
    const baseStats = NPC_CONFIG[bossNpc.type]?.stats || {};
    const baseHealth = Math.max(1, Number(baseStats.health) || Number(bossNpc.maxHealth) || 1);
    const baseShield = Math.max(0, Number(baseStats.shield) || Number(bossNpc.maxShield) || 0);
    const baseDamage = Math.max(1, Number(baseStats.damage) || Number(bossNpc.damage) || 1);
    const baseCooldown = Math.max(1, Number(baseStats.cooldown) || 1_000);
    const baseSpeed = Math.max(1, Number(baseStats.speed) || Number(bossNpc.velocity?.x || 0) || 250);
    const healthMultiplier = Math.max(0.1, Number(phaseConfig.healthMultiplier) || 1);
    const shieldMultiplier = Math.max(0, Number(phaseConfig.shieldMultiplier) || 1);
    const phaseMaxHealth = Math.max(1, Math.floor(baseHealth * healthMultiplier));
    const phaseMaxShield = Math.max(0, Math.floor(baseShield * shieldMultiplier));

    bossNpc.maxHealth = phaseMaxHealth;
    bossNpc.health = phaseMaxHealth;
    bossNpc.maxShield = phaseMaxShield;
    bossNpc.shield = phaseMaxShield;
    bossNpc.damage = Math.max(1, Math.floor(baseDamage * phaseConfig.damageMultiplier));
    bossNpc.attackCooldownOverride = Math.max(
      SERVER_CONSTANTS.COMBAT.NPC_MIN_COOLDOWN,
      Math.floor(baseCooldown / phaseConfig.fireRateMultiplier)
    );
    bossNpc.speedOverride = Math.max(80, baseSpeed * phaseConfig.speedMultiplier);
    bossNpc.bossShieldLocked = true;
    bossNpc.bossPhaseTransition = null;
    bossNpc.behavior = bossNpc.lastAttackerId ? 'aggressive' : 'cruise';
    bossNpc.lastDamage = now;
    bossNpc.lastUpdate = now;
    bossNpc.lastSignificantMove = now;
  }

  getCurrentPhaseConfig() {
    const encounter = this.activeEncounter;
    if (!encounter) return null;
    return this.config.phases[encounter.phaseIndex] || null;
  }

  pickMinionType(phaseConfig, index) {
    const pool = Array.isArray(phaseConfig.minionPool) && phaseConfig.minionPool.length > 0
      ? phaseConfig.minionPool
      : ['Guard'];

    return pool[index % pool.length];
  }

  pruneMissingMinions() {
    const encounter = this.activeEncounter;
    if (!encounter) return;

    for (const minionNpcId of Array.from(encounter.minionNpcIds)) {
      if (!this.mapServer.npcManager.getNpc(minionNpcId)) {
        encounter.minionNpcIds.delete(minionNpcId);
      }
    }
  }

  getTransitionHealthFloor(maxHealth) {
    const healthThreshold = Math.max(0.01, Math.min(0.95, Number(this.config.phaseTransitionHealthThreshold) || 0.10));
    return Math.max(1, Math.floor(Math.max(1, Number(maxHealth) || 1) * healthThreshold));
  }

  clearBossTransitionState(bossNpc) {
    if (!bossNpc) return;
    bossNpc.bossPhaseTransition = null;
    bossNpc.behavior = bossNpc.lastAttackerId ? 'aggressive' : 'cruise';
  }

  findSafeEncounterSpawnPosition() {
    return this.getRandomWorldPosition({ avoidSafeZones: true });
  }

  getBossTransitionPosition(currentPosition) {
    return this.getRandomWorldPosition({
      avoidSafeZones: true,
      minDistanceFrom: currentPosition,
      minDistance: this.config.phaseTeleportDistanceMin,
      maxDistance: this.config.phaseTeleportDistanceMax
    });
  }

  getMinionSpawnPosition(bossPosition) {
    const angle = Math.random() * Math.PI * 2;
    const radius = this.randomBetween(
      this.config.minionSpawnRadiusMin,
      this.config.minionSpawnRadiusMax
    );

    const bounds = this.mapServer.npcManager.getWorldBounds();
    const edgePadding = this.getWorldEdgePadding(bounds);
    const x = bossPosition.x + Math.cos(angle) * radius;
    const y = bossPosition.y + Math.sin(angle) * radius;

    return {
      x: Math.max(bounds.WORLD_LEFT + edgePadding, Math.min(bounds.WORLD_RIGHT - edgePadding, x)),
      y: Math.max(bounds.WORLD_TOP + edgePadding, Math.min(bounds.WORLD_BOTTOM - edgePadding, y))
    };
  }

  findNearestPlayerId(position) {
    let bestId = null;
    let bestDistSq = Infinity;

    for (const [clientId, playerData] of this.mapServer.players.entries()) {
      if (!playerData || playerData.isDead || !playerData.position) continue;
      const dx = playerData.position.x - position.x;
      const dy = playerData.position.y - position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestId = clientId;
      }
    }

    return bestId;
  }

  broadcastNpcSpawn(npcId) {
    const broadcaster = this.mapServer.npcManager?.broadcaster;
    if (broadcaster && typeof broadcaster.broadcastNpcSpawn === 'function') {
      broadcaster.broadcastNpcSpawn(npcId);
    }
  }

  scheduleNextEncounter(now) {
    this.nextEncounterAt = this.computeNextEncounterAt(now, false);
    this.resetPreStartAnnouncements();
  }

  computeNextEncounterAt(now, isInitialSchedule = false) {
    const baseNow = Math.max(0, Number(now) || Date.now());
    const intervalMs = Math.max(60_000, Number(this.config.intervalMs) || 60 * 60 * 1000);
    const alignToBoundary = this.config.alignToIntervalBoundary !== false;

    if (alignToBoundary) {
      const slotIndex = Math.floor(baseNow / intervalMs) + 1;
      return slotIndex * intervalMs;
    }

    if (isInitialSchedule) {
      const initialDelayMs = Math.max(0, Number(this.config.initialDelayMs) || 0);
      if (initialDelayMs > 0) {
        return baseNow + initialDelayMs;
      }
    }

    return baseNow + intervalMs;
  }

  resetPreStartAnnouncements() {
    this.lastPreStartRemainingMs = null;
    this.pendingPreStartAnnouncements = new Set(this.getPreStartAnnouncementThresholds());
  }

  getPreStartAnnouncementThresholds() {
    const values = Array.isArray(this.config.preStartAnnouncementsMs)
      ? this.config.preStartAnnouncementsMs
      : [];

    return values
      .map((value) => Math.max(0, Number(value) || 0))
      .filter((value) => value > 0)
      .sort((a, b) => b - a);
  }

  emitPreStartAnnouncements(now) {
    if (this.activeEncounter) return;

    const remainingMs = this.nextEncounterAt - now;
    if (remainingMs <= 0) return;

    const thresholds = this.getPreStartAnnouncementThresholds();
    if (thresholds.length === 0) return;

    if (this.lastPreStartRemainingMs === null) {
      const firstThreshold = thresholds.find((threshold) => remainingMs <= threshold);
      if (firstThreshold && this.pendingPreStartAnnouncements.has(firstThreshold)) {
        this.pendingPreStartAnnouncements.delete(firstThreshold);
        this.broadcastBossEvent({
          code: 'BOSS_COUNTDOWN',
          severity: 'mission',
          durationMs: 5000,
          content: `Event warning: ${this.config.bossDisplayName} arrives in ${Math.ceil(firstThreshold / 1000)}s.`
        });
      }
      this.lastPreStartRemainingMs = remainingMs;
      return;
    }

    for (const threshold of thresholds) {
      if (!this.pendingPreStartAnnouncements.has(threshold)) continue;
      if (this.lastPreStartRemainingMs > threshold && remainingMs <= threshold) {
        this.pendingPreStartAnnouncements.delete(threshold);
        this.broadcastBossEvent({
          code: 'BOSS_COUNTDOWN',
          severity: 'mission',
          durationMs: 5000,
          content: `Event warning: ${this.config.bossDisplayName} arrives in ${Math.ceil(threshold / 1000)}s.`
        });
      }
    }

    this.lastPreStartRemainingMs = remainingMs;
  }

  broadcastPhaseDirective(phaseConfig) {
    if (!phaseConfig) return;

    const phaseNumber = phaseConfig.id || '?';
    const minionsToClear = Math.max(0, Number(phaseConfig.minionCount) || 0);
    const shieldDirective = minionsToClear > 0
      ? `Eliminate ${minionsToClear} minions to drop the shields.`
      : 'Shields disabled, attack the boss.';

    this.broadcastBossEvent({
      code: 'BOSS_PHASE_STARTED',
      phase: phaseNumber,
      severity: 'warning',
      durationMs: 6500,
      content: `PHASE ${phaseNumber} started. ${shieldDirective}`
    });
  }

  broadcastBossEvent({
    code = 'BOSS_EVENT',
    severity = 'info',
    durationMs = 5000,
    content = '',
    phase = null
  } = {}) {
    if (!content) return;

    this.mapServer.broadcastToMap({
      type: 'boss_event',
      code,
      severity,
      phase,
      content,
      durationMs,
      timestamp: Date.now()
    });
  }

  getWorldEdgePadding(bounds) {
    const worldWidth = Math.max(1, (bounds.WORLD_RIGHT - bounds.WORLD_LEFT));
    const worldHeight = Math.max(1, (bounds.WORLD_BOTTOM - bounds.WORLD_TOP));
    const ratio = Math.max(0, Math.min(0.25, Number(this.config.worldEdgePaddingRatio) || 0.03));
    return Math.max(1, Math.floor(Math.min(worldWidth, worldHeight) * ratio));
  }

  isInSafeZone(position) {
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return false;
    for (const safeZone of SERVER_CONSTANTS.SAFE_ZONES) {
      const dx = position.x - safeZone.x;
      const dy = position.y - safeZone.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared <= safeZone.radius * safeZone.radius) return true;
    }
    return false;
  }

  getRandomWorldPosition({
    avoidSafeZones = false,
    minDistanceFrom = null,
    minDistance = 0,
    maxDistance = 0
  } = {}) {
    const bounds = this.mapServer.npcManager.getWorldBounds();
    const edgePadding = this.getWorldEdgePadding(bounds);
    const minX = bounds.WORLD_LEFT + edgePadding;
    const maxX = bounds.WORLD_RIGHT - edgePadding;
    const minY = bounds.WORLD_TOP + edgePadding;
    const maxY = bounds.WORLD_BOTTOM - edgePadding;
    const hasDistanceConstraint = !!minDistanceFrom && Number.isFinite(minDistance) && minDistance > 0;
    const maxDistanceValue = Number.isFinite(maxDistance) && maxDistance > 0 ? maxDistance : Infinity;
    const minDistanceSquared = hasDistanceConstraint ? (minDistance * minDistance) : 0;
    const maxDistanceSquared = hasDistanceConstraint && Number.isFinite(maxDistanceValue)
      ? (maxDistanceValue * maxDistanceValue)
      : Infinity;

    let fallbackPosition = {
      x: this.randomBetween(minX, maxX),
      y: this.randomBetween(minY, maxY)
    };

    for (let i = 0; i < 40; i++) {
      const candidate = {
        x: this.randomBetween(minX, maxX),
        y: this.randomBetween(minY, maxY)
      };

      fallbackPosition = candidate;

      if (avoidSafeZones && this.isInSafeZone(candidate)) continue;

      if (hasDistanceConstraint) {
        const dx = candidate.x - minDistanceFrom.x;
        const dy = candidate.y - minDistanceFrom.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < minDistanceSquared) continue;
        if (distanceSquared > maxDistanceSquared) continue;
      }

      return candidate;
    }

    return fallbackPosition;
  }

  randomBetween(min, max) {
    return min + Math.random() * Math.max(0, max - min);
  }
}

module.exports = BossEncounterManager;
