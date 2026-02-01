/**
 * WorkerTimer - Timer basato su Web Worker
 * 
 * I browser moderni rallentano o sospendono pesantemente i timer (setTimeout/setInterval)
 * nel main thread quando il tab è in background (throttling a 1s o peggio).
 * I Web Workers girano su un thread separato e sono molto meno soggetti a questo throttling.
 * 
 * Questa classe crea un worker inline (tramite Blob) per generare "tick" regolari
 * che tengono vivo il Game Loop anche quando il tab è minimizzato.
 */
export class WorkerTimer {
    private worker: Worker | null = null;
    private onTick: () => void;
    private isRunning = false;

    constructor(onTick: () => void) {
        this.onTick = onTick;
        this.initWorker();
    }

    private initWorker(): void {
        // Codice del worker come stringa per evitare file separati e problemi di bundler
        const workerCode = `
      let timerId = null;

      self.onmessage = function(e) {
        const { command, interval } = e.data;

        if (command === 'start') {
          if (timerId) clearInterval(timerId);
          // Usa setInterval nel worker per generare tick costanti
          timerId = setInterval(() => {
            self.postMessage('tick');
          }, interval);
        } 
        else if (command === 'stop') {
          if (timerId) {
            clearInterval(timerId);
            timerId = null;
          }
        }
      };
    `;

        // Crea il worker da un Blob
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.worker = new Worker(URL.createObjectURL(blob));

        // Gestisci i messaggi dal worker (i tick)
        this.worker.onmessage = (e) => {
            if (e.data === 'tick') {
                this.onTick();
            }
        };
    }

    /**
     * Avvia il timer del worker
     * @param intervalMs Intervallo in millisecondi (es. 33ms per ~30fps)
     */
    start(intervalMs: number): void {
        if (this.worker && !this.isRunning) {
            this.worker.postMessage({ command: 'start', interval: intervalMs });
            this.isRunning = true;
        }
    }

    /**
     * Ferma il timer del worker
     */
    stop(): void {
        if (this.worker && this.isRunning) {
            this.worker.postMessage({ command: 'stop' });
            this.isRunning = false;
        }
    }

    /**
     * Distrugge il worker liberando risorse
     */
    dispose(): void {
        this.stop();
        this.worker?.terminate();
        this.worker = null;
    }
}
