# 竞品调研（2026-10）

## 1. 竞品分类

| 类别 | 代表产品 | 面向 | 核心做法 |
| --- | --- | --- | --- |
| A. 浏览器插件型提示词库 | My Prompt Manager、Right Click Prompt、PromptDrive、Promptly、AIPRM、Superpower ChatGPT、Prompt Genie | 个人重度用户 | 在 AI 网站输入框里直接唤起并插入提示词 |
| B. 启动器 / 文本扩展 | Raycast（AI Commands、Snippets）、Alfred、TextExpander、Espanso | 效率用户 | 快捷键 / 关键词触发，**动态占位符**（剪贴板、选中文本、日期、引用其他片段） |
| C. 开发者 LLMOps 平台 | Langfuse、PromptLayer、Braintrust、LangSmith、Vellum、Agenta | AI 应用团队 | 版本 + **标签（production 等）**、Playground、调用日志、评测 |
| D. 通用笔记 / 表格 | Notion、飞书文档、Google Sheets | 所有人 | 零门槛，但无变量、无版本、复用靠手动复制 |

## 2. 各类产品可借鉴的经验

### A. 浏览器插件型
- **插入速度是第一需求**：一个快捷键或 `/` 命令把提示词放进当前输入框最重要，需要点开侧边栏的方式就多了摩擦。
- **变量必须真的会弹出来填写**：如果 `{{name}}` 原样被粘贴出去，这个功能就等于没有。
- **本地优先、不强制注册**：先要求注册才能保存，对很多用户是劝退项。
- **跨平台**：AIPRM、Superpower ChatGPT、Prompt Genie 都只支持 ChatGPT，是常见吐槽点。
- **教训**：AI 网站改版频繁，插件容易失效，需要持续维护；插件太重会拖慢输入框；免费版插广告、推荐“赞助提示词”伤害体验；权限要最小化。

### B. Raycast 等启动器
- 动态占位符：`{selection}`、`{clipboard}`、`{date}`、`{argument name="语言"}`，以及 `{snippet}` 引用其他片段。
- 修饰符：如 `{clipboard | trim | uppercase}`。
- 支持 JSON 导入导出。
- 不足：它们无法在网页输入框里暂停下来让用户填写变量。

### C. Langfuse / PromptLayer
- 每个版本自动编号，并可以打**标签**（如 production）。默认使用带标签的版本，回滚只需把标签移回旧版本。
- Playground 直接基于已保存的提示词运行，改完可以存成新版本。
- 调用记录和提示词版本关联，可以知道“哪个版本效果更好”。
- 对个人用户来说太重：要接 SDK，概念多。

### D. 用户共性痛点（社区与评测文章）
- 反复重写同样的提示词，好用的提示词收藏后就再也找不到。
- 手动归档是“第二份工作”，大家坚持不下去；靠文件夹和标签要求用户记得自己当初怎么分的类。
- 上手门槛高的工具会被很快放弃（有用户试用 10 分钟搞不定就放弃了）。
- 行业变化快：Humanloop 已关闭，PromptHub 在收缩，说明纯“团队提示词 CMS”赛道竞争激烈。

## 3. 对 Promptory 的结论

1. **“用”的入口要放在 AI 网站里**：插件内 `/` 唤起 + 就地填写变量 + 插入输入框，升为 P0。
2. **“存”要零整理成本**：右键一键收藏、自动起标题、自动识别可变内容、先进收件箱后整理。
3. **加内置动态变量**：剪贴板、网页选中文本、今天日期、引用片段。
4. **借鉴“标签”做“推荐版本”**：插件默认使用推荐版本；可以先改新版，验证后再设为推荐。
5. **轻量效果反馈**：使用后一键“好用 / 不好用”，按版本统计，替代个人用户用不上的完整评测体系。
6. **坚持本地优先、无广告、跨平台、最小权限**，并支持从 AIPRM / CSV / Markdown / Raycast JSON 导入，降低迁移成本。
7. **不做的事**：MVP 不做团队 CMS、调用日志和评测平台（C 类产品的领域）。

## 参考来源
- https://nexasphere.io/blog/best-ai-prompt-manager-chrome-extension-2026
- https://aiindigo.com/blog/right-click-prompt-review-simplifying-your-ai-workflow-in-2026
- https://chromeboard.com/extension/my-prompt-manager-pkolfmhpehacbkphmhnbbfmfoehaikan
- https://manual.raycast.com/ai/ai-commands
- https://ithelp.ithome.com.tw/articles/10396048
- https://langfuse.com/docs/prompt-management/features/prompt-version-control
- https://www.developersdigest.tech/blog/prompt-management-tools-compared
- https://blog.promptlayer.com/the-7-best-prompt-management-tools-in-2026-tested-and-compared/
- https://contextbolt.com/blog/ai-prompt-library/
- https://ergonis.com/blog/prompt-management-guide
