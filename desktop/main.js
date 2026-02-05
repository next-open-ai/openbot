const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;
let gatewayProcess;

// Start OpenBot Gateway
function startGateway() {
    const gatewayPath = path.join(__dirname, '..', 'dist', 'gateway', 'server.js');

    if (process.env.NODE_ENV !== 'production') {
        // In development, gateway might be running separately
        console.log('Development mode: Gateway should be started separately');
        return;
    }

    gatewayProcess = spawn('node', [gatewayPath], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
    });
}

// Start NestJS server
function startServer() {
    const serverPath = path.join(__dirname, 'server', 'dist', 'main.js');

    // In development, the server runs via npm script
    // In production, we'd run the compiled server
    if (process.env.NODE_ENV === 'production') {
        serverProcess = spawn('node', [serverPath], {
            cwd: path.join(__dirname, 'server'),
            stdio: 'inherit'
        });
    }
    // In development, server is started separately via npm run dev:server
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 1000,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        backgroundColor: '#0f0f1e',
        show: false,
        titleBarStyle: 'hiddenInset',
        frame: true,
    });

    // Load the Vue.js app
    // In development, use Vite dev server
    // In production, use built files
    const isDev = process.env.NODE_ENV !== 'production';
    const startUrl = isDev
        ? 'http://localhost:5173'
        : `file://${path.join(__dirname, 'renderer/dist/index.html')}`;

    mainWindow.loadURL(startUrl);

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Open DevTools in development
    if (process.env.NODE_ENV !== 'production') {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// App lifecycle
app.whenReady().then(() => {
    startGateway();
    startServer();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
    if (gatewayProcess) {
        gatewayProcess.kill();
    }
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('minimize-window', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

ipcMain.handle('maximize-window', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.handle('close-window', () => {
    if (mainWindow) {
        mainWindow.close();
    }
});

ipcMain.handle('get-user-data-path', () => {
    return app.getPath('userData');
});
