<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# components

## Purpose
React 组件库，按功能分类组织。包含管理后台、博客展示、创意效果、富文本编辑器、布局框架、媒体播放、通用组件和 UI 基础组件。

## Key Files
| File | Description |
|------|-------------|
| `Segmented.tsx` | 分段控制器组件 |
| `ThemeToggle.tsx` | 主题切换按钮 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `admin/` | 管理后台专用组件 (EmojiUploader) |
| `blog/` | 博客展示组件 (PostCard, TagFilter, CodeSandbox 等) |
| `creative/` | 创意视觉效果组件 |
| `editor/` | 富文本编辑器组件 (TipTap) |
| `layout/` | 页面布局组件 (Header, Sidebar, Footer) |
| `media/` | 媒体播放组件 (音乐播放器等) |
| `providers/` | React Context Provider 组件 |
| `shared/` | 通用共享组件 |
| `ui/` | UI 基础组件 (button, dialog, table 等，类 shadcn 风格) |
| `upload/` | 文件上传组件 |
| `TableOfContents/` | 文章目录组件 |

## For AI Agents

### Working In This Directory
- UI 基础组件在 `ui/` 下，使用 CVA + Radix UI/Base UI 模式
- 业务组件按领域分类放置
- 新增组件需遵循现有命名和导出约定
- Tailwind v4 写法: 数字值直接写如 `gap-4`、`rounded-8`

### Common Patterns
- UI 组件: CVA (class-variance-authority) + Radix/Base UI 原语
- 样式: Tailwind CSS v4 + clsx 合并类名
- 导出: 每个组件独立文件，PascalCase 命名

## Dependencies

### Internal
- `../hooks/` - 自定义 hooks
- `../lib/utils.ts` - cn() 类名合并工具

### External
- Radix UI / Base UI - 无障碍 UI 原语
- CVA - 组件变体管理
- clsx + tailwind-merge - 类名合并
- Lucide React - 图标

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
