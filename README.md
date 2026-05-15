# Minimal Markdown Studio

基于 Electron + Vite + Vue 3 的极简 Markdown 编辑器。编辑器核心已经替换为独立 Markdown 渲染管线，不再依赖 `md-editor-v3`。

## 功能

- 桌面端：Electron 窗口、系统文件导入、Markdown/HTML/PDF 导出。
- 手机 App 端：通过 Capacitor 复用同一套 Vue 页面，可生成 Android/iOS 工程。
- 主题：白天、黑夜、写作三种模式。
- 侧栏：左上角按钮控制显示，支持文件视图和当前文档标题视图。
- AI 栏：编辑区右侧悬浮按钮呼出，当前预留问答接口位置。
- 独立渲染：使用 `markdown-it` 渲染 Markdown，`highlight.js` 做代码高亮，`mermaid` 按需渲染图表。
- 原位编辑：标题、段落、引用、列表、表格和代码块都在渲染后的元素内直接编辑，保存时保持原 Markdown 结构；Mermaid 等图表块保持只读渲染。

## 开发

```bash
npm install
npm run dev
```

桌面开发：

```bash
npm run dev:electron
```

如果在 PowerShell 里遇到 `npm.ps1` 执行策略限制，可以改用：

```bash
npm.cmd run dev
npm.cmd run dev:electron
```

## 构建

```bash
npm run build
```

打包桌面安装包：

```bash
npm run dist
```

## 移动端

首次生成 Android 或 iOS 工程：

```bash
npm run mobile:add:android
npm run mobile:add:ios
```

同步 Web 构建产物到移动工程：

```bash
npm run mobile:sync
```

打开原生工程：

```bash
npm run mobile:open:android
npm run mobile:open:ios
```

iOS 需要在 macOS + Xcode 环境下执行。
