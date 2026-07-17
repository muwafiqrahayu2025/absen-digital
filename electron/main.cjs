const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: "ABDI Absensi Digital - Multi Online & Cabang",
    icon: path.join(__dirname, '../public/logo-abdi.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    autoHideMenuBar: true,
    show: false
  });

  // Tampilkan window secara halus setelah siap dirender
  win.once('ready-to-show', () => {
    win.show();
  });

  // Memuat file dist hasil build Vite
  win.loadFile(path.join(__dirname, '../dist/index.html'));

  // Menangani tautan eksternal agar dibuka di browser bawaan OS
  win.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
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
