<template>
  <div
    class="app-shell"
    :data-theme="store.theme"
    :class="{ 'is-sidebar-open': store.sidebarOpen, 'is-ai-open': store.aiOpen, 'is-settings-open': store.settingsOpen }"
    :style="{ '--sidebar-width': `${store.sidebarWidth}px` }"
  >
    <TopBar @import-file="handleImportClick" />

    <input ref="fileInput" class="sr-only" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" @change="handleFilePicked" />

    <main class="workspace">
      <Sidebar />
      <section class="editor-stage" aria-label="Markdown 编辑区">
        <MinimalMarkdownEditor />
      </section>
      <button class="ai-float" type="button" :aria-pressed="store.aiOpen" aria-label="打开 AI 问答" @click="toggleAiPanel">
        <Sparkles :size="20" />
      </button>
      <AiPanel />
      <SettingsPanel />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Sparkles } from 'lucide-vue-next';
import AiPanel from './components/AiPanel.vue';
import MinimalMarkdownEditor from './components/MinimalMarkdownEditor.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import Sidebar from './components/Sidebar.vue';
import TopBar from './components/TopBar.vue';
import { useDocumentStore } from './stores/document';

const store = useDocumentStore();
const fileInput = ref<HTMLInputElement | null>(null);

function toggleAiPanel() {
  store.aiOpen = !store.aiOpen;
  if (store.aiOpen) {
    store.settingsOpen = false;
  }
}

function handleImportClick() {
  if (store.isDesktop) {
    void store.importMarkdown();
    return;
  }
  fileInput.value?.click();
}

function handleFilePicked(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    void store.importMarkdown(file);
  }
  input.value = '';
}
</script>
