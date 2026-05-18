<template>
  <section ref="rootRef" class="editor-wrap block-editor" @contextmenu.prevent="openContextMenu">
    <div class="render-page">
      <template v-if="blocks.length">
        <article
          v-for="block in blocks"
          :key="block.id"
          class="render-block-group"
          :class="[`block-${block.type}`, { readonly: block.type === 'diagram', selected: selectedBlockId === block.id }]"
          :data-block-id="block.id"
          :data-index="block.index"
          :data-line="block.startLine"
          @pointerdown.capture="handleBlockPointerDown(block, $event)"
        >
          <button
            v-if="selectedBlockId === block.id"
            class="block-action delete-block-action"
            type="button"
            title="删除当前块"
            @pointerdown.prevent
            @click.stop="deleteBlock(block)"
          >
            <Trash2 :size="14" />
          </button>

          <template v-if="block.type === 'diagram'">
            <div class="diagram-block">
              <div v-if="editingDiagramId === block.id" class="diagram-source-popover">
                <textarea
                  :ref="setDiagramTextareaRef"
                  v-model="diagramDraft"
                  spellcheck="false"
                  aria-label="Mermaid 原始文本"
                  @blur="commitDiagramEdit(block)"
                  @input="handleDiagramInput"
                  @keydown="handleDiagramKeydown(block, $event)"
                  @keydown.esc.prevent="cancelDiagramEdit"
                />
              </div>

              <div class="diagram-shell">
                <div class="diagram-toolbar" @pointerdown.stop @click.stop>
                  <button class="diagram-tool" type="button" title="编辑图表源码" @click="beginDiagramEdit(block)">
                    <Edit3 :size="15" />
                  </button>
                  <button class="diagram-tool" type="button" title="放大" @click="zoomDiagram(block.id, 0.12)">
                    <ZoomIn :size="15" />
                  </button>
                  <button class="diagram-tool" type="button" title="缩小" @click="zoomDiagram(block.id, -0.12)">
                    <ZoomOut :size="15" />
                  </button>
                  <button class="diagram-tool" type="button" title="重置视图" @click="resetDiagramView(block.id)">
                    <RotateCcw :size="15" />
                  </button>
                </div>

                <div
                  class="diagram-canvas"
                  @pointerdown="startDiagramDrag(block.id, $event)"
                  @pointermove="dragDiagram(block.id, $event)"
                  @pointerup="stopDiagramDrag(block.id, $event)"
                  @pointercancel="stopDiagramDrag(block.id, $event)"
                >
                  <div class="diagram-content" :style="diagramTransform(block.id)" v-html="diagramSvg[block.id] || renderedBlocks[block.id]?.html"></div>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div v-if="block.type === 'table' && activeBlockId === block.id" class="table-toolbar" @pointerdown.prevent @click.stop>
              <button type="button" title="所选列左对齐" @click="setTableAlignment(block, 'left')">
                <AlignLeft :size="15" />
              </button>
              <button type="button" title="所选列居中" @click="setTableAlignment(block, 'center')">
                <AlignCenter :size="15" />
              </button>
              <button type="button" title="所选列右对齐" @click="setTableAlignment(block, 'right')">
                <AlignRight :size="15" />
              </button>
              <span class="table-toolbar-separator" aria-hidden="true"></span>
              <button type="button" title="减小所选列宽" @click="adjustTableColumnWidth(block, -24)">
                <Columns3 :size="15" />
                <Minus :size="12" />
              </button>
              <button type="button" title="增大所选列宽" @click="adjustTableColumnWidth(block, 24)">
                <Columns3 :size="15" />
                <Plus :size="12" />
              </button>
              <button type="button" title="降低所选行高" @click="adjustTableRowHeight(block, -8)">
                <Rows3 :size="15" />
                <Minus :size="12" />
              </button>
              <button type="button" title="增加所选行高" @click="adjustTableRowHeight(block, 8)">
                <Rows3 :size="15" />
                <Plus :size="12" />
              </button>
              <span class="table-toolbar-separator" aria-hidden="true"></span>
              <button type="button" title="在上方插入行" @click="insertTableRow(block, 'above')">
                <Rows3 :size="15" />
                <StretchVertical :size="12" />
              </button>
              <button type="button" title="在下方新增行" @click="insertTableRow(block, 'below')">
                <Rows3 :size="15" />
                <Plus :size="12" />
              </button>
              <button type="button" title="删除所选行" @click="deleteTableRow(block)">
                <Trash2 :size="15" />
              </button>
            </div>

            <div
              :key="`${block.id}-${renderRevision}`"
              class="render-block"
              :class="`render-${block.type}`"
              contenteditable="true"
              role="textbox"
              spellcheck="false"
              :aria-label="`编辑 ${block.type}`"
              v-html="renderedBlocks[block.id]?.html"
              @focusin="activateBlock(block)"
              @blur="handleEditableBlur(block, $event)"
              @input="handleEditableInput(block, $event)"
              @beforeinput="handleEditableBeforeInput(block, $event)"
              @keydown="handleEditableKeydown(block, $event)"
              @paste="handlePaste(block, $event)"
              @click.capture="handleRenderedClick(block, $event)"
            ></div>
          </template>
        </article>
      </template>

      <button v-else class="empty-editor" type="button" @click="createFirstBlock">点击开始写作</button>
    </div>

    <div v-if="commandMenu.open" class="command-menu" :style="{ left: `${commandMenu.x}px`, top: `${commandMenu.y}px` }" @pointerdown.prevent>
      <button v-for="item in commandItems" :key="item.kind" type="button" @click="applyCommand(item.kind)">
        <component :is="item.icon" :size="16" />
        <span>{{ item.label }}</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Code2,
  Columns3,
  Edit3,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Plus,
  Quote,
  RotateCcw,
  Rows3,
  StretchVertical,
  Table2,
  Trash2,
  Workflow,
  ZoomIn,
  ZoomOut,
} from 'lucide-vue-next';
import { useDocumentStore } from '../stores/document';
import { parseMarkdownBlocks, type MarkdownBlock } from '../utils/markdownBlocks';
import { applyEditableText, extractEditableText, renderMarkdownBlock, renderMarkdownDocument, slugifyHeading } from '../utils/markdownRenderer';

type CommandKind = 'paragraph' | 'h1' | 'h2' | 'h3' | 'quote' | 'ul' | 'ol' | 'code' | 'table' | 'mermaid';
type TableAlignment = 'left' | 'center' | 'right' | 'none';
type TableCellSelection = {
  blockId: string;
  rowIndex: number;
  colIndex: number;
};
type MarkdownImageMatch = {
  start: number;
  end: number;
  markdown: string;
};
type ParsedTable = {
  rows: string[][];
  alignments: TableAlignment[];
};

type DiagramView = {
  scale: number;
  x: number;
  y: number;
  dragging: boolean;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};
type CaretBoundary = 'start' | 'end';
type BlockDirection = 'previous' | 'next';

const store = useDocumentStore();
const rootRef = ref<HTMLElement | null>(null);
const diagramTextareaRef = ref<HTMLTextAreaElement | null>(null);
const activeBlockId = ref('');
const selectedBlockId = ref('');
const dirtyBlocks = reactive<Record<string, boolean>>({});
const editingDiagramId = ref('');
const diagramDraft = ref('');
const diagramSvg = ref<Record<string, string>>({});
const diagramViews = reactive<Record<string, DiagramView>>({});
const history = ref<string[]>([]);
const historyIndex = ref(-1);
const restoringHistory = ref(false);
const renderRevision = ref(0);
const historyDocumentRevision = ref(-1);
const pendingFocusIndex = ref<number | null>(null);
const activeTableCell = reactive<TableCellSelection>({
  blockId: '',
  rowIndex: 1,
  colIndex: 0,
});
const tableColumnWidths = reactive<Record<string, Record<number, number>>>({});
const tableRowHeights = reactive<Record<string, Record<number, number>>>({});
const commandMenu = reactive({
  open: false,
  x: 0,
  y: 0,
  blockId: '',
});

const blocks = computed(() => parseMarkdownBlocks(store.content));
const renderedBlocks = computed(() => Object.fromEntries(blocks.value.map((block) => [block.id, renderMarkdownBlock(block)])));
const emptyParagraph = '\u200B';
const commandMenuWidth = 190;
const commandMenuMargin = 8;
let activeInlineSourceBlockId = '';
let suppressNextContextMenu = false;
let lastHistoryPush = { time: 0, inputType: '', blockId: '' };
let diagramRenderRequest = 0;
let diagramRenderTimer: ReturnType<typeof window.setTimeout> | undefined;
const queuedHistorySteps: Array<{ direction: 'undo' | 'redo'; focusedBlockId: string }> = [];
let activeImageSourceBlockId = '';
let lastFocusedBlockId = '';
let lastFocusedBlockIndex = 0;

const commandItems = [
  { kind: 'paragraph', label: '段落', icon: Pilcrow },
  { kind: 'h1', label: '一级标题', icon: Heading1 },
  { kind: 'h2', label: '二级标题', icon: Heading2 },
  { kind: 'h3', label: '三级标题', icon: Heading3 },
  { kind: 'quote', label: '引用', icon: Quote },
  { kind: 'ul', label: '无序列表', icon: List },
  { kind: 'ol', label: '有序列表', icon: ListOrdered },
  { kind: 'code', label: '代码块', icon: Code2 },
  { kind: 'table', label: '表格', icon: Table2 },
  { kind: 'mermaid', label: 'Mermaid', icon: Workflow },
] as Array<{ kind: CommandKind; label: string; icon: unknown }>;

watch(
  blocks,
  () => {
    store.setRenderedHtml(renderMarkdownDocument(store.content));
    scheduleDiagramRender();
    void nextTick(() => {
      applyAllTableDisplayStyles();
    });
    if (selectedBlockId.value && !blocks.value.some((block) => block.id === selectedBlockId.value)) {
      selectedBlockId.value = '';
    }
    focusPendingBlock();
  },
  { immediate: true },
);

watch(
  () => store.theme,
  () => {
    scheduleDiagramRender();
  },
);

watch(
  () => store.content,
  (content) => {
    if (restoringHistory.value) return;
    if (historyDocumentRevision.value !== store.documentRevision || history.value.length === 0) {
      resetHistoryForCurrentDocument(content);
    }
  },
  { immediate: true },
);

watch(
  () => store.documentRevision,
  () => {
    resetHistoryForCurrentDocument(store.content);
  },
);

function setDiagramTextareaRef(element: unknown) {
  diagramTextareaRef.value = element instanceof HTMLTextAreaElement ? element : null;
  resizeDiagramTextarea();
}

function resizeDiagramTextarea() {
  void nextTick(() => {
    const textarea = diagramTextareaRef.value;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  });
}

function handleDiagramInput(event: Event) {
  diagramDraft.value = (event.target as HTMLTextAreaElement | null)?.value ?? diagramDraft.value;
  resizeDiagramTextarea();
  pushHistoryState(getCurrentDraftContent(), { inputType: 'diagramInput', blockId: editingDiagramId.value, merge: true });
}

function activateBlock(block: MarkdownBlock) {
  rememberFocusedBlock(block);
  activeBlockId.value = block.id;
}

function rememberFocusedBlock(block: MarkdownBlock) {
  lastFocusedBlockId = block.id;
  lastFocusedBlockIndex = block.index;
}

function handleEditableInput(block: MarkdownBlock, event: InputEvent) {
  if (isImageSourceInputTarget(event.target)) return;
  markBlockDirty(block, event.inputType);
}

function handleEditableBlur(block: MarkdownBlock, event: FocusEvent) {
  if (activeImageSourceBlockId === block.id) {
    const nextTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;
    if (nextTarget && getActiveImageSourceElement()?.contains(nextTarget)) return;

    window.setTimeout(() => {
      if (activeImageSourceBlockId === block.id) {
        commitActiveImageSourceIfOutside(document.activeElement);
      }
      if (dirtyBlocks[block.id]) {
        commitEditableBlock(block);
      }
    }, 0);
    return;
  }

  commitEditableBlock(block);
}

function markBlockDirty(block: MarkdownBlock, inputType = 'input') {
  activeBlockId.value = block.id;
  dirtyBlocks[block.id] = true;
  const draftContent = getDraftDocumentContent(block);
  if (draftContent === null) return;
  pushHistoryState(draftContent, { inputType, blockId: block.id, merge: true });
  store.saveDraftSnapshot(draftContent);
}

function commitEditableBlock(block: MarkdownBlock) {
  if (activeImageSourceBlockId === block.id) {
    commitActiveImageSourceIfOutside(null);
    if (!dirtyBlocks[block.id]) {
      return;
    }
  }

  if (!dirtyBlocks[block.id]) {
    if (activeInlineSourceBlockId === block.id) {
      activeInlineSourceBlockId = '';
    }
    activeBlockId.value = '';
    return;
  }

  const element = getEditableElement(block.id);
  if (!element) return;
  const text = extractRenderedMarkdown(element, block.type);
  const nextMarkdown = applyEditableText(block.markdown, block.type, text);
  if (nextMarkdown === block.markdown) {
    element.innerHTML = renderedBlocks.value[block.id]?.html ?? '';
    if (block.type === 'table') {
      applyTableDisplayStyles(block.id);
    }
    if (activeInlineSourceBlockId === block.id) {
      activeInlineSourceBlockId = '';
    }
    delete dirtyBlocks[block.id];
    activeBlockId.value = '';
    return;
  }

  applyBlockMarkdown(block.id, nextMarkdown);
  if (activeInlineSourceBlockId === block.id) {
    activeInlineSourceBlockId = '';
  }
  if (activeImageSourceBlockId === block.id) {
    activeImageSourceBlockId = '';
  }
  delete dirtyBlocks[block.id];
  activeBlockId.value = '';
}

function beginDiagramEdit(block: MarkdownBlock) {
  rememberFocusedBlock(block);
  editingDiagramId.value = block.id;
  diagramDraft.value = extractEditableText(block.markdown, block.type);
  void nextTick(() => {
    resizeDiagramTextarea();
    diagramTextareaRef.value?.focus();
    diagramTextareaRef.value?.select();
  });
}

function commitDiagramEdit(block: MarkdownBlock) {
  if (editingDiagramId.value !== block.id) return;
  const nextMarkdown = applyEditableText(block.markdown, block.type, diagramDraft.value);
  applyBlockMarkdown(block.id, nextMarkdown);
  editingDiagramId.value = '';
  diagramDraft.value = '';
}

function handleDiagramKeydown(block: MarkdownBlock, event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    commitDiagramEdit(block);
  }
}

function cancelDiagramEdit() {
  editingDiagramId.value = '';
  diagramDraft.value = '';
}

function createFirstBlock() {
  applyDocumentContent('# 未命名文档', true);
  pendingFocusIndex.value = 0;
}

function applyBlockMarkdown(blockId: string, markdown: string) {
  const nextBlocks = blocks.value.map((block) => (block.id === blockId ? markdown : block.markdown));
  applyDocumentContent(nextBlocks.filter(shouldKeepMarkdownBlock).join('\n\n'), true);
}

function saveDraftSnapshot(block: MarkdownBlock) {
  const draftContent = getDraftDocumentContent(block);
  if (draftContent === null) return;
  store.saveDraftSnapshot(draftContent);
}

function getDraftDocumentContent(block: MarkdownBlock) {
  const element = getEditableElement(block.id);
  if (!element) return null;
  const markdown = applyEditableText(block.markdown, block.type, extractRenderedMarkdown(element, block.type));
  const nextBlocks = blocks.value.map((item) => (item.id === block.id ? markdown : item.markdown));
  return nextBlocks.filter(shouldKeepMarkdownBlock).join('\n\n');
}

function getCurrentDraftContent(preferredBlockId = '') {
  if (activeImageSourceBlockId) {
    const imageSourceBlock = blocks.value.find((item) => item.id === activeImageSourceBlockId);
    const imageSourceWrapper = getActiveImageSourceElement();
    const imageSourceDraft = imageSourceBlock && imageSourceWrapper ? getImageSourceDraftDocumentContent(imageSourceBlock, imageSourceWrapper) : null;
    if (imageSourceDraft) {
      return imageSourceDraft;
    }
  }

  if (editingDiagramId.value) {
    const diagramBlock = blocks.value.find((item) => item.id === editingDiagramId.value);
    if (diagramBlock) {
      const nextMarkdown = applyEditableText(diagramBlock.markdown, diagramBlock.type, diagramDraft.value);
      return blocks.value
        .map((item) => (item.id === diagramBlock.id ? nextMarkdown : item.markdown))
        .filter(shouldKeepMarkdownBlock)
        .join('\n\n');
    }
  }

  const focusedBlockId = preferredBlockId || getFocusedEditableBlockId() || activeBlockId.value;
  const activeBlock = blocks.value.find((item) => item.id === focusedBlockId);
  if (activeBlock) {
    const draftContent = getDraftDocumentContent(activeBlock);
    if (draftContent !== null) {
      return draftContent;
    }
  }

  return store.content;
}

function applyDocumentContent(content: string, pushHistory: boolean, historyOptions: HistoryPushOptions = {}) {
  if (content === store.content) return;
  ensureHistoryDocument();
  store.setContent(content);
  if (pushHistory) {
    pushHistoryState(content, historyOptions);
  }
}

type HistoryPushOptions = {
  blockId?: string;
  forceMerge?: boolean;
  inputType?: string;
  merge?: boolean;
};

function pushHistoryState(content: string, options: HistoryPushOptions = {}) {
  ensureHistoryDocument();
  const current = history.value[historyIndex.value];
  if (current === content) return;

  const now = Date.now();
  const shouldMerge =
    options.merge === true &&
    historyIndex.value === history.value.length - 1 &&
    lastHistoryPush.blockId === (options.blockId ?? '') &&
    historyInputGroup(lastHistoryPush.inputType) === historyInputGroup(options.inputType ?? '') &&
    (options.forceMerge === true || now - lastHistoryPush.time < 900);

  if (shouldMerge && historyIndex.value > 0) {
    history.value = [...history.value.slice(0, historyIndex.value), content];
    historyIndex.value = history.value.length - 1;
    lastHistoryPush = { time: now, inputType: options.inputType ?? '', blockId: options.blockId ?? '' };
    return;
  }

  history.value = [...history.value.slice(0, historyIndex.value + 1), content].slice(-80);
  historyIndex.value = history.value.length - 1;
  lastHistoryPush = { time: now, inputType: options.inputType ?? '', blockId: options.blockId ?? '' };
}

function historyInputGroup(inputType: string) {
  if (inputType.startsWith('delete')) return 'delete';
  if (inputType.startsWith('insert') || inputType === 'input' || inputType === 'diagramInput') return 'insert';
  return inputType;
}

function undoContent() {
  ensureHistoryDocument();
  if (historyIndex.value <= 0) return;
  historyIndex.value -= 1;
  restoreHistoryContent(history.value[historyIndex.value]);
  return true;
}

function redoContent() {
  ensureHistoryDocument();
  if (historyIndex.value >= history.value.length - 1) return;
  historyIndex.value += 1;
  restoreHistoryContent(history.value[historyIndex.value]);
  return true;
}

function restoreHistoryContent(content: string) {
  ensureHistoryDocument();
  restoringHistory.value = true;
  lastHistoryPush = { time: 0, inputType: '', blockId: '' };
  clearDirtyBlocks();
  activeBlockId.value = '';
  editingDiagramId.value = '';
  diagramDraft.value = '';
  activeInlineSourceBlockId = '';
  activeImageSourceBlockId = '';
  renderRevision.value += 1;
  store.setContent(content);
  void nextTick(() => {
    restoringHistory.value = false;
    flushQueuedHistoryStep();
  });
}

function resetHistoryForCurrentDocument(content: string) {
  historyDocumentRevision.value = store.documentRevision;
  history.value = [content];
  historyIndex.value = 0;
  lastHistoryPush = { time: 0, inputType: '', blockId: '' };
  queuedHistorySteps.length = 0;
}

function ensureHistoryDocument() {
  if (historyDocumentRevision.value !== store.documentRevision || history.value.length === 0) {
    resetHistoryForCurrentDocument(store.content);
  }
}

function clearDirtyBlocks() {
  Object.keys(dirtyBlocks).forEach((key) => {
    delete dirtyBlocks[key];
  });
}

function handleEditableKeydown(block: MarkdownBlock, event: KeyboardEvent) {
  if (isImageSourceInputTarget(event.target)) return;

  rememberFocusedBlock(block);

  if (isUndoShortcut(event)) {
    event.preventDefault();
    event.stopPropagation();
    if (restoringHistory.value) {
      queueHistoryStep('undo', block.id);
      return;
    }
    snapshotCurrentDraft(block.id);
    if (undoContent()) {
      restoreFocusAfterHistory(block.id);
    }
    return;
  }

  if (isRedoShortcut(event)) {
    event.preventDefault();
    event.stopPropagation();
    if (restoringHistory.value) {
      queueHistoryStep('redo', block.id);
      return;
    }
    snapshotCurrentDraft(block.id);
    if (redoContent()) {
      restoreFocusAfterHistory(block.id);
    }
    return;
  }

  if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && moveCaretAcrossBlockBoundary(block, event.key === 'ArrowUp' ? 'previous' : 'next')) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    insertPlainParagraphAfter(block);
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    if (!event.shiftKey && block.type === 'list' && isEditableBlockEmpty(block)) {
      exitEmptyListBlock(block);
      return;
    }
    insertPlainBreakOrParagraph(block, event.shiftKey);
    return;
  }

  if (event.key === '/' && isEditableBlockEmpty(block)) {
    event.preventDefault();
    openCommandMenuForBlock(block.id);
  }
}

function handleEditableBeforeInput(block: MarkdownBlock, event: InputEvent) {
  if (isImageSourceInputTarget(event.target)) return;
  rememberFocusedBlock(block);

  if (isDeleteInput(event) && removeSelectedImage(block, event.inputType)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  if (isDeleteInput(event) && isEditableBlockEmpty(block)) {
    event.preventDefault();
    event.stopPropagation();
    removeEmptyBlock(block, event.inputType);
    return;
  }

  if (event.inputType === 'historyUndo') {
    event.preventDefault();
    event.stopPropagation();
    if (restoringHistory.value) {
      queueHistoryStep('undo', block.id);
      return;
    }
    snapshotCurrentDraft(block.id);
    if (undoContent()) {
      restoreFocusAfterHistory(block.id);
    }
    return;
  }

  if (event.inputType === 'historyRedo') {
    event.preventDefault();
    event.stopPropagation();
    if (restoringHistory.value) {
      queueHistoryStep('redo', block.id);
      return;
    }
    snapshotCurrentDraft(block.id);
    if (redoContent()) {
      restoreFocusAfterHistory(block.id);
    }
    return;
  }

  if (event.inputType !== 'insertParagraph' && event.inputType !== 'insertLineBreak') return;
  event.preventDefault();
  if (event.inputType === 'insertParagraph' && block.type === 'list' && isEditableBlockEmpty(block)) {
    exitEmptyListBlock(block);
    return;
  }
  insertPlainBreakOrParagraph(block, event.inputType === 'insertLineBreak');
}

function isImageSourceInputTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('.image-source-input'));
}

function isDeleteInput(event: InputEvent) {
  return event.inputType.startsWith('delete');
}

function removeSelectedImage(block: MarkdownBlock, inputType: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  if (!range.collapsed) {
    const selectedImage = selectedRangeImage(range);
    if (!selectedImage) return false;
    selectedImage.remove();
    markBlockDirty(block, 'deleteContentBackward');
    return true;
  }

  const image = inputType === 'deleteContentForward' ? imageAfterCaret(range) : imageBeforeCaret(range);
  if (!image) return false;
  image.remove();
  markBlockDirty(block, 'deleteContentBackward');
  return true;
}

function selectedRangeImage(range: Range) {
  const fragment = range.cloneContents();
  const images = Array.from(fragment.querySelectorAll?.('img') ?? []);
  if (images.length !== 1) return null;
  const editable = range.commonAncestorContainer instanceof HTMLElement ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
  const source = images[0].getAttribute('data-md-src') || images[0].getAttribute('src') || '';
  return Array.from(editable?.querySelectorAll<HTMLImageElement>('img') ?? []).find((image) => imageMarkdownSource(image) === source) ?? null;
}

function imageBeforeCaret(range: Range) {
  const previous = adjacentNodeAtCaret(range, 'previous');
  if (previous instanceof HTMLImageElement) return previous;
  if (previous instanceof HTMLElement) return previous.querySelector<HTMLImageElement>('img:last-of-type');
  return null;
}

function imageAfterCaret(range: Range) {
  const next = adjacentNodeAtCaret(range, 'next');
  if (next instanceof HTMLImageElement) return next;
  if (next instanceof HTMLElement) return next.querySelector<HTMLImageElement>('img:first-of-type');
  return null;
}

function adjacentNodeAtCaret(range: Range, direction: 'previous' | 'next') {
  const container = range.startContainer;
  const offset = range.startOffset;
  if (container.nodeType === Node.TEXT_NODE) {
    const text = container.textContent ?? '';
    if (direction === 'previous' && offset > 0 && text.slice(0, offset).replace(/\u200B/g, '').length > 0) return null;
    if (direction === 'next' && offset < text.length && text.slice(offset).replace(/\u200B/g, '').length > 0) return null;
    return direction === 'previous' ? container.previousSibling : container.nextSibling;
  }

  const parent = container;
  return direction === 'previous' ? parent.childNodes[offset - 1] ?? null : parent.childNodes[offset] ?? null;
}

function openContextMenu(event: MouseEvent) {
  if (suppressNextContextMenu || event.ctrlKey || event.metaKey) {
    suppressNextContextMenu = false;
    return;
  }

  const article = (event.target as HTMLElement | null)?.closest<HTMLElement>('.render-block-group');
  commandMenu.blockId = article?.dataset.blockId ?? blocks.value.at(-1)?.id ?? '';
  placeCommandMenu(event.clientX, event.clientY);
  commandMenu.open = true;
}

function openCommandMenuForBlock(blockId: string) {
  const article = rootRef.value?.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
  const rect = article?.getBoundingClientRect();
  commandMenu.blockId = blockId;
  placeCommandMenu(rect ? rect.left + 18 : 120, rect ? rect.top + 8 : 120);
  commandMenu.open = true;
}

function closeCommandMenu() {
  commandMenu.open = false;
}

function applyCommand(kind: CommandKind) {
  const template = commandTemplate(kind);
  const blockIndex = blocks.value.findIndex((block) => block.id === commandMenu.blockId);
  const nextBlocks = [...blocks.value.map((block) => block.markdown)];
  const replaceCurrent = blockIndex >= 0 && nextBlocks[blockIndex].trim().length === 0;
  const insertIndex = blockIndex >= 0 ? blockIndex + (replaceCurrent ? 0 : 1) : nextBlocks.length;

  if (replaceCurrent) {
    nextBlocks[blockIndex] = template;
    pendingFocusIndex.value = blockIndex;
  } else {
    nextBlocks.splice(insertIndex, 0, template);
    pendingFocusIndex.value = insertIndex;
  }

  closeCommandMenu();
  applyDocumentContent(nextBlocks.join('\n\n'), true);
}

function insertPlainParagraphAfter(block: MarkdownBlock) {
  if (dirtyBlocks[block.id]) {
    commitEditableBlock(block);
  }

  const blockIndex = blocks.value.findIndex((item) => item.id === block.id);
  const insertIndex = blockIndex >= 0 ? blockIndex + 1 : blocks.value.length;
  const nextBlocks = [...blocks.value.map((item) => item.markdown)];
  nextBlocks.splice(insertIndex, 0, emptyParagraph);
  pendingFocusIndex.value = insertIndex;
  applyDocumentContent(nextBlocks.join('\n\n'), true);
}

function placeCommandMenu(x: number, y: number) {
  const estimatedHeight = commandItems.length * 36 + 14;
  commandMenu.x = clamp(x, commandMenuMargin, Math.max(commandMenuMargin, window.innerWidth - commandMenuWidth - commandMenuMargin));
  commandMenu.y = clamp(y, commandMenuMargin, Math.max(commandMenuMargin, window.innerHeight - estimatedHeight - commandMenuMargin));

  void nextTick(() => {
    const menu = rootRef.value?.querySelector<HTMLElement>('.command-menu');
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    commandMenu.x = clamp(commandMenu.x, commandMenuMargin, Math.max(commandMenuMargin, window.innerWidth - rect.width - commandMenuMargin));
    commandMenu.y = clamp(commandMenu.y, commandMenuMargin, Math.max(commandMenuMargin, window.innerHeight - rect.height - commandMenuMargin));
  });
}

function commandTemplate(kind: CommandKind) {
  const templates: Record<CommandKind, string> = {
    paragraph: '新段落',
    h1: '# 一级标题',
    h2: '## 二级标题',
    h3: '### 三级标题',
    quote: '> 引用',
    ul: '- 列表项',
    ol: '1. 列表项',
    code: '```javascript\nconsole.log("hello");\n```',
    table: '| 列 A | 列 B |\n| --- | --- |\n| 内容 | 内容 |',
    mermaid: '```mermaid\ngraph TD\n  A[开始] --> B[结束]\n```',
  };
  return templates[kind];
}

function focusPendingBlock() {
  const index = pendingFocusIndex.value;
  if (index === null) return;
  pendingFocusIndex.value = null;
  void nextTick(() => {
    const block = blocks.value[index];
    if (!block || block.type === 'diagram') {
      if (block) beginDiagramEdit(block);
      return;
    }
    const element = rootRef.value?.querySelector<HTMLElement>(`[data-index="${index}"] .render-block`);
    focusEditableEnd(element);
  });
}

function focusEditableEnd(element?: HTMLElement | null) {
  if (!element) return;
  focusEditableBoundary(element, 'end');
}

function focusEditableStart(element?: HTMLElement | null) {
  if (!element) return;
  focusEditableBoundary(element, 'start');
}

function focusEditableBoundary(element: HTMLElement, boundary: CaretBoundary) {
  element.focus();
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(boundary === 'start');
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function insertPlainBreakOrParagraph(block: MarkdownBlock, forceLineBreak = false) {
  if (block.type === 'heading' && !forceLineBreak) {
    insertPlainParagraphAfter(block);
    return;
  }

  insertLineBreakAtSelection();
  markBlockDirty(block);
}

function insertLineBreakAtSelection() {
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (!selection || !range) return;

  range.deleteContents();
  const br = document.createElement('br');
  range.insertNode(br);
  range.setStartAfter(br);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function exitEmptyListBlock(block: MarkdownBlock) {
  const nextBlocks = blocks.value.map((item) => (item.id === block.id ? emptyParagraph : item.markdown));
  pendingFocusIndex.value = block.index;
  delete dirtyBlocks[block.id];
  activeBlockId.value = '';
  applyDocumentContent(nextBlocks.filter(shouldKeepMarkdownBlock).join('\n\n'), true);
}

function removeEmptyBlock(block: MarkdownBlock, inputType = 'deleteContentBackward') {
  const element = getEditableElement(block.id);
  if (!element || !isElementVisiblyEmpty(element)) return;

  const historyOptions = emptyBlockRemovalHistoryOptions(block, inputType);
  const nextBlocks = blocks.value
    .filter((item) => item.id !== block.id)
    .map((item) => item.markdown)
    .filter((markdown) => sanitizeEditableText(markdown).trim().length > 0);

  delete dirtyBlocks[block.id];
  activeBlockId.value = '';
  activeInlineSourceBlockId = '';
  renderRevision.value += 1;

  if (!nextBlocks.length) {
    pendingFocusIndex.value = 0;
    applyDocumentContent(emptyParagraph, true, historyOptions);
    return;
  }

  pendingFocusIndex.value = Math.max(0, Math.min(block.index - 1, nextBlocks.length - 1));
  applyDocumentContent(nextBlocks.join('\n\n'), true, historyOptions);
}

function emptyBlockRemovalHistoryOptions(block: MarkdownBlock, inputType: string): HistoryPushOptions {
  if (!shouldMergeEmptyBlockRemoval(block)) return {};
  return { blockId: block.id, forceMerge: true, inputType, merge: true };
}

function emptyBlockDeletionHistoryOptions(block: MarkdownBlock): HistoryPushOptions {
  if (!shouldMergeEmptyBlockDeletion(block)) return {};
  return { blockId: block.id, forceMerge: true, inputType: lastHistoryPush.inputType || 'deleteContentBackward', merge: true };
}

function shouldMergeEmptyBlockDeletion(block: MarkdownBlock) {
  return (
    isStructuralBlockType(block.type) &&
    lastHistoryPush.blockId === block.id &&
    historyInputGroup(lastHistoryPush.inputType) === 'delete' &&
    (isEditableBlockEmpty(block) || isEmptyStructuralBlock(block))
  );
}

function shouldMergeEmptyBlockRemoval(block: MarkdownBlock) {
  return (
    isStructuralBlockType(block.type) &&
    lastHistoryPush.blockId === block.id &&
    historyInputGroup(lastHistoryPush.inputType) === 'delete' &&
    (dirtyBlocks[block.id] || isEmptyStructuralBlock(block))
  );
}

function isStructuralBlockType(type: MarkdownBlock['type']) {
  return type === 'heading' || type === 'quote' || type === 'list' || type === 'code' || type === 'diagram';
}

function isEmptyStructuralBlock(block: MarkdownBlock) {
  return sanitizeEditableText(extractEditableText(block.markdown, block.type)).replace(/\u00a0/g, ' ').trim().length === 0;
}

function isElementVisiblyEmpty(element: HTMLElement) {
  const text = sanitizeEditableText(element.innerText).replace(/\u00a0/g, ' ').trim();
  if (text.length > 0) return false;
  return !element.querySelector('img, svg, table, pre, code, input, textarea');
}

function moveCaretAcrossBlockBoundary(block: MarkdownBlock, direction: BlockDirection) {
  if (!isSelectionAtBlockVisualEdge(direction)) return false;
  const target = findAdjacentFocusableBlock(block, direction);
  if (!target) return false;

  if (dirtyBlocks[block.id]) {
    commitEditableBlock(block);
  }

  if (target.type === 'diagram') {
    beginDiagramEdit(target);
    return true;
  }

  const targetElement = getEditableElement(target.id);
  if (!targetElement) return false;

  if (direction === 'previous') {
    focusEditableEnd(targetElement);
  } else {
    focusEditableStart(targetElement);
  }
  activeBlockId.value = target.id;
  rememberFocusedBlock(target);
  return true;
}

function findAdjacentFocusableBlock(block: MarkdownBlock, direction: BlockDirection) {
  const step = direction === 'previous' ? -1 : 1;
  let index = block.index + step;
  while (index >= 0 && index < blocks.value.length) {
    const candidate = blocks.value[index];
    if (candidate) return candidate;
    index += step;
  }
  return null;
}

function isSelectionAtEditableBoundary(boundary: CaretBoundary) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return false;
  const range = selection.getRangeAt(0);
  const editable = getSelectionEditable(range);
  if (!editable) return false;
  const probe = document.createRange();
  probe.selectNodeContents(editable);
  if (boundary === 'start') {
    probe.setEnd(range.startContainer, range.startOffset);
  } else {
    probe.setStart(range.startContainer, range.startOffset);
  }
  return sanitizeEditableText(probe.toString()).replace(/\u00a0/g, ' ').trim().length === 0;
}

function isSelectionAtBlockVisualEdge(direction: BlockDirection) {
  if (isSelectionAtEditableBoundary(direction === 'previous' ? 'start' : 'end')) return true;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return false;
  const range = selection.getRangeAt(0);
  const editable = getSelectionEditable(range);
  if (!editable) return false;

  const caretRect = getCaretRect(range);
  if (!caretRect) return false;

  const contentRange = document.createRange();
  contentRange.selectNodeContents(editable);
  const contentRects = Array.from(contentRange.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
  if (!contentRects.length) return false;

  const tolerance = 4;
  if (direction === 'previous') {
    const firstTop = Math.min(...contentRects.map((rect) => rect.top));
    return caretRect.top <= firstTop + tolerance;
  }

  const lastBottom = Math.max(...contentRects.map((rect) => rect.bottom));
  return caretRect.bottom >= lastBottom - tolerance;
}

function getCaretRect(range: Range) {
  const rect = range.getBoundingClientRect();
  if (rect.height > 0) return rect;

  const marker = document.createElement('span');
  marker.textContent = '\u200B';
  const probe = range.cloneRange();
  probe.insertNode(marker);
  const markerRect = marker.getBoundingClientRect();
  marker.remove();
  return markerRect.height > 0 ? markerRect : null;
}

function getSelectionEditable(range: Range) {
  const container = range.startContainer;
  const element = container instanceof Element ? container : container.parentElement;
  return element?.closest<HTMLElement>('.render-block') ?? null;
}

async function handlePaste(block: MarkdownBlock, event: ClipboardEvent) {
  if (isImageSourceInputTarget(event.target)) return;
  event.preventDefault();
  const images = clipboardImageFiles(event);
  const text = event.clipboardData?.getData('text/plain') ?? '';

  if (text) {
    document.execCommand('insertText', false, text);
  }

  for (const image of images) {
    const src = await readFileAsDataUrl(image);
    const saved = await savePastedImage(src, image.name || 'pasted image');
    insertImageAtSelection(saved.path, saved.name);
  }

  markBlockDirty(block, 'insertFromPaste');
}

function clipboardImageFiles(event: ClipboardEvent) {
  const items = Array.from(event.clipboardData?.items ?? []);
  return items
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read pasted image'));
    reader.readAsDataURL(file);
  });
}

function insertImageAtSelection(src: string, alt: string) {
  if (!src) return;
  const image = document.createElement('img');
  image.src = renderableImageSource(src);
  image.dataset.mdSrc = src;
  image.alt = alt;
  insertNodeAtSelection(image);
}

function insertNodeAtSelection(node: Node) {
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (!selection || !range) return;

  range.deleteContents();
  range.insertNode(node);
  const spacer = document.createTextNode('\u200B');
  node.parentNode?.insertBefore(spacer, node.nextSibling);
  range.setStartAfter(spacer);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

async function savePastedImage(dataUrl: string, fileName: string) {
  if (window.desktopApi?.savePastedImage) {
    try {
      return await window.desktopApi.savePastedImage(dataUrl, fileName, store.filePath);
    } catch {
      store.statusText = '图片保存失败，已使用内嵌图片';
    }
  }

  return { path: dataUrl, name: fileName || 'pasted image' };
}

function handleRenderedClick(block: MarkdownBlock, event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  const image = target?.closest<HTMLImageElement>('img');
  if (image) {
    event.preventDefault();
    event.stopPropagation();
    beginImageSourceEdit(block, image);
    return;
  }

  const link = target?.closest<HTMLAnchorElement>('a');

  if (link && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    event.stopPropagation();
    openMarkdownLink(link);
    return;
  }

  if (link) {
    event.preventDefault();
  }

  expandInlineMarkdownAtTarget(block, target);
  if (block.type === 'table') {
    captureTableCell(block, event);
  }
}

function openMarkdownLink(link: HTMLAnchorElement) {
  const rawHref = link.getAttribute('href')?.trim() ?? '';
  if (!rawHref) return;

  if (rawHref.startsWith('#')) {
    const target = findInternalAnchorTarget(rawHref);
    if (target) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else {
      window.location.hash = rawHref;
    }
    return;
  }

  window.open(link.href || rawHref, '_blank', 'noopener,noreferrer');
}

function findInternalAnchorTarget(hash: string) {
  const rawId = hash.slice(1);
  const decodedId = decodeAnchor(rawId);
  const candidates = Array.from(new Set([rawId, decodedId, slugifyHeading(decodedId)]));

  for (const id of candidates) {
    if (!id) continue;
    const exact = rootRef.value?.querySelector<HTMLElement>(`#${cssEscape(id)}`) ?? document.getElementById(id);
    if (exact) return exact;
  }

  const headings = Array.from(rootRef.value?.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6') ?? []);
  return headings.find((heading) => candidates.includes(slugifyHeading(heading.textContent ?? ''))) ?? null;
}

function decodeAnchor(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function cssEscape(value: string) {
  return window.CSS?.escape ? window.CSS.escape(value) : value.replace(/["\\#.:,[\]>+~*^$|=]/g, '\\$&');
}

function expandInlineMarkdownAtTarget(block: MarkdownBlock, target: HTMLElement | null) {
  if (!target) return;
  const activeSource = getActiveInlineSourceElement();
  if (activeSource?.contains(target)) return;

  const inline = target.closest<HTMLElement>('strong,b,em,i,code,a,s,del');
  if (!inline || inline.closest('pre')) return;

  const source = inlineElementToMarkdown(inline);
  if (!source) return;

  const replacement = document.createElement('span');
  replacement.className = 'inline-source';
  replacement.textContent = source;
  inline.replaceWith(replacement);
  activeInlineSourceBlockId = block.id;
  markBlockDirty(block);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(replacement);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function getActiveInlineSourceElement() {
  if (!activeInlineSourceBlockId) return null;
  return getEditableElement(activeInlineSourceBlockId)?.querySelector<HTMLElement>('.inline-source') ?? null;
}

function commitActiveInlineSourceIfOutside(target: Node | null) {
  const source = getActiveInlineSourceElement();
  if (!source || (target && source.contains(target))) return;

  const block = blocks.value.find((item) => item.id === activeInlineSourceBlockId);
  if (block) {
    commitEditableBlock(block);
  }
  activeInlineSourceBlockId = '';
}

function beginImageSourceEdit(block: MarkdownBlock, image: HTMLImageElement) {
  commitActiveImageSourceIfOutside(null);
  const wrapper = image.closest<HTMLElement>('.image-source-wrap');
  if (wrapper) {
    const textarea = wrapper.querySelector<HTMLTextAreaElement>('.image-source-input');
    textarea?.focus();
    textarea?.select();
    return;
  }

  const editable = getEditableElement(block.id);
  const imageIndex = editable ? Array.from(editable.querySelectorAll<HTMLImageElement>('img')).indexOf(image) : -1;
  const baseMarkdown =
    editable && dirtyBlocks[block.id] ? applyEditableText(block.markdown, block.type, extractRenderedMarkdown(editable, block.type)) : block.markdown;
  const markdownMatch = imageIndex >= 0 ? findMarkdownImageByIndex(baseMarkdown, imageIndex) : null;
  const source = markdownMatch?.markdown ?? imageElementToMarkdown(image);
  if (!source) return;

  const nextWrapper = document.createElement('span');
  nextWrapper.className = 'image-source-wrap';
  nextWrapper.contentEditable = 'false';

  const textarea = document.createElement('textarea');
  textarea.className = 'image-source-input';
  textarea.spellcheck = false;
  textarea.value = source;
  textarea.dataset.originalSource = source;
  textarea.dataset.originalMarkdown = source;
  textarea.dataset.blockMarkdown = baseMarkdown;
  textarea.dataset.imageIndex = String(imageIndex);
  textarea.rows = 1;
  textarea.addEventListener('beforeinput', (event) => {
    event.stopPropagation();
    if (event.inputType === 'historyUndo') {
      event.preventDefault();
      stepImageSourceHistory(block, 'undo');
      return;
    }
    if (event.inputType === 'historyRedo') {
      event.preventDefault();
      stepImageSourceHistory(block, 'redo');
    }
  });
  textarea.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (!isUndoShortcut(event) && !isRedoShortcut(event)) return;

    event.preventDefault();
    stepImageSourceHistory(block, isUndoShortcut(event) ? 'undo' : 'redo');
  });
  textarea.addEventListener('blur', () => {
    commitActiveImageSourceIfOutside(null);
  });
  textarea.addEventListener('input', (event) => {
    event.stopPropagation();
    autoSizeImageSourceInput(textarea);
    activeBlockId.value = block.id;
    const draftContent = getImageSourceDraftDocumentContent(block, nextWrapper);
    if (draftContent !== null) {
      pushHistoryState(draftContent, { inputType: 'imageSourceInput', blockId: block.id, merge: true });
      store.saveDraftSnapshot(draftContent);
    }
  });

  image.replaceWith(nextWrapper);
  nextWrapper.append(textarea, image);
  activeImageSourceBlockId = block.id;
  activeBlockId.value = block.id;
  void nextTick(() => {
    autoSizeImageSourceInput(textarea);
    textarea.focus();
    textarea.select();
  });
}

function snapshotImageSourceDraft(block: MarkdownBlock) {
  activeBlockId.value = block.id;
  const wrapper = getActiveImageSourceElement();
  const draftContent = wrapper ? getImageSourceDraftDocumentContent(block, wrapper) : getDraftDocumentContent(block);
  if (draftContent === null) return;
  pushHistoryState(draftContent);
  store.saveDraftSnapshot(draftContent);
}

function stepImageSourceHistory(block: MarkdownBlock, direction: 'undo' | 'redo') {
  const focusedBlockId = block.id;
  snapshotImageSourceDraft(block);
  const changed = direction === 'undo' ? undoContent() : redoContent();
  if (changed) {
    restoreFocusAfterHistory(focusedBlockId);
  }
}

function getActiveImageSourceElement() {
  if (!activeImageSourceBlockId) return null;
  return getEditableElement(activeImageSourceBlockId)?.querySelector<HTMLElement>('.image-source-wrap') ?? null;
}

function commitActiveImageSourceIfOutside(target: Node | null) {
  const blockId = activeImageSourceBlockId;
  const wrapper = blockId ? getEditableElement(blockId)?.querySelector<HTMLElement>('.image-source-wrap') ?? null : null;
  if (!wrapper || (target && wrapper.contains(target))) return;

  activeImageSourceBlockId = '';
  const block = blocks.value.find((item) => item.id === blockId);
  const draft = readImageSourceDraft(wrapper);

  if (!block || !draft?.parsedCurrent || !draft.changed) {
    restoreImageSourceElement(wrapper);
    activeBlockId.value = '';
    return;
  }

  const nextBlockMarkdown = replaceImageMarkdownInBlock(block, draft);
  if (nextBlockMarkdown !== null) {
    commitImageSourceElement(wrapper, draft.nextMarkdown);
    const nextContent = blocks.value
      .map((item) => (item.id === block.id ? nextBlockMarkdown : item.markdown))
      .filter(shouldKeepMarkdownBlock)
      .join('\n\n');
    delete dirtyBlocks[block.id];
    activeBlockId.value = '';
    applyDocumentContent(nextContent, true);
    return;
  }

  restoreImageSourceElement(wrapper);
  activeBlockId.value = '';
}

function commitImageSourceElement(wrapper: HTMLElement, sourceMarkdown?: string) {
  const textarea = wrapper.querySelector<HTMLTextAreaElement>('.image-source-input');
  const image = wrapper.querySelector<HTMLImageElement>('img');
  const parsed =
    parseMarkdownImageSource(sourceMarkdown ?? textarea?.value ?? '') ??
    parseMarkdownImageSource(textarea?.dataset.originalMarkdown ?? '') ??
    parseMarkdownImageSource(textarea?.dataset.originalSource ?? '');
  if (!image) {
    wrapper.remove();
    return;
  }

  if (!parsed) {
    wrapper.replaceWith(image);
    return;
  }

  image.src = renderableImageSource(parsed.src);
  image.dataset.mdSrc = parsed.src;
  image.alt = parsed.alt;
  if (parsed.title) {
    image.title = parsed.title;
  } else {
    image.removeAttribute('title');
  }
  wrapper.replaceWith(image);
}

function restoreImageSourceElement(wrapper: HTMLElement) {
  const image = wrapper.querySelector<HTMLImageElement>('img');
  if (!image) {
    wrapper.remove();
    return;
  }

  const textarea = wrapper.querySelector<HTMLTextAreaElement>('.image-source-input');
  const parsed = parseMarkdownImageSource(textarea?.dataset.originalMarkdown ?? '') ?? parseMarkdownImageSource(textarea?.dataset.originalSource ?? '');
  if (parsed) {
    image.src = renderableImageSource(parsed.src);
    image.dataset.mdSrc = parsed.src;
    image.alt = parsed.alt;
    if (parsed.title) {
      image.title = parsed.title;
    } else {
      image.removeAttribute('title');
    }
  }
  wrapper.replaceWith(image);
}

function readImageSourceDraft(wrapper: HTMLElement) {
  const textarea = wrapper.querySelector<HTMLTextAreaElement>('.image-source-input');
  if (!textarea) return null;

  const originalMarkdown = textarea.dataset.originalMarkdown || textarea.dataset.originalSource || '';
  const parsedCurrent = parseMarkdownImageSource(textarea.value);
  const nextMarkdown = parsedCurrent ? formatMarkdownImageSource(parsedCurrent) : originalMarkdown.trim();
  return {
    parsedCurrent,
    nextMarkdown,
    originalMarkdown,
    blockMarkdown: textarea.dataset.blockMarkdown || '',
    imageIndex: Number(textarea.dataset.imageIndex ?? '-1'),
    changed: parsedCurrent ? !sameMarkdownImageSource(textarea.value, originalMarkdown) : false,
  };
}

function getImageSourceDraftDocumentContent(block: MarkdownBlock, wrapper: HTMLElement) {
  const draft = readImageSourceDraft(wrapper);
  if (!draft?.parsedCurrent || !draft.changed) return null;

  const nextBlockMarkdown = replaceImageMarkdownInBlock(block, draft);
  if (nextBlockMarkdown === null) return null;

  return blocks.value
    .map((item) => (item.id === block.id ? nextBlockMarkdown : item.markdown))
    .filter(shouldKeepMarkdownBlock)
    .join('\n\n');
}

function replaceImageMarkdownInBlock(block: MarkdownBlock, draft: NonNullable<ReturnType<typeof readImageSourceDraft>>) {
  const sourceMarkdown = draft.blockMarkdown || block.markdown;
  const match = Number.isFinite(draft.imageIndex) && draft.imageIndex >= 0 ? findMarkdownImageByIndex(sourceMarkdown, draft.imageIndex) : null;
  if (match) {
    return `${sourceMarkdown.slice(0, match.start)}${draft.nextMarkdown}${sourceMarkdown.slice(match.end)}`;
  }

  const exactIndex = draft.originalMarkdown ? sourceMarkdown.indexOf(draft.originalMarkdown) : -1;
  if (exactIndex >= 0) {
    return `${sourceMarkdown.slice(0, exactIndex)}${draft.nextMarkdown}${sourceMarkdown.slice(exactIndex + draft.originalMarkdown.length)}`;
  }

  return null;
}

function sameMarkdownImageSource(left: string, right: string) {
  if (left.trim() === right.trim()) return true;

  const parsedLeft = parseMarkdownImageSource(left);
  const parsedRight = parseMarkdownImageSource(right);
  if (!parsedLeft || !parsedRight) return false;

  return parsedLeft.alt === parsedRight.alt && parsedLeft.src === parsedRight.src && parsedLeft.title === parsedRight.title;
}

function autoSizeImageSourceInput(textarea: HTMLTextAreaElement) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function parseMarkdownImageSource(value: string) {
  const trimmed = value.trim();
  const match = /^!\[((?:\\.|[^\]\\])*)\]\((<[^>]*>|[^)]*?)(?:\s+["']([^"']*)["'])?\)$/.exec(trimmed);
  if (!match) return null;
  const src = unformatMarkdownDestination(match[2]);
  if (!src.trim()) return null;
  return {
    alt: unescapeMarkdownLabel(match[1]),
    src,
    title: match[3] ?? '',
  };
}

function findMarkdownImageByIndex(markdown: string, imageIndex: number): MarkdownImageMatch | null {
  const pattern = /!\[((?:\\.|[^\]\\])*)\]\((<[^>\n]*>|[^)\n]*?)(?:\s+["'][^"'\n]*["'])?\)/g;
  let currentIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown))) {
    const source = match[0];
    if (!parseMarkdownImageSource(source)) {
      continue;
    }

    if (currentIndex === imageIndex) {
      return {
        start: match.index,
        end: match.index + source.length,
        markdown: source,
      };
    }

    currentIndex += 1;
  }

  return null;
}

function formatMarkdownImageSource(source: { alt: string; src: string; title: string }) {
  return `![${escapeMarkdownLabel(source.alt)}](${formatMarkdownDestination(source.src)}${source.title ? ` "${escapeMarkdownTitle(source.title)}"` : ''})`;
}

function inlineElementToMarkdown(element: HTMLElement) {
  const tag = element.tagName.toLowerCase();
  const content = serializeChildrenMarkdown(element);

  if (tag === 'strong' || tag === 'b') {
    return `**${content}**`;
  }

  if (tag === 'em' || tag === 'i') {
    return `*${content}*`;
  }

  if (tag === 'code') {
    return `\`${sanitizeEditableText(element.textContent ?? '').replace(/`/g, '\\`')}\``;
  }

  if (tag === 'img') {
    return imageElementToMarkdown(element);
  }

  if (tag === 'a') {
    const href = element.getAttribute('href') ?? '';
    return href ? `[${content || sanitizeEditableText(element.textContent ?? '')}](${href})` : content;
  }

  if (tag === 's' || tag === 'del') {
    return `~~${content}~~`;
  }

  return '';
}

function extractRenderedMarkdown(element: HTMLElement, type: MarkdownBlock['type']) {
  if (type === 'code') {
    return sanitizeEditableText(element.querySelector('pre code')?.textContent ?? element.innerText);
  }

  if (type === 'heading') {
    const heading = element.querySelector('h1,h2,h3,h4,h5,h6');
    return compactSingleLineMarkdown(heading ? serializeInlineMarkdown(heading) : serializeInlineMarkdown(element));
  }

  if (type === 'quote') {
    const quote = element.querySelector('blockquote');
    return quote ? serializeQuoteMarkdown(quote) : sanitizeEditableText(element.innerText);
  }

  if (type === 'list') {
    const items = Array.from(element.querySelectorAll('li')).map((item) => serializeInlineMarkdown(item).trimEnd());
    return items.length ? items.join('\n') : serializeFlowMarkdown(element);
  }

  if (type === 'table') {
    const rows = Array.from(element.querySelectorAll('tr')).map((row) =>
      Array.from(row.querySelectorAll('th,td'))
        .map((cell) => serializeInlineMarkdown(cell as HTMLElement).trim())
        .join('\t'),
    );
    return rows.join('\n');
  }

  return serializeFlowMarkdown(element);
}

function sanitizeEditableText(text: string) {
  return text.replace(/\u200B/g, '');
}

function serializeFlowMarkdown(element: Element) {
  const lines: string[] = [];
  let current = '';

  const appendText = (value: string) => {
    const parts = sanitizeEditableText(value).split('\n');
    current += parts[0] ?? '';
    for (const part of parts.slice(1)) {
      lines.push(current.trimEnd());
      current = part;
    }
  };

  const flushCurrent = () => {
    lines.push(current.trimEnd());
    current = '';
  };

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      appendText(child.textContent ?? '');
      continue;
    }

    if (!(child instanceof HTMLElement)) {
      continue;
    }

    if (child.tagName === 'BR') {
      flushCurrent();
      continue;
    }

    if (isFlowElement(child)) {
      if (current.trim().length) {
        flushCurrent();
      }
      lines.push(...serializeInlineMarkdown(child).split('\n').map((line) => line.trimEnd()));
      current = '';
      continue;
    }

    appendText(serializeInlineMarkdown(child));
  }

  if (current.length || lines.length === 0) {
    flushCurrent();
  }

  return trimBoundaryBlankLines(lines).join('\n');
}

function serializeQuoteMarkdown(quote: Element) {
  const lines: string[] = [];
  let hasFlowChild = false;

  const appendLines = (value: string) => {
    lines.push(...sanitizeEditableText(value).split('\n').map((line) => line.trimEnd()));
  };

  for (const child of Array.from(quote.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = sanitizeEditableText(child.textContent ?? '');
      if (text.trim().length) {
        appendLines(text);
      }
      continue;
    }

    if (!(child instanceof HTMLElement)) {
      continue;
    }

    if (child.tagName === 'BR') {
      lines.push('');
      continue;
    }

    if (isFlowElement(child)) {
      if (hasFlowChild) {
        lines.push('');
      }
      appendLines(serializeInlineMarkdown(child));
      hasFlowChild = true;
      continue;
    }

    appendLines(serializeInlineMarkdown(child));
  }

  return lines.join('\n');
}

function serializeInlineMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return sanitizeEditableText(node.textContent ?? '');
  }

  if (!(node instanceof HTMLElement)) {
    return '';
  }

  const tag = node.tagName.toLowerCase();

  if (node.classList.contains('inline-source')) {
    return sanitizeEditableText(node.textContent ?? '');
  }

  if (node.classList.contains('image-source-wrap')) {
    return serializeImageSourceWrapper(node);
  }

  if (tag === 'br') {
    return '\n';
  }

  if (tag === 'div' || tag === 'p') {
    return serializeChildrenMarkdown(node);
  }

  if (/^h[1-6]$/.test(tag)) {
    return serializeChildrenMarkdown(node);
  }

  if (tag === 'blockquote') {
    return serializeFlowMarkdown(node);
  }

  if (tag === 'strong' || tag === 'b') {
    return wrapInlineMarkdown('**', serializeChildrenMarkdown(node));
  }

  if (tag === 'em' || tag === 'i') {
    return wrapInlineMarkdown('*', serializeChildrenMarkdown(node));
  }

  if (tag === 'code') {
    return `\`${sanitizeEditableText(node.textContent ?? '').replace(/`/g, '\\`')}\``;
  }

  if (tag === 'img') {
    return imageElementToMarkdown(node);
  }

  if (tag === 'a') {
    const text = serializeChildrenMarkdown(node) || sanitizeEditableText(node.textContent ?? '');
    const href = node.getAttribute('href') ?? '';
    return href ? `[${text}](${href})` : text;
  }

  if (tag === 's' || tag === 'del') {
    return wrapInlineMarkdown('~~', serializeChildrenMarkdown(node));
  }

  return serializeChildrenMarkdown(node);
}

function serializeChildrenMarkdown(element: Element) {
  return Array.from(element.childNodes)
    .map((child) => serializeInlineMarkdown(child))
    .join('');
}

function wrapInlineMarkdown(marker: string, content: string) {
  const clean = content.trim();
  return clean ? `${marker}${clean}${marker}` : '';
}

function imageElementToMarkdown(element: HTMLElement) {
  const src = imageMarkdownSource(element);
  if (!src) return '';
  const alt = escapeMarkdownLabel(element.getAttribute('alt') ?? 'image');
  const title = element.getAttribute('title');
  return `![${alt}](${formatMarkdownDestination(src)}${title ? ` "${escapeMarkdownTitle(title)}"` : ''})`;
}

function serializeImageSourceWrapper(element: HTMLElement) {
  const textarea = element.querySelector<HTMLTextAreaElement>('.image-source-input');
  const image = element.querySelector<HTMLImageElement>('img');
  if (textarea) {
    const parsed =
      parseMarkdownImageSource(textarea.value) ??
      parseMarkdownImageSource(textarea.dataset.originalMarkdown ?? '') ??
      parseMarkdownImageSource(textarea.dataset.originalSource ?? '');
    if (parsed) {
      return formatMarkdownImageSource(parsed);
    }
    return image ? imageElementToMarkdown(image) : '';
  }

  return image ? imageElementToMarkdown(image) : '';
}

function imageMarkdownSource(element: HTMLElement) {
  return (element.dataset.mdSrc || element.getAttribute('data-md-src') || element.getAttribute('src') || '').trim();
}

function escapeMarkdownLabel(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

function escapeMarkdownTitle(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function formatMarkdownDestination(value: string) {
  if (!/[\s()<>]/.test(value)) return value;
  return `<${value.replace(/>/g, '%3E')}>`;
}

function unescapeMarkdownLabel(value: string) {
  return value.replace(/\\([\\[\]])/g, '$1');
}

function unformatMarkdownDestination(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith('<') && trimmed.endsWith('>') ? trimmed.slice(1, -1).replace(/%3E/gi, '>') : trimmed;
}

function renderableImageSource(src: string) {
  if (/^[a-zA-Z]:[\\/]/.test(src)) {
    return `minimal-md-image://local/${encodeURIComponent(src)}`;
  }

  return src;
}

function compactSingleLineMarkdown(markdown: string) {
  return markdown.replace(/\s*\n+\s*/g, ' ').trim();
}

function isFlowElement(element: Element) {
  return ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'].includes(element.tagName);
}

function trimBoundaryBlankLines(lines: string[]) {
  const trimmed = [...lines];
  while (trimmed.length > 1 && trimmed[0].trim().length === 0) {
    trimmed.shift();
  }
  while (trimmed.length > 1 && trimmed[trimmed.length - 1].trim().length === 0) {
    trimmed.pop();
  }
  return trimmed;
}

function shouldKeepMarkdownBlock(markdown: string) {
  return sanitizeEditableText(markdown).trim().length > 0 || markdown.includes(emptyParagraph);
}

function captureTableCell(block: MarkdownBlock, event: MouseEvent) {
  const cell = (event.target as HTMLElement | null)?.closest<HTMLTableCellElement>('th,td');
  if (!cell) return;
  const row = cell.parentElement as HTMLTableRowElement | null;
  const table = cell.closest('table');
  if (!row || !table) return;

  activeTableCell.blockId = block.id;
  activeTableCell.rowIndex = Array.from(table.rows).indexOf(row);
  activeTableCell.colIndex = Array.from(row.cells).indexOf(cell);
}

function setTableAlignment(block: MarkdownBlock, alignment: Exclude<TableAlignment, 'none'>) {
  const latestBlock = commitAndGetLatestBlock(block);
  const table = parseTableMarkdown(latestBlock.markdown);
  const colIndex = getSelectedTableColumn(latestBlock, table);
  table.alignments[colIndex] = alignment;
  applyBlockMarkdown(latestBlock.id, serializeTableMarkdown(table));
  pendingFocusIndex.value = latestBlock.index;
}

function insertTableRow(block: MarkdownBlock, position: 'above' | 'below') {
  const latestBlock = commitAndGetLatestBlock(block);
  const table = parseTableMarkdown(latestBlock.markdown);
  const columnCount = Math.max(...table.rows.map((row) => row.length), 1);
  const selectedRow = getSelectedTableRow(latestBlock, table);
  const targetIndex = position === 'above' ? selectedRow : selectedRow + 1;
  table.rows.splice(targetIndex, 0, Array.from({ length: columnCount }, () => ''));
  applyBlockMarkdown(latestBlock.id, serializeTableMarkdown(table));
  activeTableCell.blockId = latestBlock.id;
  activeTableCell.rowIndex = targetIndex;
  activeTableCell.colIndex = Math.min(activeTableCell.colIndex, columnCount - 1);
  pendingFocusIndex.value = latestBlock.index;
}

function deleteTableRow(block: MarkdownBlock) {
  const latestBlock = commitAndGetLatestBlock(block);
  const table = parseTableMarkdown(latestBlock.markdown);
  if (table.rows.length <= 2) return;
  const selectedRow = getSelectedTableRow(latestBlock, table);
  const deleteIndex = Math.max(1, selectedRow);
  table.rows.splice(deleteIndex, 1);
  applyBlockMarkdown(latestBlock.id, serializeTableMarkdown(table));
  activeTableCell.blockId = latestBlock.id;
  activeTableCell.rowIndex = Math.min(deleteIndex, table.rows.length - 1);
  activeTableCell.colIndex = Math.min(activeTableCell.colIndex, Math.max((table.rows[0]?.length ?? 1) - 1, 0));
  pendingFocusIndex.value = latestBlock.index;
}

function deleteBlock(block: MarkdownBlock) {
  const historyOptions = emptyBlockDeletionHistoryOptions(block);
  commitActiveDirtyBlock();
  selectedBlockId.value = '';
  if (editingDiagramId.value === block.id) {
    cancelDiagramEdit();
  }

  const nextBlocks = blocks.value
    .filter((item) => item.id !== block.id)
    .map((item) => item.markdown)
    .filter(shouldKeepMarkdownBlock);
  const nextIndex = Math.min(block.index, nextBlocks.length - 1);
  pendingFocusIndex.value = nextIndex >= 0 ? nextIndex : null;
  applyDocumentContent(nextBlocks.join('\n\n'), true, historyOptions);
}

function adjustTableColumnWidth(block: MarkdownBlock, delta: number) {
  const table = parseTableMarkdown(block.markdown);
  const colIndex = getSelectedTableColumn(block, table);
  const widths = (tableColumnWidths[block.id] ??= {});
  widths[colIndex] = clamp((widths[colIndex] ?? 120) + delta, 56, 360);
  applyTableDisplayStyles(block.id);
}

function adjustTableRowHeight(block: MarkdownBlock, delta: number) {
  const table = parseTableMarkdown(block.markdown);
  const rowIndex = getSelectedTableVisualRow(block, table);
  const heights = (tableRowHeights[block.id] ??= {});
  heights[rowIndex] = clamp((heights[rowIndex] ?? 38) + delta, 28, 180);
  applyTableDisplayStyles(block.id);
}

function getSelectedTableColumn(block: MarkdownBlock, table: ParsedTable) {
  if (activeTableCell.blockId !== block.id) {
    activeTableCell.blockId = block.id;
    activeTableCell.colIndex = 0;
  }

  return clamp(activeTableCell.colIndex, 0, Math.max((table.rows[0]?.length ?? 1) - 1, 0));
}

function getSelectedTableRow(block: MarkdownBlock, table: ParsedTable) {
  if (activeTableCell.blockId !== block.id) {
    activeTableCell.blockId = block.id;
    activeTableCell.rowIndex = 1;
  }

  const maxRow = Math.max(table.rows.length - 1, 1);
  return clamp(activeTableCell.rowIndex || 1, 1, maxRow);
}

function getSelectedTableVisualRow(block: MarkdownBlock, table: ParsedTable) {
  if (activeTableCell.blockId !== block.id) {
    activeTableCell.blockId = block.id;
    activeTableCell.rowIndex = 0;
  }

  return clamp(activeTableCell.rowIndex, 0, Math.max(table.rows.length - 1, 0));
}

function parseTableMarkdown(markdown: string): ParsedTable {
  const lines = markdown
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0);
  const rowLines = lines.filter((_, index) => index !== 1);
  const rows = rowLines.map(parseTableRow);
  const columnCount = Math.max(...rows.map((row) => row.length), 1);
  const normalizedRows = rows.map((row) => normalizeColumns(row, columnCount));
  const alignments = parseTableAlignmentLine(lines[1] ?? '', columnCount);
  return {
    rows: normalizedRows.length ? normalizedRows : [Array.from({ length: columnCount }, () => '')],
    alignments,
  };
}

function serializeTableMarkdown(table: ParsedTable) {
  const columnCount = Math.max(...table.rows.map((row) => row.length), table.alignments.length, 1);
  const rows = table.rows.map((row) => normalizeColumns(row, columnCount));
  const alignments = normalizeColumns(table.alignments, columnCount) as TableAlignment[];
  const header = rows[0] ?? Array.from({ length: columnCount }, () => '');
  const body = rows.slice(1);
  return [
    `| ${header.join(' | ')} |`,
    `| ${alignments.map(formatTableAlignment).join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function parseTableAlignmentLine(line: string, columnCount: number): TableAlignment[] {
  const cells = parseTableRow(line);
  return Array.from({ length: columnCount }, (_, index) => {
    const cell = cells[index] ?? '';
    const starts = cell.trim().startsWith(':');
    const ends = cell.trim().endsWith(':');
    if (starts && ends) return 'center';
    if (ends) return 'right';
    if (starts) return 'left';
    return 'none';
  });
}

function formatTableAlignment(alignment: TableAlignment) {
  if (alignment === 'center') return ':---:';
  if (alignment === 'right') return '---:';
  if (alignment === 'left') return ':---';
  return '---';
}

function applyAllTableDisplayStyles() {
  blocks.value
    .filter((block) => block.type === 'table')
    .forEach((block) => {
      applyTableDisplayStyles(block.id);
    });
}

function applyTableDisplayStyles(blockId: string) {
  const table = rootRef.value?.querySelector<HTMLTableElement>(`[data-block-id="${blockId}"] table`);
  if (!table) return;

  const widths = tableColumnWidths[blockId] ?? {};
  const heights = tableRowHeights[blockId] ?? {};
  Array.from(table.rows).forEach((row, rowIndex) => {
    const height = heights[rowIndex];
    if (height) {
      row.style.height = `${height}px`;
    }

    Array.from(row.cells).forEach((cell, colIndex) => {
      const width = widths[colIndex];
      if (width) {
        (cell as HTMLElement).style.width = `${width}px`;
        (cell as HTMLElement).style.minWidth = `${width}px`;
      }
    });
  });
}

function normalizeColumns<T>(row: T[], count: number, fallback = '' as T) {
  return Array.from({ length: count }, (_, index) => row[index] ?? fallback);
}

function commitAndGetLatestBlock(block: MarkdownBlock) {
  if (dirtyBlocks[block.id]) {
    commitEditableBlock(block);
  }

  return blocks.value.find((item) => item.id === block.id) ?? block;
}

function getEditableElement(blockId: string) {
  return rootRef.value?.querySelector<HTMLElement>(`[data-block-id="${blockId}"] .render-block`) ?? null;
}

function isEditableBlockEmpty(block: MarkdownBlock) {
  const element = getEditableElement(block.id);
  return sanitizeEditableText(element?.innerText ?? '').trim().length === 0;
}

function scheduleDiagramRender() {
  diagramRenderRequest += 1;
  if (diagramRenderTimer) {
    window.clearTimeout(diagramRenderTimer);
  }

  const request = diagramRenderRequest;
  diagramRenderTimer = window.setTimeout(() => {
    void renderDiagrams(request);
  }, 120);
}

async function renderDiagrams(request = ++diagramRenderRequest) {
  const diagramBlocks = blocks.value.filter((block) => block.type === 'diagram');
  if (!diagramBlocks.length) {
    if (request === diagramRenderRequest) {
      diagramSvg.value = {};
    }
    return;
  }

  const mermaid = (await import('mermaid')).default;
  if (request !== diagramRenderRequest) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: store.theme === 'dark' ? 'dark' : 'neutral',
  });

  const nextSvg: Record<string, string> = {};
  for (const block of diagramBlocks) {
    if (request !== diagramRenderRequest) return;
    const source = extractEditableText(block.markdown, block.type);
    ensureDiagramView(block.id);
    try {
      const result = await mermaid.render(`mermaid-${block.id}-${Date.now()}`, source);
      if (request !== diagramRenderRequest) return;
      nextSvg[block.id] = result.svg;
    } catch {
      nextSvg[block.id] = '<pre class="diagram-error">图表语法无法渲染</pre>';
    }
  }
  if (request === diagramRenderRequest) {
    diagramSvg.value = nextSvg;
  }
}

function ensureDiagramView(id: string) {
  if (!diagramViews[id]) {
    diagramViews[id] = { scale: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 };
  }
  return diagramViews[id];
}

function diagramTransform(id: string) {
  const view = ensureDiagramView(id);
  return {
    transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
  };
}

function zoomDiagram(id: string, delta: number) {
  const view = ensureDiagramView(id);
  view.scale = clamp(view.scale + delta, 0.35, 3);
}

function resetDiagramView(id: string) {
  const view = ensureDiagramView(id);
  view.scale = 1;
  view.x = 0;
  view.y = 0;
}

function startDiagramDrag(id: string, event: PointerEvent) {
  if (event.button !== 0) return;
  const view = ensureDiagramView(id);
  view.dragging = true;
  view.startX = event.clientX;
  view.startY = event.clientY;
  view.originX = view.x;
  view.originY = view.y;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function dragDiagram(id: string, event: PointerEvent) {
  const view = ensureDiagramView(id);
  if (!view.dragging) return;
  view.x = view.originX + event.clientX - view.startX;
  view.y = view.originY + event.clientY - view.startY;
}

function stopDiagramDrag(id: string, event: PointerEvent) {
  const view = ensureDiagramView(id);
  view.dragging = false;
  try {
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture may already be released by the browser.
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function handleDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node | null;
  commitActiveInlineSourceIfOutside(target);
  commitActiveImageSourceIfOutside(target);
  if (commandMenu.open && target && !rootRef.value?.querySelector('.command-menu')?.contains(target)) {
    closeCommandMenu();
  }

  if (selectedBlockId.value) {
    const targetElement = event.target instanceof Element ? event.target : null;
    const article = targetElement?.closest<HTMLElement>('.render-block-group');
    if (!article || article.dataset.blockId !== selectedBlockId.value) {
      selectedBlockId.value = '';
    }
  }
}

function handleBlockPointerDown(block: MarkdownBlock, event: PointerEvent) {
  if (event.button !== 2 || (!event.ctrlKey && !event.metaKey)) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('.block-action, .diagram-toolbar, .diagram-source-popover, .table-toolbar, textarea, button')) return;
  event.preventDefault();
  event.stopPropagation();
  suppressNextContextMenu = true;
  selectedBlockId.value = block.id;
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (store.matchesManualSaveShortcut(event)) {
    event.preventDefault();
    commitActiveDirtyBlock();
    void store.manualSaveCurrentFile();
    return;
  }

  if (isUndoShortcut(event)) {
    if (!isEditorEventTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    const focusedBlockId = getEventBlockId(event.target) || activeBlockId.value || editingDiagramId.value || lastFocusedBlockId;
    if (restoringHistory.value) {
      queueHistoryStep('undo', focusedBlockId);
      return;
    }
    snapshotCurrentDraft(focusedBlockId);
    if (undoContent()) {
      restoreFocusAfterHistory(focusedBlockId);
    }
    return;
  }

  if (isRedoShortcut(event)) {
    if (!isEditorEventTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    const focusedBlockId = getEventBlockId(event.target) || activeBlockId.value || editingDiagramId.value || lastFocusedBlockId;
    if (restoringHistory.value) {
      queueHistoryStep('redo', focusedBlockId);
      return;
    }
    snapshotCurrentDraft(focusedBlockId);
    if (redoContent()) {
      restoreFocusAfterHistory(focusedBlockId);
    }
    return;
  }

  if (event.key === 'Escape') {
    closeCommandMenu();
    selectedBlockId.value = '';
  }
}

function handleWindowBlur() {
  selectedBlockId.value = '';
  suppressNextContextMenu = false;
  commitActiveInlineSourceIfOutside(null);
  commitActiveImageSourceIfOutside(null);
}

function commitActiveDirtyBlock() {
  commitActiveImageSourceIfOutside(null);
  const block = blocks.value.find((item) => item.id === activeBlockId.value);
  if (block && dirtyBlocks[block.id]) {
    commitEditableBlock(block);
  }
}

function snapshotCurrentDraft(preferredBlockId = '') {
  if (restoringHistory.value) return;
  const draftContent = getCurrentDraftContent(preferredBlockId);
  pushHistoryState(draftContent);
  store.saveDraftSnapshot(draftContent);
}

function restoreFocusAfterHistory(focusedBlockId: string) {
  void nextTick(() => {
    const latestBlock = findRestoredFocusBlock(focusedBlockId);
    if (!latestBlock) return;
    rememberFocusedBlock(latestBlock);
    if (latestBlock.type === 'diagram') {
      beginDiagramEdit(latestBlock);
      return;
    }
    focusEditableEnd(getEditableElement(latestBlock.id));
  });
}

function findRestoredFocusBlock(focusedBlockId: string) {
  const exact = focusedBlockId ? blocks.value.find((item) => item.id === focusedBlockId) : null;
  if (exact) return exact;

  const byLastId = lastFocusedBlockId ? blocks.value.find((item) => item.id === lastFocusedBlockId) : null;
  if (byLastId) return byLastId;

  if (!blocks.value.length) return null;
  return blocks.value[clamp(lastFocusedBlockIndex, 0, blocks.value.length - 1)] ?? blocks.value.at(-1) ?? null;
}

function queueHistoryStep(direction: 'undo' | 'redo', focusedBlockId: string) {
  queuedHistorySteps.push({ direction, focusedBlockId });
}

function flushQueuedHistoryStep() {
  if (restoringHistory.value) return;

  while (queuedHistorySteps.length) {
    const step = queuedHistorySteps.shift();
    if (!step) return;

    const changed = step.direction === 'undo' ? undoContent() : redoContent();
    if (changed) {
      restoreFocusAfterHistory(step.focusedBlockId);
      return;
    }
  }
}

function isUndoShortcut(event: KeyboardEvent) {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey;
}

function isRedoShortcut(event: KeyboardEvent) {
  return (event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'));
}

function isEditorEventTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(rootRef.value?.contains(target));
}

function getFocusedEditableBlockId() {
  const activeElement = document.activeElement instanceof Element ? document.activeElement : null;
  return activeElement?.closest<HTMLElement>('.render-block-group')?.dataset.blockId ?? '';
}

function getEventBlockId(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLElement>('.render-block-group')?.dataset.blockId ?? '' : '';
}

function handleJump(event: Event) {
  const line = (event as CustomEvent<{ line: number }>).detail?.line;
  if (!line) return;

  const target = blocks.value.find((block) => line >= block.startLine && line <= block.endLine) ?? blocks.value.find((block) => block.startLine >= line);
  if (!target) return;

  const element = rootRef.value?.querySelector<HTMLElement>(`[data-line="${target.startLine}"]`);
  element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (target.type === 'diagram') {
    beginDiagramEdit(target);
  } else {
    focusEditableEnd(element?.querySelector<HTMLElement>('.render-block'));
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown, true);
  document.addEventListener('keydown', handleDocumentKeydown, true);
  window.addEventListener('blur', handleWindowBlur);
  window.addEventListener('minimal-md:jump-line', handleJump);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
  document.removeEventListener('keydown', handleDocumentKeydown, true);
  window.removeEventListener('blur', handleWindowBlur);
  window.removeEventListener('minimal-md:jump-line', handleJump);
});
</script>
