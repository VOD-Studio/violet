## 随仓库分发的技能

项目内 `.agents/skills/` 下的技能随仓库提供，无需外部安装脚本。与组件库直接相关的三个：

| 技能 | 作用 |
| --- | --- |
| `violet-ui` | 核对包导出、样式导入、示例同源和浏览器核对顺序 |
| `frontend-conventions` | 前端文件落位与注释规范 |
| `tailwind-canonical-classes` | Tailwind v4 类名的规范形态 |

目录下还有 `session-notes`、`api-toolchain` 等服务仓库其他流程的技能，与组件库无直接关系。

## 技能结构

每个技能是一个目录，内含 `SKILL.md`：YAML frontmatter 声明名称与触发描述，正文是给智能体的操作步骤。以 `violet-ui` 为例：

```markdown
---
name: violet-ui
description: 在 violet 仓库使用、扩展 @violet/ui 组件或营造法式组件用法文档时，核对包导出、主题入口、示例与组件真实行为。
---
```

正文规定四步：在 `web/packages/ui/src/index.ts` 核对导出 → 全局 CSS 在 Tailwind 之后导入包样式 → 在组件用法页确认真实 props 与键盘/焦点语义 → 在明暗主题和窄屏下实际预览并运行前端检查。

## 使用

```bash
cd web
pnpm dev
# 访问 /design-system/specimens 查看真实组件示例
```

在本仓库内让编码智能体按规则调用这几个 skill；仓库外暂不提供可安装的技能包。
