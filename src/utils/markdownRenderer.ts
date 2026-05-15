import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import type { MarkdownBlock } from './markdownBlocks';

type RenderedBlock = {
  html: string;
  language: string;
  isDiagram: boolean;
};

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(code, language): string {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value;
    }

    return escapeHtml(code);
  },
});

const defaultHeadingOpen =
  md.renderer.rules.heading_open ??
  ((tokens, idx, options, _env, self) => {
    return self.renderToken(tokens, idx, options);
  });

md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const inline = tokens[idx + 1];
  const title = inline?.type === 'inline' ? inline.content : '';
  if (title) {
    token.attrSet('id', uniqueHeadingId(env, title));
  }
  return defaultHeadingOpen(tokens, idx, options, env, self);
};

const defaultImageRender =
  md.renderer.rules.image ??
  ((tokens, idx, options, _env, self) => {
    return self.renderToken(tokens, idx, options);
  });

md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const src = token.attrGet('src');
  if (src) {
    token.attrSet('data-md-src', src);
    token.attrSet('src', imageRenderSource(src));
  }
  return defaultImageRender(tokens, idx, options, env, self);
};

export function renderMarkdownBlock(block: MarkdownBlock): RenderedBlock {
  const language = getFenceLanguage(block.markdown);
  const isDiagram = isDiagramLanguage(language);
  const rawHtml = md.render(block.markdown, createRenderEnv());

  return {
    html: sanitizeRenderedMarkdown(rawHtml, ['contenteditable']),
    language,
    isDiagram,
  };
}

export function renderMarkdownDocument(markdown: string) {
  return sanitizeRenderedMarkdown(md.render(markdown, createRenderEnv()));
}

export function extractEditableText(markdown: string, type: MarkdownBlock['type']) {
  if (type === 'heading') {
    return markdown.replace(/^ {0,3}(#{1,6})\s+/, '');
  }

  if (type === 'quote') {
    return markdown
      .split('\n')
      .map((line) => line.replace(/^ {0,3}>\s?/, ''))
      .join('\n');
  }

  if (type === 'code' || type === 'diagram') {
    const match = /^ {0,3}(```+|~~~+)[^\n]*\n([\s\S]*?)\n? {0,3}\1\s*$/.exec(markdown);
    return match ? match[2] : markdown;
  }

  if (type === 'table') {
    return markdown
      .split('\n')
      .filter((_, index) => index !== 1)
      .map((line) =>
        line
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim())
          .join('\t'),
      )
      .join('\n');
  }

  if (type === 'list') {
    return markdown
      .split('\n')
      .map((line) => line.replace(/^(\s*)([-+*]|\d+[.)])\s+/, '$1'))
      .join('\n');
  }

  return markdown;
}

export function applyEditableText(markdown: string, type: MarkdownBlock['type'], text: string) {
  const preserveTrailingLines = type === 'quote';
  const normalizedText = preserveTrailingLines ? text.replace(/\r\n?/g, '\n') : text.replace(/\r\n?/g, '\n').trimEnd();

  if (type === 'heading') {
    const prefix = /^ {0,3}(#{1,6})\s+/.exec(markdown)?.[0] ?? '## ';
    return `${prefix}${normalizedText || '未命名标题'}`;
  }

  if (type === 'quote') {
    return normalizedText
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
  }

  if (type === 'code' || type === 'diagram') {
    const fenceMatch = /^ {0,3}(```+|~~~+)([^\n]*)\n([\s\S]*?)\n? {0,3}\1\s*$/.exec(markdown);
    if (!fenceMatch) {
      return `\`\`\`\n${normalizedText}\n\`\`\``;
    }

    return `${fenceMatch[1]}${fenceMatch[2]}\n${normalizedText}\n${fenceMatch[1]}`;
  }

  if (type === 'table') {
    const sourceLines = markdown.split('\n');
    const alignLine = sourceLines[1] ?? '';
    const rows = normalizedText.split('\n').map((line) => line.split('\t').map((cell) => cell.trim()));
    const columnCount = Math.max(...rows.map((row) => row.length), 1);
    const headers = normalizeColumns(rows[0] ?? [''], columnCount);
    const align = alignLine && /\|/.test(alignLine) ? alignLine : `| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`;
    const body = rows.slice(1).map((row) => `| ${normalizeColumns(row, columnCount).join(' | ')} |`);
    return [`| ${headers.join(' | ')} |`, align, ...body].join('\n');
  }

  if (type === 'list') {
    const sourceLines = markdown.split('\n');
    const textLines = normalizedText.split('\n');
    return textLines
      .map((line, index) => {
        const marker = /^(\s*)([-+*]|\d+[.)])\s+/.exec(sourceLines[index] ?? sourceLines[0] ?? '- ')?.[0] ?? '- ';
        return `${marker}${line.trimStart()}`;
      })
      .join('\n');
  }

  return normalizedText;
}

export function getFenceLanguage(markdown: string) {
  return /^ {0,3}(?:```+|~~~+)\s*([^\s`~]*)/.exec(markdown)?.[1]?.toLowerCase() ?? '';
}

export function isDiagramLanguage(language: string) {
  return ['mermaid', 'flowchart', 'graphviz', 'dot', 'plantuml'].includes(language);
}

function normalizeColumns(row: string[], count: number) {
  return Array.from({ length: count }, (_, index) => row[index] ?? '');
}

type RenderEnv = {
  headingIds: Record<string, number>;
};

function createRenderEnv(): RenderEnv {
  return { headingIds: {} };
}

function uniqueHeadingId(env: unknown, title: string) {
  const renderEnv = ensureRenderEnv(env);
  const base = slugifyHeading(title);
  const count = renderEnv.headingIds[base] ?? 0;
  renderEnv.headingIds[base] = count + 1;
  return count === 0 ? base : `${base}-${count}`;
}

function ensureRenderEnv(env: unknown): RenderEnv {
  if (!env || typeof env !== 'object') {
    return createRenderEnv();
  }

  const candidate = env as Partial<RenderEnv>;
  candidate.headingIds ??= {};
  return candidate as RenderEnv;
}

export function slugifyHeading(title: string) {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z0-9#]+;/gi, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}\-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'heading';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeRenderedMarkdown(rawHtml: string, extraAttrs: string[] = []) {
  return DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target', 'rel', 'class', 'id', 'src', 'alt', 'title', 'width', 'height', 'loading', 'data-md-src', ...extraAttrs],
    ADD_DATA_URI_TAGS: ['img'],
    ADD_URI_SAFE_ATTR: ['src'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|data|minimal-md-image):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  });
}

function imageRenderSource(src: string) {
  if (isWindowsAbsolutePath(src)) {
    return `minimal-md-image://local/${encodeURIComponent(src)}`;
  }

  return src;
}

function isWindowsAbsolutePath(value: string) {
  return /^[a-zA-Z]:[\\/]/.test(value);
}
