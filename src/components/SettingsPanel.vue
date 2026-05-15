<template>
  <aside class="settings-panel" :aria-hidden="!store.settingsOpen">
    <header>
      <div>
        <span>设置</span>
        <small>编辑器偏好</small>
      </div>
      <button class="icon-button" type="button" aria-label="关闭设置" @click="store.settingsOpen = false">
        <X :size="18" />
      </button>
    </header>

    <div class="settings-body">
      <nav class="settings-categories" aria-label="设置类别">
        <button type="button" class="active">
          <Save :size="15" />
          <span>保存</span>
        </button>
      </nav>

      <section class="settings-detail" aria-label="保存设置">
        <div class="settings-section-title">保存</div>

        <label class="setting-row">
          <span>
            <strong>自动保存</strong>
            <small>开启后编辑内容会自动写入当前文件。</small>
          </span>
          <input class="switch-input" type="checkbox" :checked="store.autoSaveEnabled" @change="toggleAutoSave" />
        </label>

        <label class="setting-field" :class="{ disabled: store.autoSaveEnabled }">
          <span>
            <strong>手动保存快捷键</strong>
            <small>关闭自动保存后使用该快捷键保存当前文件。</small>
          </span>
          <input
            :value="shortcutDraft"
            type="text"
            readonly
            :disabled="store.autoSaveEnabled"
            placeholder="Ctrl+S"
            @keydown.prevent="captureShortcut"
            @focus="shortcutFocused = true"
            @blur="shortcutFocused = false"
          />
        </label>
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Save, X } from 'lucide-vue-next';
import { useDocumentStore } from '../stores/document';

const store = useDocumentStore();
const shortcutDraft = ref(store.manualSaveShortcut);
const shortcutFocused = ref(false);

watch(
  () => store.manualSaveShortcut,
  (value) => {
    shortcutDraft.value = value;
  },
);

function toggleAutoSave(event: Event) {
  store.setAutoSaveEnabled((event.target as HTMLInputElement).checked);
}

function captureShortcut(event: KeyboardEvent) {
  const shortcut = store.shortcutFromEvent(event);
  if (!shortcut) return;
  shortcutDraft.value = shortcut;
  store.setManualSaveShortcut(shortcut);
}
</script>
