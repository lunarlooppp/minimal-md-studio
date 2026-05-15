declare global {
  interface Window {
    desktopApi?: {
      openMarkdown: () => Promise<{ path: string; name: string; content: string } | null>;
      openMarkdownPath: (path: string) => Promise<{ path: string; name: string; content: string } | null>;
      writeMarkdownPath: (path: string, content: string) => Promise<boolean>;
      saveMarkdown: (content: string, defaultPath?: string) => Promise<string | null>;
      saveHtml: (html: string, defaultPath?: string) => Promise<string | null>;
      savePdf: (html: string, defaultPath?: string) => Promise<string | null>;
      savePastedImage: (dataUrl: string, fileName?: string, documentPath?: string) => Promise<{ path: string; name: string }>;
      showItem: (path: string) => Promise<void>;
    };
  }
}

export {};
