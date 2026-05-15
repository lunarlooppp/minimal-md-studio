export type MarkdownBlockType = 'heading' | 'code' | 'diagram' | 'quote' | 'list' | 'table' | 'paragraph';

export type MarkdownBlock = {
  id: string;
  index: number;
  markdown: string;
  startLine: number;
  endLine: number;
  type: MarkdownBlockType;
};

const blankLine = /^\s*$/;
const headingLine = /^ {0,3}#{1,6}\s+\S/;
const fenceLine = /^ {0,3}(```+|~~~+)/;
const listLine = /^(\s*)([-+*]|\d+[.)])\s+\S/;
const quoteLine = /^ {0,3}>\s?/;
const tableDividerLine = /^ {0,3}\|?[\s:-]+\|[\s|:-]*$/;

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const normalized = markdown.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const blocks: MarkdownBlock[] = [];
  let cursor = 0;

  while (cursor < lines.length) {
    while (cursor < lines.length && blankLine.test(lines[cursor])) {
      cursor += 1;
    }

    if (cursor >= lines.length) {
      break;
    }

    const start = cursor;
    const line = lines[cursor];
    let type: MarkdownBlockType = 'paragraph';

    if (fenceLine.test(line)) {
      type = isDiagramFence(line) ? 'diagram' : 'code';
      const fence = fenceLine.exec(line)?.[1] ?? '```';
      const closeFence = new RegExp(`^ {0,3}${escapeRegExp(fence)}\\s*$`);
      cursor += 1;
      while (cursor < lines.length && !closeFence.test(lines[cursor])) {
        cursor += 1;
      }
      if (cursor < lines.length) {
        cursor += 1;
      }
    } else if (headingLine.test(line)) {
      type = 'heading';
      cursor += 1;
    } else if (quoteLine.test(line)) {
      type = 'quote';
      cursor += 1;
      while (cursor < lines.length && (quoteLine.test(lines[cursor]) || isSoftContinuation(lines, cursor))) {
        cursor += 1;
      }
    } else if (listLine.test(line)) {
      type = 'list';
      cursor += 1;
      while (cursor < lines.length && !blankLine.test(lines[cursor])) {
        cursor += 1;
      }
    } else {
      cursor += 1;
      while (cursor < lines.length && !blankLine.test(lines[cursor]) && !startsDetachedBlock(lines, cursor)) {
        cursor += 1;
      }

      if (cursor - start >= 2 && tableDividerLine.test(lines[start + 1])) {
        type = 'table';
      }
    }

    const blockLines = lines.slice(start, cursor);
    const text = blockLines.join('\n').trimEnd();
    if (text.trim().length > 0) {
      blocks.push({
        id: `block-${blocks.length}`,
        index: blocks.length,
        markdown: text,
        startLine: start + 1,
        endLine: cursor,
        type,
      });
    }
  }

  return blocks;
}

function startsDetachedBlock(lines: string[], cursor: number) {
  const previous = lines[cursor - 1] ?? '';
  const current = lines[cursor] ?? '';
  return !blankLine.test(previous) && (headingLine.test(current) || fenceLine.test(current));
}

function isSoftContinuation(lines: string[], cursor: number) {
  if (!blankLine.test(lines[cursor])) {
    return false;
  }

  const next = lines[cursor + 1] ?? '';
  return quoteLine.test(next);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isDiagramFence(line: string) {
  const language = /^ {0,3}(?:```+|~~~+)\s*([^\s`~]*)/.exec(line)?.[1]?.toLowerCase() ?? '';
  return ['mermaid', 'flowchart', 'graphviz', 'dot', 'plantuml'].includes(language);
}
