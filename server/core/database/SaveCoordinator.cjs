// SaveCoordinator - Serializza i salvataggi per authId (player)
// Responsabilita': garantire una sola write attiva per player alla volta

const ServerLoggerWrapper = require('../infrastructure/ServerLoggerWrapper.cjs');

class SaveCoordinator {
  constructor(options = {}) {
    this.debugLogs = options.debugLogs === true;
    this.queueByAuthId = new Map(); // authId -> Promise tail
    this.activeByAuthId = new Map(); // authId -> saveSeq
    this.sequence = 0;
  }

  async runExclusive(authId, reason, fn) {
    const normalizedAuthId = String(authId || '').trim();
    if (!normalizedAuthId) {
      throw new Error('SaveCoordinator.runExclusive requires authId');
    }
    if (typeof fn !== 'function') {
      throw new Error('SaveCoordinator.runExclusive requires a function');
    }

    const saveReason = reason || 'unspecified';
    const saveSeq = ++this.sequence;
    const previousTail = this.queueByAuthId.get(normalizedAuthId) || Promise.resolve();

    const runPromise = previousTail
      .catch(() => null)
      .then(async () => {
        if (this.activeByAuthId.has(normalizedAuthId)) {
          const activeSeq = this.activeByAuthId.get(normalizedAuthId);
          throw new Error(
            `SaveCoordinator invariant violated: concurrent save for authId=${normalizedAuthId} activeSeq=${activeSeq} newSeq=${saveSeq}`
          );
        }

        const startedAt = Date.now();
        this.activeByAuthId.set(normalizedAuthId, saveSeq);

        if (this.debugLogs) {
          ServerLoggerWrapper.debug(
            'DATABASE',
            `save_begin authId=${normalizedAuthId} reason=${saveReason} saveSeq=${saveSeq}`
          );
        }

        try {
          return await fn({
            authId: normalizedAuthId,
            reason: saveReason,
            saveSeq
          });
        } finally {
          this.activeByAuthId.delete(normalizedAuthId);

          if (this.debugLogs) {
            const elapsedMs = Date.now() - startedAt;
            ServerLoggerWrapper.debug(
              'DATABASE',
              `save_end authId=${normalizedAuthId} reason=${saveReason} saveSeq=${saveSeq} ms=${elapsedMs}`
            );
          }
        }
      });

    const queueTail = runPromise.catch(() => null);
    this.queueByAuthId.set(normalizedAuthId, queueTail);

    return runPromise.finally(() => {
      if (this.queueByAuthId.get(normalizedAuthId) === queueTail) {
        this.queueByAuthId.delete(normalizedAuthId);
      }
    });
  }
}

module.exports = SaveCoordinator;
