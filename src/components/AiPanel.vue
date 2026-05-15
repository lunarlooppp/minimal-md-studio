<template>
  <aside class="ai-panel" :aria-hidden="!store.aiOpen">
    <header>
      <div>
        <span>AI 问答</span>
        <small>基于当前文档上下文</small>
      </div>
      <button class="icon-button" type="button" aria-label="关闭 AI 问答" @click="store.aiOpen = false">
        <X :size="18" />
      </button>
    </header>

    <div class="ai-thread">
      <div class="ai-message assistant">
        <Sparkles :size="16" />
        <p>这里预留接入大模型的位置。可以选中文本后提问，也可以让它总结当前文档。</p>
      </div>
      <button class="prompt-chip" type="button" @click="draft = '请总结当前 Markdown 文档的核心内容。'">总结全文</button>
      <button class="prompt-chip" type="button" @click="draft = '请帮我优化当前段落，使表达更简洁。'">优化表达</button>
      <button class="prompt-chip" type="button" @click="draft = '请根据当前标题生成文档大纲。'">生成大纲</button>
    </div>

    <form class="ai-input" @submit.prevent="submitQuestion">
      <textarea v-model="draft" rows="4" placeholder="向 AI 提问..." />
      <button type="submit">
        <Send :size="16" />
        <span>发送</span>
      </button>
    </form>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Send, Sparkles, X } from 'lucide-vue-next';
import { useDocumentStore } from '../stores/document';

const store = useDocumentStore();
const draft = ref('');

function submitQuestion() {
  if (!draft.value.trim()) return;
  store.statusText = 'AI 接口待配置';
  draft.value = '';
}
</script>
