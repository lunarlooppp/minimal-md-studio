import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import 'highlight.js/styles/github-dark-dimmed.css';
import './styles/theme.css';
import './styles/editor.css';

createApp(App).use(createPinia()).mount('#app');
