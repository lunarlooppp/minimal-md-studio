import { contextBridge, ipcRenderer } from 'electron';

type OpenMarkdownResult = {
  path: string;
  name: string;
  content: string;
} | null;

contextBridge.exposeInMainWorld('desktopApi', {
  openMarkdown: (): Promise<OpenMarkdownResult> => ipcRenderer.invoke('dialog:openMarkdown'),
  openMarkdownPath: (path: string): Promise<OpenMarkdownResult> => ipcRenderer.invoke('file:openMarkdownPath', path),
  writeMarkdownPath: (path: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('file:writeMarkdownPath', { path, content }),
  saveMarkdown: (content: string, defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveMarkdown', { content, defaultPath }),
  saveHtml: (html: string, defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveHtml', { html, defaultPath }),
  savePdf: (html: string, defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:savePdf', { html, defaultPath }),
  savePastedImage: (dataUrl: string, fileName?: string, documentPath?: string): Promise<{ path: string; name: string }> =>
    ipcRenderer.invoke('file:savePastedImage', { dataUrl, fileName, documentPath }),
  showItem: (path: string): Promise<void> => ipcRenderer.invoke('shell:showItem', path),
});
