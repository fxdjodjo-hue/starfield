/**
 * FixedLoop - Un loop di gioco preciso per Node.js
 * Usa process.hrtime per precisione nanosecondi e corregge il drift temporale
 * Implementa il pattern "Fixed Timestep Accumulator"
 */
class FixedLoop {
    /**
     * @param {number} tps - Ticks Per Second target (es. 20 Hz)
     * @param {function} callback - Funzione da chiamare a ogni tick
     */
    constructor(tps, callback) {
        this.tps = tps;
        this.callback = callback;

        // Durata target di un tick in nanosecondi e millisecondi
        this.tickDurationMs = 1000 / tps;
        this.tickDurationNs = BigInt(Math.floor(this.tickDurationMs * 1e6));

        this.isRunning = false;
        this.lastTime = 0n;
        this.accumulator = 0n;

        // Bind per mantenere il contesto nel timer
        this.loop = this.loop.bind(this);
    }

    start() {
        if (this.isRunning) return;

        console.log(`[FixedLoop] Starting at ${this.tps} TPS (dt: ${this.tickDurationMs}ms)`);
        this.isRunning = true;
        this.lastTime = process.hrtime.bigint();
        this.accumulator = 0n;

        // Avvia il primo ciclo immediatamente
        setImmediate(this.loop);
    }

    stop() {
        console.log('[FixedLoop] Stopping');
        this.isRunning = false;
    }

    loop() {
        if (!this.isRunning) return;

        const now = process.hrtime.bigint();
        const deltaNs = now - this.lastTime;
        this.lastTime = now;

        // Accumula il tempo passato
        this.accumulator += deltaNs;

        // Protezione "Spiral of Death": se siamo troppo indietro (es. breakpoint),
        // saltiamo avanti invece di eseguire infiniti tick
        // Max 10 tick recuperabili (500ms a 20Hz)
        const maxAccumulator = this.tickDurationNs * 10n;
        if (this.accumulator > maxAccumulator) {
            // console.warn(`[FixedLoop] System lagging! Skipping catch-up. Accumulator: ${Number(this.accumulator)/1e6}ms`);
            this.accumulator = this.tickDurationNs; // Resetta a 1 tick pendente
        }

        // Consuma l'accumulatore a step fissi
        while (this.accumulator >= this.tickDurationNs) {
            try {
                this.callback();
            } catch (err) {
                console.error('[FixedLoop] Error in tick callback:', err);
            }
            this.accumulator -= this.tickDurationNs;
        }

        // Calcola quanto aspettare per il prossimo tick ideale
        // (Tempo target - tempo accumulato rimasto)
        const nextTickNs = this.tickDurationNs - this.accumulator;
        const nextTickMs = Number(nextTickNs) / 1e6;

        if (nextTickMs > 4) {
            // Se abbiamo più di 4ms, usiamo setTimeout per risparmiare CPU
            // Togliamo 2ms per sicurezza per compensare l'imprecisione di setTimeout
            setTimeout(this.loop, Math.floor(nextTickMs - 2));
        } else {
            // Se manca poco, usiamo setImmediate per precisione (o loop busy-wait se servisse ultra precisione)
            setImmediate(this.loop);
        }
    }
}

module.exports = FixedLoop;
