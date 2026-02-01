const { app, BrowserWindow, screen } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const isDev = !app.isPackaged;

// Configurazione base per gli aggiornamenti
if (!isDev) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
}



let splashWindow = null;
let mainWindow = null;

function sendStatusToSplash(text, type = 'info', progress = null) {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('update-status', { text, type, progress });
    }
}

function configureAutoUpdater() {
    autoUpdater.on('checking-for-update', () => {
        sendStatusToSplash('Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
        sendStatusToSplash('Update available. Downloading...', 'info');
    });

    autoUpdater.on('update-not-available', (info) => {
        sendStatusToSplash('Starting Game...');
        setTimeout(launchMainWindow, 1000);
    });

    autoUpdater.on('error', (err) => {
        sendStatusToSplash('Error checking for updates. Starting anyway...', 'error');
        setTimeout(launchMainWindow, 2000);
    });

    autoUpdater.on('download-progress', (progressObj) => {
        sendStatusToSplash(`Downloading: ${Math.round(progressObj.percent)}%`, 'progress', progressObj.percent);
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.webContents.send('download-progress', progressObj.percent);
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        sendStatusToSplash('Update downloaded. Restarting...', 'success');
        setTimeout(() => {
            autoUpdater.quitAndInstall();
        }, 2000);
    });
}

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 600,
        height: 600,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        icon: path.join(__dirname, '../build/icon.ico'), // Usa icona corretta
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });

    splashWindow.loadFile(path.join(__dirname, 'splash.html'));
    splashWindow.center();

    splashWindow.once('ready-to-show', () => {
        splashWindow.show();
        if (!isDev) {
            configureAutoUpdater();
            autoUpdater.checkForUpdates();
        } else {
            setTimeout(launchMainWindow, 1500); // Dev mode fast switch
        }
    });
}

function launchMainWindow() {
    if (mainWindow) return; // Prevent double creation

    createWindow();
}

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: Math.min(1920, width),
        height: Math.min(1080, height),
        minWidth: 1280,
        minHeight: 720,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs'),
            backgroundThrottling: false // CRITICAL: Impedisce a Electron di rallentare il loop quando in background
        },
        backgroundColor: '#000011',
        autoHideMenuBar: true,
        title: 'StarSpace',
        icon: path.join(__dirname, '../build/icon.ico'), // Usa icona corretta
        fullscreen: true,
        show: false // Non mostrare finché non è pronta
    });

    // Gestione transizione Splash -> Main
    mainWindow.once('ready-to-show', () => {
        if (splashWindow && !splashWindow.isDestroyed()) {
            // Effetto fade-out prima di chiudere
            let opacity = 1.0;
            const fadeInterval = setInterval(() => {
                opacity -= 0.1;
                if (opacity <= 0) {
                    clearInterval(fadeInterval);
                    splashWindow.close();
                    mainWindow.show();
                } else {
                    splashWindow.setOpacity(opacity);
                }
            }, 30); // Circa 300ms totali
        } else {
            mainWindow.show();
        }

        // Apri DevTools per debug
        if (isDev) {
            // mainWindow.webContents.openDevTools();
        }
    });

    if (isDev) {
        // Development: carica da Vite dev server
        mainWindow.loadURL('http://localhost:5173');
    } else {
        // Production: carica i file buildati
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Mantieni titolo custom
    mainWindow.on('page-title-updated', (e) => e.preventDefault());

    // Gestisci link esterni (apri nel browser di default)
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
    });
}

app.whenReady().then(() => {
    createSplashWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createSplashWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Gestione crash/hang
app.on('render-process-gone', (event, webContents, details) => {
    console.error('Render process gone:', details);
});

app.on('child-process-gone', (event, details) => {
    console.error('Child process gone:', details);
});
