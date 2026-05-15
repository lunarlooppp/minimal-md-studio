export type ThemeMode = 'light' | 'dark' | 'writing';

const exportStyles = `
  :root { color-scheme: light; }
  body {
    margin: 0;
    background: #f8f5ef;
    color: #24211d;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 1.7;
  }
  .markdown-body {
    box-sizing: border-box;
    max-width: 820px;
    margin: 0 auto;
    padding: 56px 34px 72px;
    font-size: 16px;
  }
  h1, h2, h3, h4 { color: #171513; line-height: 1.28; margin: 1.65em 0 0.7em; }
  h1 { font-size: 2.15rem; }
  h2 { font-size: 1.55rem; }
  h3 { font-size: 1.22rem; }
  p, ul, ol, blockquote, pre, table { margin: 0 0 1.05em; }
  a { color: #2f6f91; }
  blockquote { border-left: 3px solid #c6bda8; padding-left: 1em; color: #686055; }
  code { background: #eee7dc; border-radius: 4px; padding: 0.16em 0.34em; }
  pre { background: #1f2328; color: #f2f2f2; border-radius: 8px; padding: 18px; overflow: auto; }
  pre code { background: transparent; padding: 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ded6ca; padding: 8px 10px; }
  img { max-width: 100%; }
`;

export function buildHtmlDocument(title: string, body: string, theme: ThemeMode) {
  const bg = theme === 'dark' ? '#191a1c' : theme === 'writing' ? '#f8f5ef' : '#ffffff';
  const color = theme === 'dark' ? '#e9e5dd' : '#24211d';
  const exportBody = normalizeExportImageSources(body);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>${exportStyles} body { background: ${bg}; color: ${color}; }</style>
</head>
<body>
  <article class="markdown-body">${exportBody}</article>
</body>
</html>`;
}

export function downloadTextFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function normalizeMarkdownName(name: string) {
  const base = name.trim() || 'untitled.md';
  return /\.md$/i.test(base) ? base : `${base}.md`;
}

export function nameWithExtension(name: string, extension: string) {
  const withoutKnownExtension = name.replace(/\.(md|markdown|html|pdf)$/i, '');
  return `${withoutKnownExtension || 'document'}.${extension}`;
}

export function plainHtmlFallback(markdown: string) {
  return markdown
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('\n');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeExportImageSources(html: string) {
  return html.replace(/src="minimal-md-image:\/\/local\/([^"]+)"/g, (_match, encodedPath: string) => {
    return `src="${fileUrlFromAbsolutePath(decodeURIComponent(encodedPath))}"`;
  });
}

function fileUrlFromAbsolutePath(path: string) {
  const normalized = path.replace(/\\/g, '/');
  const encoded = normalized
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
    .replace(/^([A-Za-z])%3A/, '$1:');
  return `file:///${encoded}`;
}
