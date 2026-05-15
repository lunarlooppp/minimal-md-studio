import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, parse } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

let mainWindow: BrowserWindow | null = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'minimal-md-image',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function dialogOwner() {
  return mainWindow ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 860,
    minHeight: 560,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f7f4ef',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  mainWindow.loadFile(join(__dirname, '../dist/index.html'));
}

async function renderHtmlToPdf(html: string) {
  const pdfWindow = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      offscreen: true,
      sandbox: true,
    },
  });

  try {
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await pdfWindow.webContents.printToPDF({
      printBackground: true,
      margins: {
        marginType: 'default',
      },
      pageSize: 'A4',
    });
  } finally {
    pdfWindow.close();
  }
}

app.whenReady().then(() => {
  protocol.handle('minimal-md-image', (request) => {
    const filePath = decodeURIComponent(new URL(request.url).pathname.slice(1));
    return net.fetch(pathToFileURL(filePath).toString());
  });

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

ipcMain.handle('dialog:openMarkdown', async () => {
  const owner = dialogOwner();
  const options = {
    title: '导入 Markdown',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown'] },
      { name: 'Text', extensions: ['txt'] },
    ],
  } satisfies Electron.OpenDialogOptions;
  const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const content = await readFile(filePath, 'utf-8');
  return { path: filePath, name: basename(filePath), content };
});

ipcMain.handle('file:openMarkdownPath', async (_event, filePath: string) => {
  const content = await readFile(filePath, 'utf-8');
  return { path: filePath, name: basename(filePath), content };
});

ipcMain.handle('file:writeMarkdownPath', async (_event, payload: { path: string; content: string }) => {
  await writeFile(payload.path, payload.content, 'utf-8');
  return true;
});

ipcMain.handle(
  'file:savePastedImage',
  async (_event, payload: { dataUrl: string; fileName?: string; documentPath?: string }) => {
    const parsed = parseDataUrl(payload.dataUrl);
    const documentPath = payload.documentPath?.trim();
    const root = documentPath
      ? join(dirname(documentPath), `${parse(documentPath).name}.assets`)
      : join(app.getPath('userData'), 'pasted-images');
    await mkdir(root, { recursive: true });

    const sourceName = payload.fileName?.trim() || 'image';
    const extension = imageExtension(sourceName, parsed.mime);
    const stem = safeFileName(parse(sourceName).name || 'image');
    const filePath = join(root, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${stem}${extension}`);
    await writeFile(filePath, parsed.buffer);
    return { path: filePath.replace(/\\/g, '/'), name: basename(filePath) };
  },
);

ipcMain.handle('dialog:saveMarkdown', async (_event, payload: { content: string; defaultPath?: string }) => {
  const owner = dialogOwner();
  const options = {
    title: '导出 Markdown',
    defaultPath: payload.defaultPath ?? 'untitled.md',
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  } satisfies Electron.SaveDialogOptions;
  const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) {
    return null;
  }

  await writeFile(result.filePath, payload.content, 'utf-8');
  return result.filePath;
});

ipcMain.handle('dialog:saveHtml', async (_event, payload: { html: string; defaultPath?: string }) => {
  const owner = dialogOwner();
  const options = {
    title: '导出 HTML',
    defaultPath: payload.defaultPath ?? 'document.html',
    filters: [{ name: 'HTML', extensions: ['html'] }],
  } satisfies Electron.SaveDialogOptions;
  const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) {
    return null;
  }

  await writeFile(result.filePath, payload.html, 'utf-8');
  return result.filePath;
});

ipcMain.handle('dialog:savePdf', async (_event, payload: { html: string; defaultPath?: string }) => {
  const owner = dialogOwner();
  const options = {
    title: '导出 PDF',
    defaultPath: payload.defaultPath ?? 'document.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  } satisfies Electron.SaveDialogOptions;
  const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) {
    return null;
  }

  const pdf = await renderHtmlToPdf(payload.html);
  await writeFile(result.filePath, pdf);
  return result.filePath;
});

ipcMain.handle('shell:showItem', async (_event, path: string) => {
  shell.showItemInFolder(path);
});

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match || !match[1].startsWith('image/')) {
    throw new Error('Invalid image data URL');
  }

  return {
    mime: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function imageExtension(fileName: string, mime: string) {
  const existing = extname(fileName).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif'].includes(existing)) {
    return existing;
  }

  const byMime: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/svg+xml': '.svg',
    'image/avif': '.avif',
  };
  return byMime[mime] ?? '.png';
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'image';
}
