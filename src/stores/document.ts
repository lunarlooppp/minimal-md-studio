import { defineStore } from 'pinia';
import { buildHtmlDocument, downloadTextFile, nameWithExtension, normalizeMarkdownName, type ThemeMode } from '../utils/exportDocument';
import { renderMarkdownDocument } from '../utils/markdownRenderer';

type SidebarMode = 'files' | 'outline';

type RecentFile = {
  name: string;
  path?: string;
  content?: string;
  updatedAt: number;
};

type SavedState = {
  content?: string;
  html?: string;
  fileName?: string;
  filePath?: string;
  theme?: ThemeMode;
  sidebarWidth?: number;
  recentFiles?: RecentFile[];
  autoSaveEnabled?: boolean;
  manualSaveShortcut?: string;
};

const STORAGE_KEY = 'minimal-md-studio-state';
let diskSaveTimer: ReturnType<typeof window.setTimeout> | undefined;

const starterContent = `# 新文档

在这里开始写作。界面默认隐藏复杂工具，只保留导入、导出、主题、目录和 AI 问答入口。

## 今日计划

- 整理文档结构
- 写下正文
- 导出为 Markdown、HTML 或 PDF

## 片段

> 保持页面干净，让注意力停留在文字上。
`;

function loadSavedState(): SavedState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as SavedState;
  } catch {
    return {};
  }
}

function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '-');
}

function normalizeShortcutKey(key: string) {
  if (key === ' ') return 'Space';
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function parseShortcut(shortcut: string) {
  const parts = shortcut
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  const key = parts.at(-1) ?? '';
  return {
    ctrl: parts.includes('Ctrl'),
    shift: parts.includes('Shift'),
    alt: parts.includes('Alt'),
    meta: parts.includes('Meta'),
    key,
  };
}

function shortcutFromKeyboardEvent(event: KeyboardEvent) {
  const key = normalizeShortcutKey(event.key);
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return '';

  const parts = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.shiftKey) parts.push('Shift');
  if (event.altKey) parts.push('Alt');
  if (event.metaKey) parts.push('Meta');
  parts.push(key);
  return parts.join('+');
}

export const useDocumentStore = defineStore('document', {
  state: () => {
    const saved = loadSavedState();
    return {
      content: saved.content ?? starterContent,
      renderedHtml: saved.html ?? '',
      fileName: saved.fileName ?? 'untitled.md',
      filePath: saved.filePath ?? '',
      theme: saved.theme ?? 'writing' as ThemeMode,
      sidebarWidth: saved.sidebarWidth ?? 252,
      sidebarOpen: true,
      aiOpen: false,
      settingsOpen: false,
      sidebarMode: 'files' as SidebarMode,
      recentFiles: saved.recentFiles ?? [],
      autoSaveEnabled: saved.autoSaveEnabled ?? true,
      manualSaveShortcut: saved.manualSaveShortcut ?? 'Ctrl+S',
      documentRevision: 0,
      statusText: '就绪',
    };
  },
  getters: {
    headings(state) {
      return state.content
        .split(/\r?\n/)
        .map((line, index) => {
          const match = /^(#{1,6})\s+(.+)$/.exec(line);
          if (!match) return null;
          return {
            id: `heading-${index}`,
            level: match[1].length,
            text: match[2].replace(/[#*_`~]/g, '').trim(),
            line: index + 1,
          };
        })
        .filter(Boolean) as Array<{ id: string; level: number; text: string; line: number }>;
    },
    htmlForExport(state) {
      return state.renderedHtml || renderMarkdownDocument(state.content);
    },
    isDesktop() {
      return Boolean(window.desktopApi);
    },
  },
  actions: {
    persist() {
      const payload: SavedState = {
        content: this.content,
        html: this.renderedHtml,
        fileName: this.fileName,
        filePath: this.filePath,
        theme: this.theme,
        sidebarWidth: this.sidebarWidth,
        recentFiles: this.recentFiles.slice(0, 8),
        autoSaveEnabled: this.autoSaveEnabled,
        manualSaveShortcut: this.manualSaveShortcut,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    },
    setContent(value: string) {
      this.content = value;
      this.statusText = this.autoSaveEnabled ? '已自动保存到本地' : '有未保存更改';
      this.persist();
      if (this.autoSaveEnabled) {
        void this.saveToCurrentDiskFile();
      }
    },
    saveDraftSnapshot(content: string) {
      const payload: SavedState = {
        content,
        html: this.renderedHtml,
        fileName: this.fileName,
        filePath: this.filePath,
        theme: this.theme,
        sidebarWidth: this.sidebarWidth,
        recentFiles: this.recentFiles.slice(0, 8),
        autoSaveEnabled: this.autoSaveEnabled,
        manualSaveShortcut: this.manualSaveShortcut,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

      if (!this.filePath || !window.desktopApi?.writeMarkdownPath) return;

      if (!this.autoSaveEnabled) {
        this.statusText = '有未保存更改';
        return;
      }

      if (diskSaveTimer) {
        window.clearTimeout(diskSaveTimer);
      }

      const path = this.filePath;
      diskSaveTimer = window.setTimeout(() => {
        void window.desktopApi?.writeMarkdownPath(path, content).then(() => {
          if (path === this.filePath) {
            this.statusText = '已保存到文件';
          }
        });
      }, 450);
    },
    setRenderedHtml(value: string) {
      this.renderedHtml = value;
      this.persist();
    },
    setTheme(value: ThemeMode) {
      this.theme = value;
      this.persist();
    },
    setSidebarMode(value: SidebarMode) {
      this.sidebarMode = value;
      this.sidebarOpen = true;
    },
    setSidebarWidth(value: number) {
      this.sidebarWidth = Math.min(Math.max(Math.round(value), 180), 460);
      this.persist();
    },
    setAutoSaveEnabled(value: boolean) {
      this.autoSaveEnabled = value;
      if (!value && diskSaveTimer) {
        window.clearTimeout(diskSaveTimer);
        diskSaveTimer = undefined;
      }
      this.statusText = value ? '自动保存已开启' : '自动保存已关闭';
      this.persist();
      if (value) {
        void this.saveToCurrentDiskFile();
      }
    },
    setManualSaveShortcut(value: string) {
      this.manualSaveShortcut = value || 'Ctrl+S';
      this.persist();
    },
    shortcutFromEvent(event: KeyboardEvent) {
      return shortcutFromKeyboardEvent(event);
    },
    matchesManualSaveShortcut(event: KeyboardEvent) {
      const shortcut = parseShortcut(this.manualSaveShortcut);
      return (
        event.ctrlKey === shortcut.ctrl &&
        event.shiftKey === shortcut.shift &&
        event.altKey === shortcut.alt &&
        event.metaKey === shortcut.meta &&
        normalizeShortcutKey(event.key) === shortcut.key
      );
    },
    newDocument() {
      this.documentRevision += 1;
      this.content = '# 未命名文档\n\n';
      this.renderedHtml = '';
      this.fileName = 'untitled.md';
      this.filePath = '';
      this.statusText = '已新建文档';
      this.persist();
    },
    async importMarkdown(file?: File) {
      if (!file && window.desktopApi) {
        const picked = await window.desktopApi.openMarkdown();
        if (!picked) return;
        this.applyImportedDocument(picked.name, picked.content, picked.path);
        return;
      }

      if (!file) return;
      const content = await file.text();
      this.applyImportedDocument(file.name, content);
    },
    applyImportedDocument(name: string, content: string, path?: string) {
      if (diskSaveTimer) {
        window.clearTimeout(diskSaveTimer);
        diskSaveTimer = undefined;
      }
      this.documentRevision += 1;
      this.fileName = normalizeMarkdownName(name);
      this.filePath = path ?? '';
      this.content = content;
      this.statusText = `已导入 ${this.fileName}`;
      this.addRecentFile(this.fileName, this.filePath, this.content);
      this.persist();
    },
    async saveToCurrentDiskFile(path?: string, content?: string) {
      path ??= this.filePath;
      content ??= this.content;
      if (!path || !window.desktopApi?.writeMarkdownPath) return;

      if (diskSaveTimer) {
        window.clearTimeout(diskSaveTimer);
        diskSaveTimer = undefined;
      }

      try {
        await window.desktopApi.writeMarkdownPath(path, content);
        if (path === this.filePath && content === this.content) {
          this.statusText = '已保存到文件';
          this.addRecentFile(this.fileName, this.filePath, this.content);
        }
      } catch {
        if (path === this.filePath) {
          this.statusText = '保存到文件失败';
        }
      }
    },
    async manualSaveCurrentFile() {
      if (this.filePath && window.desktopApi?.writeMarkdownPath) {
        await this.saveToCurrentDiskFile(this.filePath, this.content);
        return;
      }

      await this.exportMarkdown();
    },
    async openRecentFile(item: RecentFile) {
      if (item.path && item.path === this.filePath) {
        this.statusText = '当前文档已打开';
        return;
      }

      if (item.path && window.desktopApi?.openMarkdownPath) {
        try {
          const opened = await window.desktopApi.openMarkdownPath(item.path);
          if (!opened) return;
          this.applyImportedDocument(opened.name, opened.content, opened.path);
          return;
        } catch {
          this.statusText = '最近文件无法打开';
          this.recentFiles = this.recentFiles.filter((recent) => recent.path !== item.path || recent.name !== item.name);
          this.persist();
          return;
        }
      }

      if (item.content !== undefined) {
        this.applyImportedDocument(item.name, item.content, item.path);
        return;
      }

      this.statusText = '当前环境无法直接打开该最近文件';
    },
    async exportMarkdown() {
      const filename = normalizeMarkdownName(safeFileName(this.fileName));
      if (window.desktopApi) {
        const savedPath = await window.desktopApi.saveMarkdown(this.content, filename);
        if (savedPath) {
          this.filePath = savedPath;
          this.fileName = normalizeMarkdownName(savedPath.split(/[\\/]/).pop() ?? filename);
          this.statusText = `已导出 Markdown`;
          this.addRecentFile(this.fileName, savedPath, this.content);
          this.persist();
        }
        return;
      }

      downloadTextFile(this.content, filename, 'text/markdown;charset=utf-8');
      this.addRecentFile(filename, undefined, this.content);
      this.statusText = '已导出 Markdown';
    },
    async exportHtml() {
      const filename = nameWithExtension(safeFileName(this.fileName), 'html');
      const html = buildHtmlDocument(this.fileName, this.htmlForExport, this.theme);
      if (window.desktopApi) {
        const savedPath = await window.desktopApi.saveHtml(html, filename);
        if (savedPath) this.statusText = '已导出 HTML';
        return;
      }

      downloadTextFile(html, filename, 'text/html;charset=utf-8');
      this.statusText = '已导出 HTML';
    },
    async exportPdf() {
      const filename = nameWithExtension(safeFileName(this.fileName), 'pdf');
      const html = buildHtmlDocument(this.fileName, this.htmlForExport, this.theme);
      if (window.desktopApi?.savePdf) {
        const savedPath = await window.desktopApi.savePdf(html, filename);
        if (savedPath) this.statusText = '已导出 PDF';
        return;
      }

      const html2pdf = (await import('html2pdf.js')).default;
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);
      await html2pdf()
        .set({ filename, margin: 10, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } })
        .from(container)
        .save();
      container.remove();
      this.statusText = '已导出 PDF';
    },
    addRecentFile(name: string, path?: string, content?: string) {
      const next = [
        { name, path, content, updatedAt: Date.now() },
        ...this.recentFiles.filter((item) => item.path !== path || item.name !== name),
      ];
      this.recentFiles = next.slice(0, 8);
      this.persist();
    },
    revealCurrentFile() {
      if (this.filePath && window.desktopApi) {
        window.desktopApi.showItem(this.filePath);
      }
    },
  },
});
