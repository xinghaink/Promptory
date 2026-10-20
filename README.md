# Promptory

本地优先、跨 AI 平台的个人提示词库（Chrome / Edge 浏览器插件）。

- **就地使用**：在 ChatGPT、Claude、Gemini、DeepSeek、豆包、Kimi 的输入框里输入 `/` 或 `/快捷词`，填写变量后回车插入；`⌘/Ctrl+↵` 插入并发送。也可以按 `Alt+P` 唤起。
- **随手收藏**：在任意网页选中文字，右键「保存到 Promptory」（或按 `Alt+Shift+S`）。会自动生成标题、建议标签，并把「」[] 等引号里的内容识别为变量；保存后先进收件箱。
- **变量模板**：`{{变量}}` 由你填写（单行 / 多行 / 下拉）；`{{@剪贴板}}` `{{@选中文本}}` `{{@今天}}` `{{@现在}}` 自动填充；可以记住上次填写的值。
- **版本管理**：每次保存生成一个版本，可对比差异、恢复。「★ 推荐版本」是使用时默认的版本：默认跟随最新版本；设为旧版本后就固定在该版本。
- **效果反馈**：每次使用后一键「好用 / 不好用」，按版本统计。
- **管理页**：文件夹、标签、收藏、最近使用、收件箱、回收站（30 天），`⌘K` 全局搜索，在页面上 `⌘V` 粘贴即可新建。
- **导入 / 导出**：Promptory JSON 备份（含全部版本）、Raycast AI Commands JSON、AIPRM 等工具的 CSV、Markdown。

所有数据存在浏览器本地（IndexedDB），不需要账号。

## 开发

```bash
npm install
npm run dev        # 启动开发模式，自动打开加载了插件的浏览器
npm run build      # 构建到 .output/chrome-mv3
npm run zip        # 打包用于发布
npm run compile    # TypeScript 类型检查
npm test           # 单元测试（Vitest）
npm run e2e        # 端到端冒烟测试：先 npm run build，需要本机有 Chromium（可用 CHROME_PATH 指定）
```

手动安装：`npm run build` 后，在 `chrome://extensions` 打开「开发者模式」，选择「加载已解压的扩展程序」，指向 `.output/chrome-mv3`。

## 结构

```
src/
  entrypoints/
    background.ts        后台：数据读写、右键菜单、快捷键、打开管理页
    ai.content/          AI 网站内的 / 面板（Shadow DOM 隔离样式）
    app/                 管理页（提示词库、编辑、版本历史、使用、⌘K、导入导出）
    capture/             右键收藏弹出的保存窗口
  components/            管理页和收藏窗口共用的组件
  lib/                   数据模型、变量模板、搜索、差异对比、导入导出、收藏规则
e2e/smoke.mjs            加载构建产物，用本地替身页面模拟 AI 网站的端到端测试
docs/                    需求文档、竞品调研、原型源文件
```

技术栈：WXT + React + TypeScript + Dexie（IndexedDB）。

## 文档

- [产品需求文档](docs/PRD.md)
- [竞品调研](docs/RESEARCH.md)
- [原型图](https://claude.ai/artifact/94JD8JyBfxRBbKeQL8tH5m)
