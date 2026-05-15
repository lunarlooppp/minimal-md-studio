<template>
  <aside class="sidebar" :aria-hidden="!store.sidebarOpen">
    <div class="sidebar-tabs">
      <button type="button" :class="{ active: store.sidebarMode === 'files' }" @click="store.setSidebarMode('files')">
        <FolderTree :size="17" />
        <span>文件</span>
      </button>
      <button type="button" :class="{ active: store.sidebarMode === 'outline' }" @click="store.setSidebarMode('outline')">
        <ListTree :size="17" />
        <span>标题</span>
      </button>
    </div>

    <div v-if="store.sidebarMode === 'files'" class="sidebar-content">
      <div class="section-title">当前文档</div>
      <button class="file-row current" type="button" :title="store.fileName" @click="store.revealCurrentFile">
        <FileText :size="16" />
        <span>{{ store.fileName }}</span>
      </button>

      <div class="section-title">最近</div>
      <div v-if="store.recentFiles.length" class="file-list">
        <button
          v-for="item in store.recentFiles"
          :key="`${item.name}-${item.path ?? item.updatedAt}`"
          class="file-row"
          :class="{ current: isCurrentFile(item) }"
          type="button"
          :title="item.path || item.name"
          @click="store.openRecentFile(item)"
        >
          <File :size="15" />
          <span>{{ item.name }}</span>
        </button>
      </div>
      <p v-else class="empty-note">导入或导出后会显示最近文档。</p>
    </div>

    <div v-else class="sidebar-content outline-list">
      <div class="section-title">当前文件标题</div>
      <button
        v-for="heading in store.headings"
        :key="heading.id"
        class="outline-row"
        :data-title="heading.text"
        :style="{ paddingLeft: `${(heading.level - 1) * 12 + 2}px` }"
        type="button"
        @click="jumpToLine(heading.line)"
      >
        <span>{{ heading.text }}</span>
      </button>
      <p v-if="!store.headings.length" class="empty-note">还没有标题。</p>
    </div>
    <div class="sidebar-resizer" role="separator" aria-orientation="vertical" title="调整侧边栏宽度" @pointerdown="startResize"></div>
  </aside>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { File, FileText, FolderTree, ListTree } from 'lucide-vue-next';
import { useDocumentStore } from '../stores/document';

const store = useDocumentStore();
const resizing = ref(false);

function isCurrentFile(item: { name: string; path?: string }) {
  if (item.path && store.filePath) {
    return item.path === store.filePath;
  }

  return !item.path && !store.filePath && item.name === store.fileName;
}

function startResize(event: PointerEvent) {
  resizing.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  window.addEventListener('pointermove', resizeSidebar);
  window.addEventListener('pointerup', stopResize, { once: true });
}

function resizeSidebar(event: PointerEvent) {
  if (!resizing.value) return;
  store.setSidebarWidth(event.clientX);
}

function stopResize() {
  resizing.value = false;
  window.removeEventListener('pointermove', resizeSidebar);
}

function jumpToLine(line: number) {
  window.dispatchEvent(new CustomEvent('minimal-md:jump-line', { detail: { line } }));
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', resizeSidebar);
});
</script>
