#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

const ROOT_DIR = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT_DIR, '.env') });
const DEFAULT_PORT = Number(process.env.SMOKE_TEST_PORT || 3300);
const SERVER_START_TIMEOUT_MS = Number(process.env.SMOKE_TEST_SERVER_TIMEOUT_MS || 60000);
const STEP_TIMEOUT_MS = Number(process.env.SMOKE_TEST_STEP_TIMEOUT_MS || 180000);
const PROVIDED_USER_ID = process.env.SMOKE_TEST_USER_ID || '';
const PROVIDED_AUTH_TOKEN = process.env.SMOKE_TEST_AUTH_TOKEN || '';
const NICKNAME = process.env.SMOKE_TEST_NICKNAME || 'SmokeBot';
const VERBOSE_SERVER_LOGS = process.env.SMOKE_TEST_VERBOSE === 'true';
const SHOT_COOLDOWN_MS = Number(process.env.SMOKE_TEST_SHOT_COOLDOWN_MS || 1500);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.unref();
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(basePort, attempts = 25) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const candidate = basePort + offset;
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }
  throw new Error(`No free port found in range ${basePort}-${basePort + attempts - 1}`);
}

function randomClientId() {
  return `smoke_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function assertOrThrow(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function appendLog(logs, text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    logs.push(line);
  }
  if (logs.length > 300) {
    logs.splice(0, logs.length - 300);
  }
}

function httpGet(port, route) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: route,
        method: 'GET',
        timeout: 2500
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk.toString();
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            body
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('HTTP request timed out'));
    });
    req.on('error', reject);
    req.end();
  });
}

function httpPostJson(port, route, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload || {});
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: route,
        method: 'POST',
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...headers
        }
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk.toString();
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            body: responseBody
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('HTTP request timed out'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function normalizeUsername(base) {
  return String(base || 'smokebot').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'smokebot';
}

function getSupabaseRuntimeConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, anonKey, serviceKey };
}

async function provisionSmokeCredentials() {
  if (PROVIDED_USER_ID && PROVIDED_AUTH_TOKEN) {
    return {
      userId: PROVIDED_USER_ID,
      authToken: PROVIDED_AUTH_TOKEN,
      source: 'env',
      cleanup: null
    };
  }

  const { url, anonKey, serviceKey } = getSupabaseRuntimeConfig();
  assertOrThrow(url && anonKey && serviceKey, 'Missing Supabase env config for auto-provisioning smoke credentials');

  const adminClient = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  const authClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const email = `smoke_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = `Smoke!${Math.random().toString(36).slice(2, 10)}A1`;

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      smoke_test: true
    }
  });
  if (createError) {
    throw new Error(`Cannot create smoke user: ${createError.message}`);
  }
  const createdUserId = created?.user?.id;
  assertOrThrow(createdUserId, 'Cannot create smoke user: missing user id');

  const { data: sessionData, error: signInError } = await authClient.auth.signInWithPassword({
    email,
    password
  });
  if (signInError) {
    throw new Error(`Cannot sign in smoke user: ${signInError.message}`);
  }

  const authToken = sessionData?.session?.access_token || '';
  const userId = sessionData?.user?.id || createdUserId;
  assertOrThrow(authToken && userId, 'Cannot get smoke auth token');

  return {
    userId,
    authToken,
    source: 'auto',
    cleanup: async () => {
      try {
        await adminClient.auth.admin.deleteUser(userId);
      } catch (error) {
        // Non bloccare il test su cleanup.
      }
    }
  };
}

async function ensurePlayerProfile(port, authToken, usernameBase) {
  const normalizedBase = normalizeUsername(usernameBase);
  const maxAttempts = 12;
  const stableSuffix = Math.random().toString(36).slice(2, 8);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const usernameSuffix = attempt === 0 ? `_${stableSuffix}` : `_${stableSuffix}${attempt}`;
    const baseLength = Math.max(1, 20 - usernameSuffix.length);
    const username = `${normalizedBase.slice(0, baseLength)}${usernameSuffix}`;
    const response = await httpPostJson(
      port,
      '/api/create-profile',
      { username },
      {
        Authorization: `Bearer ${authToken}`
      }
    );

    if (response.statusCode === 200) {
      await sleep(250);
      return;
    }

    const parsed = safeJsonParse(response.body);
    const errorMessage = String(parsed?.error || response.body || '').toLowerCase();
    const profileAlreadyExists =
      (errorMessage.includes('profile') && errorMessage.includes('already')) ||
      errorMessage.includes('already has a profile') ||
      errorMessage.includes('already exists for this auth');
    const usernameConflict =
      errorMessage.includes('user_profiles_username_key') ||
      (errorMessage.includes('username') && (
        errorMessage.includes('duplicate') ||
        errorMessage.includes('exists') ||
        errorMessage.includes('taken') ||
        errorMessage.includes('key')
      ));
    const isRateLimited = response.statusCode === 429 || errorMessage.includes('too many requests');

    if (profileAlreadyExists) {
      return;
    }

    if ((usernameConflict || isRateLimited) && attempt < maxAttempts - 1) {
      await sleep(isRateLimited ? 1200 : 300);
      continue;
    }

    throw new Error(`create-profile failed (${response.statusCode}): ${parsed?.error || response.body}`);
  }

  throw new Error('Unable to create or verify player profile for smoke test user');
}

async function waitForServerHealth(port, timeoutMs, serverHandle = null) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    if (serverHandle?.exit) {
      const exitCode = Number.isFinite(serverHandle.exit.code) ? serverHandle.exit.code : 'unknown';
      const exitSignal = serverHandle.exit.signal || 'none';
      throw new Error(`Server exited before healthcheck (code=${exitCode}, signal=${exitSignal})`);
    }

    try {
      const health = await httpGet(port, '/health');
      if (health.statusCode === 200 && health.body.includes('OK')) {
        return;
      }
      lastError = new Error(`Unexpected health response: ${health.statusCode} ${health.body}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(1000);
  }

  throw new Error(`Server healthcheck timeout after ${timeoutMs}ms: ${lastError?.message || 'unknown error'}`);
}

function startServer(port) {
  const logs = [];
  const env = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: process.env.NODE_ENV || 'development'
  };

  const child = spawn(process.execPath, ['server.cjs'], {
    cwd: ROOT_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    appendLog(logs, `[stdout] ${text}`);
    if (VERBOSE_SERVER_LOGS) {
      process.stdout.write(`[server] ${text}`);
    }
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    appendLog(logs, `[stderr] ${text}`);
    process.stderr.write(`[server-err] ${text}`);
  });

  const serverHandle = {
    child,
    logs,
    exit: null
  };

  child.once('exit', (code, signal) => {
    serverHandle.exit = {
      code,
      signal
    };
  });

  return serverHandle;
}

async function stopServer(serverHandle) {
  if (!serverHandle?.child || serverHandle.child.killed) return;

  const { child } = serverHandle;
  child.kill('SIGINT');

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
      resolve();
    }, 8000);

    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

class SmokeClient {
  constructor({ wsUrl, userId, authToken, nickname }) {
    this.wsUrl = wsUrl;
    this.userId = userId;
    this.authToken = authToken;
    this.nickname = nickname;
    this.initialClientId = randomClientId();
    this.clientId = this.initialClientId;
    this.ws = null;

    this.position = { x: 250, y: 250, rotation: 0 };
    this.nextTick = 1;
    this.lastPlayerDataRequestAt = 0;
    this.lastCombatTargetId = null;
    this.lastRespawnAt = 0;
    this.isDead = false;
    this.isCombatActive = false;
    this.combatTargetId = null;
    this.pendingCombatTargetId = null;
    this.pendingCombatUntil = 0;
    this.nextCombatStartAt = 0;
    this.combatEstimateBaseShots = 0;
    this.combatEstimateStartedAt = 0;
    this.lastNpcHitAt = 0;
    this.lastNpcHitTargetId = null;

    this.messages = [];
    this.waiters = [];

    this.npcs = new Map();
    this.ownShots = 0;
    this.maxEffectiveShotsObserved = 0;
    this.ownKills = 0;
    this.rewardsSeen = [];
    this.rewardByKillOp = new Map();
    this.entityDestroyedByNpcId = new Map();
    this.lastRewardEventAt = 0;
    this.lastRewardPayload = null;
    this.lastKillEventAt = 0;
    this.lastKilledNpcId = null;
  }

  onMessage(raw) {
    let message = null;
    try {
      message = JSON.parse(raw.toString());
    } catch (error) {
      return;
    }

    this.messages.push(message);
    if (this.messages.length > 300) {
      this.messages.shift();
    }

    this.updateStateFromMessage(message);
    this.resolveWaiters(message);
  }

  updateNpcCache(compactList) {
    if (!Array.isArray(compactList)) return;
    for (const packed of compactList) {
      if (!Array.isArray(packed) || packed.length < 4) continue;
      const npc = {
        id: packed[0],
        type: packed[1],
        x: Number(packed[2]),
        y: Number(packed[3]),
        rotation: Number(packed[4] || 0),
        health: Number(packed[5] || 0),
        maxHealth: Number(packed[6] || 0),
        shield: Number(packed[7] || 0),
        maxShield: Number(packed[8] || 0)
      };
      this.npcs.set(npc.id, npc);
    }
  }

  updateStateFromMessage(message) {
    if (message.type === 'welcome') {
      if (message.clientId) this.clientId = String(message.clientId);
      const initialPosition = message.initialState?.position;
      if (initialPosition && Number.isFinite(initialPosition.x) && Number.isFinite(initialPosition.y)) {
        this.position.x = Number(initialPosition.x);
        this.position.y = Number(initialPosition.y);
        this.position.rotation = Number(initialPosition.rotation || 0);
      }
      return;
    }

    if (message.type === 'initial_npcs' || message.type === 'npc_bulk_update') {
      this.updateNpcCache(message.n);
      return;
    }

    if (message.type === 'entity_destroyed') {
      if (message.entityType === 'npc') {
        const npcId = String(message.entityId || '');
        this.npcs.delete(message.entityId);
        if (npcId) {
          const currentCount = this.entityDestroyedByNpcId.get(npcId) || 0;
          this.entityDestroyedByNpcId.set(npcId, currentCount + 1);
        }

        if (this.combatTargetId && npcId && npcId === String(this.combatTargetId)) {
          this.isCombatActive = false;
          this.combatTargetId = null;
          this.pendingCombatTargetId = null;
          this.pendingCombatUntil = 0;
        }
        if (message.destroyerId === this.clientId) {
          this.ownKills += 1;
          this.lastKillEventAt = Date.now();
          this.lastKilledNpcId = npcId || null;
        }
      }
      if (message.entityType === 'player' && message.entityId === this.clientId) {
        this.isDead = true;
        this.isCombatActive = false;
        this.combatTargetId = null;
        this.pendingCombatTargetId = null;
        this.pendingCombatUntil = 0;
      }
      return;
    }

    if (message.type === 'player_respawn' && message.clientId === this.clientId) {
      this.isDead = false;
      this.isCombatActive = false;
      this.combatTargetId = null;
      this.pendingCombatTargetId = null;
      this.pendingCombatUntil = 0;
      if (message.position) {
        this.position.x = Number(message.position.x || this.position.x);
        this.position.y = Number(message.position.y || this.position.y);
        this.position.rotation = Number(message.position.rotation || this.position.rotation);
      }
      return;
    }

    if (message.type === 'map_transition_start' && message.targetPosition) {
      this.position.x = Number(message.targetPosition.x || this.position.x);
      this.position.y = Number(message.targetPosition.y || this.position.y);
      this.position.rotation = Number(message.targetPosition.rotation || this.position.rotation);
      return;
    }

    if (message.type === 'map_change' && message.position) {
      this.position.x = Number(message.position.x || this.position.x);
      this.position.y = Number(message.position.y || this.position.y);
      this.position.rotation = Number(message.position.rotation || this.position.rotation);
      return;
    }

    if (message.type === 'projectile_fired' && message.playerId === this.clientId) {
      this.ownShots += 1;
      return;
    }

    if (message.type === 'combat_update' && message.clientId === this.clientId) {
      if (message.isAttacking && message.npcId) {
        this.isCombatActive = true;
        this.combatTargetId = String(message.npcId);
        this.pendingCombatTargetId = null;
        this.pendingCombatUntil = 0;
        if (!this.combatEstimateStartedAt) {
          this.combatEstimateBaseShots = this.ownShots;
          this.combatEstimateStartedAt = Date.now();
        }
      } else if (this.combatEstimateStartedAt) {
        this.isCombatActive = false;
        this.combatTargetId = null;
        this.pendingCombatTargetId = null;
        this.pendingCombatUntil = 0;
        this.combatEstimateStartedAt = 0;
      }
      return;
    }

    if (message.type === 'stop_combat') {
      const messagePlayerId = String(message.playerId || '');
      const messageClientId = String(message.clientId || '');
      const isCurrentPlayer = messagePlayerId === this.clientId || messageClientId === this.clientId;
      if (isCurrentPlayer) {
        this.isCombatActive = false;
        this.combatTargetId = null;
        this.pendingCombatTargetId = null;
        this.pendingCombatUntil = 0;
      }
      return;
    }

    if (message.type === 'combat_error') {
      this.pendingCombatTargetId = null;
      this.pendingCombatUntil = 0;
      return;
    }

    if (message.type === 'entity_damaged' && message.entityType === 'npc' && String(message.attackerId) === this.clientId) {
      this.lastNpcHitAt = Date.now();
      this.lastNpcHitTargetId = String(message.entityId || '');
      return;
    }

    if (message.type === 'player_state_update' && message.rewardsEarned) {
      const rewardsPayload = message.rewardsEarned || {};
      this.rewardsSeen.push(rewardsPayload);
      this.lastRewardEventAt = Date.now();
      this.lastRewardPayload = rewardsPayload;

      const killOpId = String(rewardsPayload.killOpId || '').trim();
      if (killOpId) {
        const currentCount = this.rewardByKillOp.get(killOpId) || 0;
        this.rewardByKillOp.set(killOpId, currentCount + 1);
      }
      return;
    }
  }

  resolveWaiters(message) {
    const remaining = [];
    for (const waiter of this.waiters) {
      let matched = false;
      try {
        matched = waiter.predicate(message, this);
      } catch (error) {
        waiter.reject(error);
        continue;
      }

      if (matched) {
        clearTimeout(waiter.timeoutId);
        waiter.resolve(message);
      } else {
        remaining.push(waiter);
      }
    }
    this.waiters = remaining;
  }

  waitFor(predicate, timeoutMs, label) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.waiters = this.waiters.filter((waiter) => waiter.timeoutId !== timeoutId);
        reject(new Error(`Timeout waiting for ${label}`));
      }, timeoutMs);

      this.waiters.push({
        predicate,
        resolve,
        reject,
        timeoutId
      });
    });
  }

  connectAndJoin() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;

      ws.once('open', async () => {
        try {
          this.sendRaw({
            type: 'join',
            clientId: this.initialClientId,
            nickname: this.nickname,
            userId: this.userId,
            authToken: this.authToken,
            position: {
              x: this.position.x,
              y: this.position.y,
              rotation: this.position.rotation,
              velocityX: 0,
              velocityY: 0
            }
          });

          await this.waitFor((message) => message.type === 'welcome', STEP_TIMEOUT_MS, 'welcome');
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      ws.on('message', (raw) => this.onMessage(raw));

      ws.once('error', reject);
      ws.once('close', (code, reasonBuffer) => {
        const reason = reasonBuffer?.toString() || '';
        if (!this.clientId || this.clientId === this.initialClientId) {
          reject(new Error(`Socket closed before welcome: ${code} ${reason}`));
        }
      });
    });
  }

  sendRaw(payload) {
    assertOrThrow(this.ws && this.ws.readyState === WebSocket.OPEN, 'WebSocket is not connected');
    this.ws.send(JSON.stringify(payload));
  }

  send(payload) {
    const message = {
      ...payload,
      clientId: payload.clientId || this.clientId
    };
    this.sendRaw(message);
  }

  sendPositionUpdate(vx, vy) {
    const dtSec = 0.1;
    this.position.x += vx * dtSec;
    this.position.y += vy * dtSec;
    if (Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001) {
      this.position.rotation = Math.atan2(vy, vx);
    }

    this.send({
      type: 'position_update',
      x: this.position.x,
      y: this.position.y,
      rotation: this.position.rotation,
      velocityX: vx,
      velocityY: vy,
      tick: this.nextTick,
      t: Date.now()
    });
    this.nextTick += 1;
  }

  async movePattern(durationMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < durationMs) {
      const elapsedSec = (Date.now() - startedAt) / 1000;
      const speed = 220;
      const vx = Math.cos(elapsedSec * 0.8) * speed;
      const vy = Math.sin(elapsedSec * 0.8) * speed;
      this.sendPositionUpdate(vx, vy);
      await sleep(100);
    }
  }

  async upgradeForCombat() {
    await this.sendUpgradeSequence('damage', 12, 1300);
    await this.sendUpgradeSequence('shield', 4, 1300);
    await this.sendUpgradeSequence('speed', 6, 1300);
  }

  async sendUpgradeSequence(upgradeType, attempts, delayMs) {
    for (let index = 0; index < attempts; index += 1) {
      this.send({
        type: 'skill_upgrade_request',
        upgradeType
      });

      let response = null;
      try {
        response = await this.waitFor(
          (message) => {
            if (message.type === 'player_state_update' && message.source === `skill_upgrade_${upgradeType}`) {
              return true;
            }
            if (message.type === 'error') {
              return true;
            }
            return false;
          },
          7000,
          `skill_upgrade_${upgradeType}`
        );
      } catch (error) {
        response = null;
      }

      if (response?.type === 'error') {
        const text = `${response.message || ''} ${response.code || ''}`.toLowerCase();
        if (text.includes('insufficient') || text.includes('not enough') || text.includes('max')) {
          break;
        }
      }

      await sleep(delayMs);
    }
  }

  distanceTo(point) {
    const dx = point.x - this.position.x;
    const dy = point.y - this.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getNearestNpc() {
    let nearest = null;
    let minDist = Number.POSITIVE_INFINITY;
    for (const npc of this.npcs.values()) {
      const dist = this.distanceTo(npc);
      if (dist < minDist) {
        minDist = dist;
        nearest = npc;
      }
    }
    return nearest;
  }

  getBestNpcTarget() {
    const durabilityMultipliers = {
      Scouter: 0.8,
      Guard: 1.0,
      Kronos: 1.5,
      Pyramid: 1.8
    };

    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const npc of this.npcs.values()) {
      const durability = Math.max(1, Number(npc.health || 0) + Number(npc.shield || 0));
      const dist = this.distanceTo(npc);
      if (dist > 3500) continue;
      const typeMultiplier = durabilityMultipliers[npc.type] || 1.2;
      const score = (durability * typeMultiplier) + (dist * 1.5);
      if (score < bestScore) {
        best = npc;
        bestScore = score;
      }
    }
    return best;
  }

  async waitForNpcAvailability(timeoutMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const npc = this.getNearestNpc();
      if (npc) return npc;
      this.sendPositionUpdate(120, 0);
      await sleep(120);
    }
    throw new Error(`No NPC available within ${timeoutMs}ms`);
  }

  async combatUntilMilestones({ requiredShots, requiredKills, timeoutMs }) {
    let activeTarget = await this.waitForNpcAvailability(30000);
    let activeTargetId = activeTarget ? String(activeTarget.id) : null;
    let activeTargetLockedAt = Date.now();
    let killsAtTargetLock = this.ownKills;

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const effectiveShots = this.trackEffectiveShotCount();
      if (effectiveShots >= requiredShots && this.ownKills >= requiredKills) {
        return;
      }

      if (this.isDead) {
        const now = Date.now();
        if (now - this.lastRespawnAt > 2000) {
          this.send({
            type: 'player_respawn_request'
          });
          this.lastRespawnAt = now;
        }
        await sleep(150);
        activeTarget = null;
        activeTargetId = null;
        this.isCombatActive = false;
        this.combatTargetId = null;
        this.pendingCombatTargetId = null;
        this.pendingCombatUntil = 0;
        continue;
      }

      if (!activeTarget || !this.npcs.has(activeTarget.id)) {
        activeTarget = this.getBestNpcTarget() || this.getNearestNpc();
        if (!activeTarget) {
          await sleep(250);
          continue;
        }
      }

      const target = this.npcs.get(activeTarget.id);
      if (!target) {
        await sleep(100);
        continue;
      }

      const dist = this.distanceTo(target);
      let vx = 0;
      let vy = 0;
      if (dist > 360) {
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        const inv = dist > 0 ? 1 / dist : 0;
        const speed = 280;
        vx = dx * inv * speed;
        vy = dy * inv * speed;
      }
      this.sendPositionUpdate(vx, vy);

      const now = Date.now();
      const normalizedTargetId = String(target.id);
      if (normalizedTargetId !== activeTargetId) {
        activeTargetId = normalizedTargetId;
        activeTargetLockedAt = now;
        killsAtTargetLock = this.ownKills;
      }

      const lastHitAtTarget = this.lastNpcHitTargetId === normalizedTargetId ? this.lastNpcHitAt : 0;
      const noHitsOnTarget = !lastHitAtTarget && (now - activeTargetLockedAt) > 15000;
      const staleHitsOnTarget = lastHitAtTarget > 0 && (now - lastHitAtTarget) > 12000 && (now - activeTargetLockedAt) > 12000;
      const noKillProgress = this.ownKills === killsAtTargetLock && (now - activeTargetLockedAt) > 45000;
      if (noHitsOnTarget || staleHitsOnTarget || noKillProgress) {
        this.sendStopCombat();
        activeTarget = null;
        activeTargetId = null;
        await sleep(150);
        continue;
      }

      const needsStart = !this.isCombatActive || this.combatTargetId !== normalizedTargetId;
      const pendingExpired = this.pendingCombatUntil <= now;
      const samePendingTarget = this.pendingCombatTargetId === normalizedTargetId;

      if (needsStart && now >= this.nextCombatStartAt && (pendingExpired || !samePendingTarget)) {
        this.send({
          type: 'start_combat',
          npcId: target.id
        });
        this.lastCombatTargetId = target.id;
        this.pendingCombatTargetId = normalizedTargetId;
        this.pendingCombatUntil = now + 1800;
        this.nextCombatStartAt = now + 1300;
      }

      await sleep(100);
    }

    throw new Error(`Combat milestones not reached in ${timeoutMs}ms (rawShots=${this.ownShots}, maxEffectiveShots=${this.maxEffectiveShotsObserved}, kills=${this.ownKills})`);
  }

  async combatUntilRewardWindowAndDisconnect({ requiredShots, requiredKills, timeoutMs }) {
    let activeTarget = await this.waitForNpcAvailability(30000);
    let activeTargetId = activeTarget ? String(activeTarget.id) : null;
    let activeTargetLockedAt = Date.now();
    let killsAtTargetLock = this.ownKills;
    const startedAt = Date.now();
    const killsAtStart = this.ownKills;

    while (Date.now() - startedAt < timeoutMs) {
      const effectiveShots = this.trackEffectiveShotCount();
      const milestonesMet = effectiveShots >= requiredShots && this.ownKills >= requiredKills;

      if (milestonesMet && this.lastRewardEventAt >= startedAt) {
        const trigger = 'reward';
        const killOpId = this.lastRewardPayload?.killOpId || null;
        const npcId = this.lastRewardPayload?.npcId || this.lastKilledNpcId || null;
        this.sendStopCombat();
        await sleep(50);
        await this.disconnect();
        return { trigger, killOpId, npcId };
      }

      if (this.isDead) {
        const now = Date.now();
        if (now - this.lastRespawnAt > 2000) {
          this.send({
            type: 'player_respawn_request'
          });
          this.lastRespawnAt = now;
        }
        await sleep(150);
        activeTarget = null;
        activeTargetId = null;
        this.isCombatActive = false;
        this.combatTargetId = null;
        this.pendingCombatTargetId = null;
        this.pendingCombatUntil = 0;
        continue;
      }

      if (!activeTarget || !this.npcs.has(activeTarget.id)) {
        activeTarget = this.getBestNpcTarget() || this.getNearestNpc();
        if (!activeTarget) {
          await sleep(250);
          continue;
        }
      }

      const target = this.npcs.get(activeTarget.id);
      if (!target) {
        await sleep(100);
        continue;
      }

      const dist = this.distanceTo(target);
      let vx = 0;
      let vy = 0;
      if (dist > 360) {
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        const inv = dist > 0 ? 1 / dist : 0;
        const speed = 280;
        vx = dx * inv * speed;
        vy = dy * inv * speed;
      }
      this.sendPositionUpdate(vx, vy);

      const now = Date.now();
      const normalizedTargetId = String(target.id);
      if (normalizedTargetId !== activeTargetId) {
        activeTargetId = normalizedTargetId;
        activeTargetLockedAt = now;
        killsAtTargetLock = this.ownKills;
      }

      const targetLockedTooLong = now - activeTargetLockedAt > 30000;
      if (targetLockedTooLong) {
        this.sendStopCombat();
        activeTarget = null;
        activeTargetId = null;
        await sleep(150);
        continue;
      }

      const lastHitAtTarget = this.lastNpcHitTargetId === normalizedTargetId ? this.lastNpcHitAt : 0;
      const noHitsOnTarget = !lastHitAtTarget && (now - activeTargetLockedAt) > 15000;
      const staleHitsOnTarget = lastHitAtTarget > 0 && (now - lastHitAtTarget) > 12000 && (now - activeTargetLockedAt) > 12000;
      const noKillProgress = this.ownKills === killsAtTargetLock && (now - activeTargetLockedAt) > 45000;
      if (noHitsOnTarget || staleHitsOnTarget || noKillProgress) {
        this.sendStopCombat();
        activeTarget = null;
        activeTargetId = null;
        await sleep(150);
        continue;
      }

      const needsStart = !this.isCombatActive || this.combatTargetId !== normalizedTargetId;
      const pendingExpired = this.pendingCombatUntil <= now;
      const samePendingTarget = this.pendingCombatTargetId === normalizedTargetId;

      if (needsStart && now >= this.nextCombatStartAt && (pendingExpired || !samePendingTarget)) {
        this.send({
          type: 'start_combat',
          npcId: target.id
        });
        this.lastCombatTargetId = target.id;
        this.pendingCombatTargetId = normalizedTargetId;
        this.pendingCombatUntil = now + 1800;
        this.nextCombatStartAt = now + 1300;
      }

      await sleep(100);
    }

    throw new Error(`Reward window not reached in ${timeoutMs}ms (rawShots=${this.ownShots}, maxEffectiveShots=${this.maxEffectiveShotsObserved}, kills=${this.ownKills}, rewards=${this.rewardsSeen.length}, killsAtStart=${killsAtStart})`);
  }

  getEffectiveShotCount() {
    if (!this.combatEstimateStartedAt) {
      return this.ownShots;
    }

    const elapsed = Math.max(0, Date.now() - this.combatEstimateStartedAt);
    const estimatedDuringCombat = Math.floor(elapsed / Math.max(200, SHOT_COOLDOWN_MS));
    return Math.max(this.ownShots, this.combatEstimateBaseShots + estimatedDuringCombat);
  }

  trackEffectiveShotCount() {
    const current = this.getEffectiveShotCount();
    if (current > this.maxEffectiveShotsObserved) {
      this.maxEffectiveShotsObserved = current;
    }
    return current;
  }

  async requestSave() {
    this.send({ type: 'save_request' });
    const response = await this.waitFor(
      (message) => message.type === 'save_response',
      STEP_TIMEOUT_MS,
      'save_response'
    );
    if (!response.success) {
      throw new Error(`save_request failed: ${response.message || response.error || 'unknown error'}`);
    }
  }

  async requestPlayerData() {
    const elapsed = Date.now() - this.lastPlayerDataRequestAt;
    if (elapsed < 1100) {
      await sleep(1100 - elapsed);
    }

    this.send({ type: 'request_player_data' });
    this.lastPlayerDataRequestAt = Date.now();

    return this.waitFor(
      (message) => message.type === 'player_data_response',
      STEP_TIMEOUT_MS,
      'player_data_response'
    );
  }

  sendStopCombat() {
    if (!this.lastCombatTargetId) return;
    this.send({
      type: 'stop_combat',
      npcId: this.lastCombatTargetId
    });
    this.isCombatActive = false;
    this.combatTargetId = null;
    this.pendingCombatTargetId = null;
    this.pendingCombatUntil = 0;
  }

  async disconnect() {
    if (!this.ws) return;
    const ws = this.ws;
    await new Promise((resolve) => {
      ws.once('close', () => resolve());
      ws.close(1000, 'smoke-test');
      setTimeout(resolve, 2000);
    });
    this.ws = null;
  }
}

function pickCurrencies(payload) {
  const inventory = payload?.inventory || {};
  return {
    credits: Number(inventory.credits || 0),
    cosmos: Number(inventory.cosmos || 0),
    experience: Number(inventory.experience || 0),
    honor: Number(inventory.honor || 0)
  };
}

async function runScenario(port, credentials) {
  const wsUrl = `ws://127.0.0.1:${port}`;
  const client = new SmokeClient({
    wsUrl,
    userId: credentials.userId,
    authToken: credentials.authToken,
    nickname: NICKNAME
  });

  console.log('1/8 Join and spawn');
  await client.connectAndJoin();
  await client.waitForNpcAvailability(30000);

  console.log('2/8 Move for 10 seconds');
  await client.movePattern(10000);

  console.log('3/8 Upgrade combat stats');
  await client.upgradeForCombat();

  console.log('4/8 Capture baseline before race disconnect');
  client.sendStopCombat();
  await sleep(300);
  const beforeRaceDisconnect = await client.requestPlayerData();

  console.log('5/8 Combat and disconnect in reward window');
  let raceResult = null;
  let rewardWindowError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      raceResult = await client.combatUntilRewardWindowAndDisconnect({
        requiredShots: 20,
        requiredKills: 1,
        timeoutMs: Math.max(STEP_TIMEOUT_MS, 180000)
      });
      rewardWindowError = null;
      break;
    } catch (error) {
      rewardWindowError = error;
      if (attempt < 1) {
        client.sendStopCombat();
        await sleep(300);
        await client.movePattern(3000);
      }
    }
  }
  if (rewardWindowError) {
    throw rewardWindowError;
  }

  console.log('6/8 Reconnect and reload');
  const client2 = new SmokeClient({
    wsUrl,
    userId: credentials.userId,
    authToken: credentials.authToken,
    nickname: `${NICKNAME}-R`
  });
  await client2.connectAndJoin();
  const afterReconnect = await client2.requestPlayerData();

  console.log('7/8 Validate persistence/idempotency and save');
  const beforeCurrencies = pickCurrencies(beforeRaceDisconnect);
  const afterCurrencies = pickCurrencies(afterReconnect);

  assertOrThrow(afterCurrencies.credits >= beforeCurrencies.credits, `credits regressed (${beforeCurrencies.credits} -> ${afterCurrencies.credits})`);
  assertOrThrow(afterCurrencies.cosmos >= beforeCurrencies.cosmos, `cosmos regressed (${beforeCurrencies.cosmos} -> ${afterCurrencies.cosmos})`);
  assertOrThrow(afterCurrencies.experience >= beforeCurrencies.experience, `experience regressed (${beforeCurrencies.experience} -> ${afterCurrencies.experience})`);
  assertOrThrow(afterCurrencies.honor >= beforeCurrencies.honor, `honor regressed (${beforeCurrencies.honor} -> ${afterCurrencies.honor})`);

  const rewardImproved =
    afterCurrencies.credits > beforeCurrencies.credits ||
    afterCurrencies.cosmos > beforeCurrencies.cosmos ||
    afterCurrencies.experience > beforeCurrencies.experience ||
    afterCurrencies.honor > beforeCurrencies.honor;
  assertOrThrow(rewardImproved, 'No reward progression observed after race disconnect/reconnect');

  assertOrThrow((client.rewardsSeen.length || 0) >= 1, 'Expected at least one reward event before race disconnect');
  assertOrThrow(raceResult?.trigger === 'reward', `Unexpected race trigger: ${raceResult?.trigger || 'none'}`);

  const duplicateRewardOps = Array.from(client.rewardByKillOp.entries()).filter(([, count]) => count > 1);
  assertOrThrow(
    duplicateRewardOps.length === 0,
    `Duplicate reward operations detected: ${duplicateRewardOps.map(([opId, count]) => `${opId}x${count}`).join(', ')}`
  );

  const duplicateEntityDestroyed = Array.from(client.entityDestroyedByNpcId.entries()).filter(([, count]) => count > 1);
  assertOrThrow(
    duplicateEntityDestroyed.length === 0,
    `Duplicate entity_destroyed detected: ${duplicateEntityDestroyed.map(([npcId, count]) => `${npcId}x${count}`).join(', ')}`
  );

  if (raceResult?.killOpId) {
    assertOrThrow(
      (client.rewardByKillOp.get(raceResult.killOpId) || 0) === 1,
      `Race reward duplicated for killOpId=${raceResult.killOpId}`
    );
  }

  await client2.requestSave();

  console.log('8/8 Disconnect');
  await client2.disconnect();
  client.trackEffectiveShotCount();

  return {
    shots: client.ownShots,
    maxEffectiveShots: client.maxEffectiveShotsObserved,
    kills: client.ownKills,
    rewardsSeen: client.rewardsSeen.length,
    raceTrigger: raceResult?.trigger || null,
    raceKillOpId: raceResult?.killOpId || null,
    duplicateRewardOps: duplicateRewardOps.length,
    duplicateEntityDestroyed: duplicateEntityDestroyed.length,
    beforeCurrencies,
    afterCurrencies
  };
}


async function main() {
  let serverHandle = null;
  let selectedPort = DEFAULT_PORT;
  let credentials = null;

  try {
    selectedPort = await findAvailablePort(DEFAULT_PORT);
    if (selectedPort !== DEFAULT_PORT) {
      console.log(`Port ${DEFAULT_PORT} occupied, using ${selectedPort}`);
    }

    serverHandle = startServer(selectedPort);
    await waitForServerHealth(selectedPort, SERVER_START_TIMEOUT_MS, serverHandle);
    credentials = await provisionSmokeCredentials();
    console.log(`Auth credentials source: ${credentials.source}`);
    await ensurePlayerProfile(selectedPort, credentials.authToken, NICKNAME);

    const summary = await runScenario(selectedPort, credentials);
    console.log('SMOKE TEST PASSED');
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 0;
  } catch (error) {
    console.error('SMOKE TEST FAILED:', error.message);
    if (serverHandle.logs.length > 0) {
      console.error('--- Last server logs ---');
      for (const line of serverHandle.logs.slice(-40)) {
        console.error(line);
      }
    }
    process.exitCode = 1;
  } finally {
    if (credentials?.cleanup) {
      await credentials.cleanup();
    }
    await stopServer(serverHandle);
  }
}

main().catch((error) => {
  console.error('SMOKE TEST FATAL:', error.message);
  process.exit(1);
});
