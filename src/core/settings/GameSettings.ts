/**
 * Interfaccia per i dati delle impostazioni
 */
export interface GameSettingsData {
    audio: {
        master: number;
        sfx: number;
        music: number;
    };
    graphics: {
        showFps: boolean;
    };
    interface: {
        showChat: boolean;
        showDamageNumbers: boolean;
    };
}

/**
 * Valori di default per le impostazioni
 */
const DEFAULT_SETTINGS: GameSettingsData = {
    audio: {
        master: 100,
        sfx: 80,
        music: 60,
    },
    graphics: {
        showFps: false,
    },
    interface: {
        showChat: true,
        showDamageNumbers: true,
    },
};

/**
 * Gestore centralizzato per le impostazioni di gioco (Singleton)
 * Salva e carica le configurazioni persistenti (localStorage)
 */
export class GameSettings {
    private staticinstance: GameSettings;
    private settings: GameSettingsData;
    private readonly STORAGE_KEY = 'starfield_settings';

    private constructor() {
        this.settings = this.loadSettings();
    }

    public static getInstance(): GameSettings {
        if (!GameSettings.instance) {
            GameSettings.instance = new GameSettings();
        }
        return GameSettings.instance;
    }

    /**
     * Carica le impostazioni dal localStorage o usa i default
     */
    private loadSettings(): GameSettingsData {
        try {
            const savedMatches = localStorage.getItem(this.STORAGE_KEY);
            if (savedMatches) {
                const parsed = JSON.parse(savedMatches);
                // Merge diffensivo con i default per garantire che nuove chiavi esistano sempre
                return this.mergeWithDefaults(parsed);
            }
        } catch (e) {
            console.warn('Failed to load settings:', e);
        }
        return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }

    /**
     * Unisce i settaggi caricati con i default per garantire completezza
     */
    private mergeWithDefaults(loaded: any): GameSettingsData {
        const defaults = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        return {
            audio: { ...defaults.audio, ...(loaded.audio || {}) },
            graphics: { ...defaults.graphics, ...(loaded.graphics || {}) },
            interface: { ...defaults.interface, ...(loaded.interface || {}) }
        };
    }

    /**
     * Salva le impostazioni correnti
     */
    public save(): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    }

    /**
     * Restituisce una copia delle impostazioni correnti
     */
    public get(): GameSettingsData {
        return JSON.parse(JSON.stringify(this.settings));
    }

    // --- Getters rapidi ---

    public get audio() { return this.settings.audio; }
    public get graphics() { return this.settings.graphics; }
    public get interface() { return this.settings.interface; }

    // --- Setters ---

    public setAudioVolume(type: 'master' | 'sfx' | 'music', value: number): void {
        this.settings.audio[type] = value;
        this.save();
    }

    public setShowFps(value: boolean): void {
        this.settings.graphics.showFps = value;
        this.save();
    }

    public setShowChat(value: boolean): void {
        this.settings.interface.showChat = value;
        this.save();
    }

    public setShowDamageNumbers(value: boolean): void {
        this.settings.interface.showDamageNumbers = value;
        this.save();
    }
}
