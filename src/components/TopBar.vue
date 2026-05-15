<template>
  <header class="top-bar">
    <div class="left-tools">
      <button class="icon-button" type="button" aria-label="切换侧边栏" @click="store.sidebarOpen = !store.sidebarOpen">
        <PanelLeft :size="19" />
      </button>
      <button class="text-button" type="button" @click="store.newDocument">
        <FilePlus2 :size="17" />
        <span>新建</span>
      </button>
      <button class="text-button" type="button" @click="$emit('import-file')">
        <FolderOpen :size="17" />
        <span>导入</span>
      </button>
    </div>

    <div class="document-title" :title="store.filePath || store.fileName">
      <span>{{ store.fileName }}</span>
      <small>{{ store.statusText }}</small>
    </div>

    <div class="right-tools">
      <div class="segmented" aria-label="主题切换">
        <button type="button" :class="{ active: store.theme === 'light' }" @click="store.setTheme('light')">白天</button>
        <button type="button" :class="{ active: store.theme === 'dark' }" @click="store.setTheme('dark')">黑夜</button>
        <button type="button" :class="{ active: store.theme === 'writing' }" @click="store.setTheme('writing')">写作</button>
      </div>
      <div class="export-menu">
        <button class="text-button" type="button" @click="store.exportMarkdown">
          <Download :size="17" />
          <span>MD</span>
        </button>
        <button class="text-button" type="button" @click="store.exportHtml">
          <Code2 :size="17" />
          <span>HTML</span>
        </button>
        <button class="text-button" type="button" @click="store.exportPdf">
          <FileText :size="17" />
          <span>PDF</span>
        </button>
      </div>
      <button class="icon-button" type="button" aria-label="打开设置" :aria-pressed="store.settingsOpen" @click="toggleSettings">
        <Settings :size="18" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Code2, Download, FilePlus2, FileText, FolderOpen, PanelLeft, Settings } from 'lucide-vue-next';
import { useDocumentStore } from '../stores/document';

defineEmits<{ (event: 'import-file'): void }>();

const store = useDocumentStore();

function toggleSettings() {
  store.settingsOpen = !store.settingsOpen;
  if (store.settingsOpen) {
    store.aiOpen = false;
  }
}
</script>
