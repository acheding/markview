---
name: verify
description: 在真实浏览器中端到端验证 MarkView 的改动（启动 dev server + Playwright 驱动页面并截图）
---

# MarkView 端到端验证配方

纯前端 Vue 应用，验证表面是浏览器 GUI。

## 启动

```bash
pnpm dev   # 后台运行，端口固定 3001，curl http://localhost:3001/ 返回 200 即就绪
```

## 浏览器驱动

本机无 playwright 包，但有 Playwright 浏览器缓存（`%LOCALAPPDATA%/ms-playwright/chromium-*/chrome-win64/chrome.exe`）。
在 scratchpad 目录 `npm i playwright-core`（不下载浏览器），launch 时传 `executablePath` 指向缓存的 chrome.exe，headless 截图即可。

## 驱动要点

- 编辑器就绪标志：`.cm-content` 出现；点击它获得焦点后再发键盘事件。
- 预置文档是 README 全文；CodeMirror 只装饰可视区域，统计 `.cm-searchMatch` 等 Decoration 数量时命中可能在视口外——先在文档开头 `Ctrl+Home` 后 `keyboard.type()` 插入已知文本再断言。
- 常用快捷键：`Ctrl+P` 命令面板、`Ctrl+K` 全局搜索、`Ctrl+F` 查找替换、`Ctrl+\` 折叠编辑区（折叠是根节点加 `.is-editor-collapsed` 类，编辑器不卸载）、`Ctrl+Alt+L` 切主题。
- 文档持久化在 IndexedDB，验证脚本改动内容后要用 `Ctrl+Z` 撤销干净再 `Ctrl+S`，避免污染下次会话。
- 断言 UI 文案用 `document.body.innerText`；截图目检面板/主题样式。
