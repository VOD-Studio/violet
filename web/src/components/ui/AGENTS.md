<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# components/ui

## Purpose
UI 基础组件库，类似 shadcn/ui 风格。基于 Radix UI / Base UI 无障碍原语 + Tailwind CSS + CVA 构建。

## Key Files
| File | Description |
|------|-------------|
| `button.tsx` | 按钮组件 (多变体) |
| `input.tsx` | 输入框组件 |
| `textarea.tsx` | 文本域组件 |
| `select.tsx` | 下拉选择组件 |
| `checkbox.tsx` | 复选框组件 |
| `switch.tsx` | 开关组件 |
| `dialog.tsx` | 对话框组件 |
| `sheet.tsx` | 侧滑面板组件 |
| `dropdown-menu.tsx` | 下拉菜单组件 |
| `tabs.tsx` | 标签页组件 |
| `table.tsx` | 表格组件 |
| `card.tsx` | 卡片组件 |
| `badge.tsx` | 徽章组件 |
| `avatar.tsx` | 头像组件 |
| `label.tsx` | 表单标签组件 |
| `separator.tsx` | 分隔线组件 |
| `skeleton.tsx` | 骨架屏组件 |
| `sonner.tsx` | Toast 通知组件 |

## For AI Agents

### Working In This Directory
- 新增 UI 组件遵循 shadcn/ui 模式: Radix/Base 原语 + CVA + Tailwind
- 组件使用 `../../lib/utils.ts` 的 cn() 合并类名
- 支持通过 className prop 覆盖样式
- 变体 (variant) 通过 CVA 定义

### Common Patterns
- CVA 定义变体: size, variant, color 等
- forwardRef 暴露 DOM ref
- cn() 合并默认类名和传入类名
- Radix UI 原语处理无障碍和交互

## Dependencies

### Internal
- `../../lib/utils.ts` - cn() 类名合并

### External
- Radix UI - 无障碍原语
- Base UI - 无障碍原语
- CVA - 组件变体管理
- Sonner - Toast 通知

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
