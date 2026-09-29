## 机器可读索引

[打开 /llms.txt](/llms.txt) 可获取可直接读取的 Markdown 文档清单，包含入门、设计规范和已成文组件页；无需执行 JavaScript。

llms.txt 是文档发现入口，不包含组件源码或实时 props 表。使用组件前查看[组件用法页](/design-system/specimens)；开发库本身时再核对 `web/packages/ui/src/index.ts` 的真实导出。

## 在编码智能体中使用

把 `https://xunrua.top/llms.txt` 加入智能体的上下文或规则配置，会话中即可按这份清单查阅指南与组件页。

**Claude Code** — 写入项目根的 `CLAUDE.md`：

```markdown
组件库文档索引：https://xunrua.top/llms.txt
使用 @violet/ui 组件前，先按此清单查阅对应的指南与组件用法页。
```

**Cursor** — 新建 `.cursor/rules/violet-ui.mdc`：

```markdown
---
description: violet 组件库文档索引
alwaysApply: false
---
使用 @violet/ui 前先查阅 https://xunrua.top/llms.txt 列出的指南与组件页。
```

**Windsurf** — 新建 `.windsurf/rules/violet-ui.md`：

```markdown
使用 @violet/ui 前先查阅 https://xunrua.top/llms.txt 列出的指南与组件页。
```

清单内容随文档更新，无需本地拷贝；智能体每次会话重新拉取即可。
