## 随仓库分发的技能

项目内 `.agents/skills/` 下的技能随仓库提供，无需外部安装脚本。与组件库直接相关的文件：

| 文件 | 作用 |
| --- | --- |
| `.agents/skills/violet-ui/SKILL.md` | 组件清单、原生行为、样式入口、同源示例与真实 tarball 消费验证 |
| `.agents/skills/frontend-conventions/SKILL.md` | 前端文件落位与注释规范 |
| `.agents/skills/tailwind-canonical-classes/SKILL.md` | Tailwind v4 类名的规范形态 |

## 读取顺序

组件库工作先读取实际的 `violet-ui/SKILL.md` 与 `frontend-conventions/SKILL.md`；编辑 Tailwind 类时再读取 `tailwind-canonical-classes/SKILL.md`。各技能的当前步骤和适用范围以这些文件为准。

## 使用

```bash
cd web
pnpm dev
# 访问 /ui/components/button 查看真实组件示例
```

在本仓库内让编码智能体读取并遵守这些技能；仓库外暂不提供可安装的技能包。
