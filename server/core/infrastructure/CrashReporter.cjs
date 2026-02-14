const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { logger } = require('../../logger.cjs');

const DEFAULT_SESSION_EVENT_BUFFER = Number(process.env.CRASH_EVENT_BUFFER_SIZE || 120);
const DEFAULT_GLOBAL_EVENT_BUFFER = Number(process.env.CRASH_GLOBAL_EVENT_BUFFER_SIZE || 600);
const DEFAULT_MAX_SESSIONS = Number(process.env.CRASH_MAX_SESSIONS || 300);
const DEFAULT_REPORT_DIR = process.env.CRASH_REPORT_DIR || path.join(process.cwd(), 'logs', 'crash-reports');
const MAX_STRING_LENGTH = 600;
const MAX_OBJECT_KEYS = 30;
const MAX_ARRAY_ITEMS = 30;
const MAX_SANITIZE_DEPTH = 4;

function generateId(prefix) {
  if (typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function clampNumber(value, fallback) {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function truncateString(value, maxLength = MAX_STRING_LENGTH) {
  if (typeof value !== 'string') return value;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

function pushRing(buffer, item, maxItems) {
  buffer.push(item);
  if (buffer.length > maxItems) {
    buffer.splice(0, buffer.length - maxItems);
  }
}

function toErrorObject(errorLike) {
  if (errorLike instanceof Error) {
    return {
      name: errorLike.name,
      message: errorLike.message,
      stack: truncateString(errorLike.stack || '')
    };
  }

  if (typeof errorLike === 'string') {
    return {
      name: 'Error',
      message: errorLike,
      stack: null
    };
  }

  let serialized = null;
  try {
    serialized = JSON.stringify(errorLike);
  } catch (serializationError) {
    serialized = String(errorLike);
  }

  return {
    name: 'NonErrorRejection',
    message: truncateString(serialized),
    stack: null
  };
}

function sanitizeValue(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') return truncateString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return toErrorObject(value);

  if (depth >= MAX_SANITIZE_DEPTH) {
    if (Array.isArray(value)) return `[Array(${value.length})]`;
    return `[Object ${value.constructor?.name || 'Object'}]`;
  }

  if (Array.isArray(value)) {
    const sanitized = value.slice(0, MAX_ARRAY_ITEMS).map((entry) => sanitizeValue(entry, depth + 1, seen));
    if (value.length > MAX_ARRAY_ITEMS) {
      sanitized.push(`[+${value.length - MAX_ARRAY_ITEMS} more]`);
    }
    return sanitized;
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    const keys = Object.keys(value);
    const limitedKeys = keys.slice(0, MAX_OBJECT_KEYS);
    const sanitized = {};

    for (const key of limitedKeys) {
      sanitized[key] = sanitizeValue(value[key], depth + 1, seen);
    }

    if (keys.length > MAX_OBJECT_KEYS) {
      sanitized.__truncatedKeys = keys.length - MAX_OBJECT_KEYS;
    }

    seen.delete(value);
    return sanitized;
  }

  return String(value);
}

class CrashReporter {
  constructor() {
    this.sessionEventBufferSize = clampNumber(DEFAULT_SESSION_EVENT_BUFFER, 120);
    this.globalEventBufferSize = clampNumber(DEFAULT_GLOBAL_EVENT_BUFFER, 600);
    this.maxSessions = clampNumber(DEFAULT_MAX_SESSIONS, 300);
    this.reportDir = DEFAULT_REPORT_DIR;

    this.sessions = new Map();
    this.globalEvents = [];
    this.clientIdToSessionId = new Map();
    this.playerIdToSessionId = new Map();
    this.userIdToSessionId = new Map();
  }

  startSession(metadata = {}) {
    const sessionId = generateId('sess');
    const session = {
      sessionId,
      startedAt: new Date().toISOString(),
      closedAt: null,
      playerDbId: null,
      playerClientId: null,
      userId: null,
      nickname: null,
      metadata: sanitizeValue(metadata),
      events: []
    };

    this.sessions.set(sessionId, session);
    this._cleanupSessions();
    this.recordEvent({
      sessionId,
      eventType: 'session_started',
      payload: metadata
    });

    return sessionId;
  }

  bindWebSocket(ws, metadata = {}) {
    if (!ws) return null;
    const sessionId = this.startSession(metadata);
    ws.__crashSessionId = sessionId;
    return sessionId;
  }

  getSessionIdFromWebSocket(ws) {
    return ws?.__crashSessionId || null;
  }

  attachPlayer(sessionId, playerData = {}) {
    if (!sessionId) return;
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const playerDbId = playerData.playerId !== undefined && playerData.playerId !== null
      ? String(playerData.playerId)
      : null;
    const playerClientId = playerData.clientId ? String(playerData.clientId) : null;
    const userId = playerData.userId ? String(playerData.userId) : null;
    const nickname = playerData.nickname ? String(playerData.nickname) : null;

    session.playerDbId = playerDbId;
    session.playerClientId = playerClientId;
    session.userId = userId;
    session.nickname = nickname;

    if (playerClientId) this.clientIdToSessionId.set(playerClientId, sessionId);
    if (playerDbId) this.playerIdToSessionId.set(playerDbId, sessionId);
    if (userId) this.userIdToSessionId.set(userId, sessionId);

    this.recordEvent({
      sessionId,
      eventType: 'session_player_bound',
      payload: {
        playerDbId,
        playerClientId,
        userId,
        nickname
      }
    });
  }

  closeSession(sessionId, metadata = {}) {
    if (!sessionId) return;
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.closedAt = new Date().toISOString();
    this.recordEvent({
      sessionId,
      eventType: 'session_closed',
      payload: metadata
    });

    if (session.playerClientId) this.clientIdToSessionId.delete(session.playerClientId);
    if (session.playerDbId) this.playerIdToSessionId.delete(session.playerDbId);
    if (session.userId) this.userIdToSessionId.delete(session.userId);
  }

  resolveSessionId({ sessionId = null, clientId = null, playerDbId = null, userId = null } = {}) {
    if (sessionId && this.sessions.has(sessionId)) return sessionId;
    if (clientId && this.clientIdToSessionId.has(String(clientId))) return this.clientIdToSessionId.get(String(clientId));
    if (playerDbId && this.playerIdToSessionId.has(String(playerDbId))) return this.playerIdToSessionId.get(String(playerDbId));
    if (userId && this.userIdToSessionId.has(String(userId))) return this.userIdToSessionId.get(String(userId));
    return null;
  }

  recordEvent({ sessionId = null, clientId = null, playerDbId = null, userId = null, eventType = 'event', payload = {} } = {}) {
    const resolvedSessionId = this.resolveSessionId({
      sessionId,
      clientId,
      playerDbId,
      userId
    });
    const session = resolvedSessionId ? this.sessions.get(resolvedSessionId) : null;

    const event = {
      timestamp: new Date().toISOString(),
      sessionId: resolvedSessionId,
      eventType,
      playerDbId: session?.playerDbId || (playerDbId ? String(playerDbId) : null),
      playerClientId: session?.playerClientId || (clientId ? String(clientId) : null),
      userId: session?.userId || (userId ? String(userId) : null),
      nickname: session?.nickname || null,
      payload: sanitizeValue(payload)
    };

    pushRing(this.globalEvents, event, this.globalEventBufferSize);
    if (session) {
      pushRing(session.events, event, this.sessionEventBufferSize);
    }

    return event;
  }

  recordEventForClient(clientId, eventType, payload = {}) {
    return this.recordEvent({
      clientId,
      eventType,
      payload
    });
  }

  captureException(errorLike, context = {}) {
    const error = toErrorObject(errorLike);
    const resolvedSessionId = this.resolveSessionId({
      sessionId: context.sessionId,
      clientId: context.clientId,
      playerDbId: context.playerDbId,
      userId: context.userId
    });

    const session = resolvedSessionId ? this.sessions.get(resolvedSessionId) : null;
    const reportId = generateId('crash');
    const now = new Date();
    const recentSessionEvents = session ? session.events.slice(-40) : [];
    const recentGlobalEvents = this.globalEvents.slice(-80);

    const report = {
      reportId,
      timestamp: now.toISOString(),
      scope: context.scope || 'unknown',
      severity: context.severity || 'error',
      error,
      session: session ? {
        sessionId: session.sessionId,
        startedAt: session.startedAt,
        closedAt: session.closedAt,
        playerDbId: session.playerDbId,
        playerClientId: session.playerClientId,
        userId: session.userId,
        nickname: session.nickname,
        metadata: session.metadata
      } : null,
      context: sanitizeValue(context.context || {}),
      recentSessionEvents,
      recentGlobalEvents
    };

    this.recordEvent({
      sessionId: resolvedSessionId,
      clientId: context.clientId,
      playerDbId: context.playerDbId,
      userId: context.userId,
      eventType: 'exception',
      payload: {
        scope: report.scope,
        message: error.message,
        name: error.name
      }
    });

    try {
      const dateFolder = now.toISOString().slice(0, 10);
      const destinationDir = path.join(this.reportDir, dateFolder);
      fs.mkdirSync(destinationDir, { recursive: true });

      const filePath = path.join(destinationDir, `${reportId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
      logger.error('CRASH', `[${reportId}] ${report.scope}: ${error.message}`);
      if (error.stack) {
        logger.error('CRASH', error.stack);
      }
      logger.error('CRASH', `Report saved to ${filePath}`);
      return { reportId, filePath };
    } catch (writeError) {
      logger.error('CRASH', `[${reportId}] Failed to persist crash report: ${writeError.message}`);
      logger.error('CRASH', error.stack || error.message);
      return { reportId, filePath: null };
    }
  }

  captureUnhandledRejection(reason, context = {}) {
    const asError = reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : JSON.stringify(reason));
    return this.captureException(asError, {
      ...context,
      scope: context.scope || 'process.unhandledRejection'
    });
  }

  getSessionSnapshot(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return {
      sessionId: session.sessionId,
      startedAt: session.startedAt,
      closedAt: session.closedAt,
      playerDbId: session.playerDbId,
      playerClientId: session.playerClientId,
      userId: session.userId,
      nickname: session.nickname,
      metadata: session.metadata,
      events: session.events.slice(-50)
    };
  }

  _cleanupSessions() {
    if (this.sessions.size <= this.maxSessions) return;

    const sessionsByAge = Array.from(this.sessions.values())
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

    const toRemove = this.sessions.size - this.maxSessions;
    for (let index = 0; index < toRemove; index += 1) {
      const session = sessionsByAge[index];
      if (!session) continue;
      this.closeSession(session.sessionId, { reason: 'cleanup_rotation' });
      this.sessions.delete(session.sessionId);
    }
  }
}

module.exports = new CrashReporter();
