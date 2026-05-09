<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# components/editor

## Purpose
TipTap 富文本编辑器组件集。提供完整的文章编辑体验，包括图片插入、链接编辑、Markdown 导入/预览等功能。

## Key Files
| File | Description |
|------|-------------|
| `RichTextEditor.tsx` | 编辑器主组件 |
| `index.ts` | 桶式导出 |
| `EditorDialogs.tsx` | 编辑器弹窗组件 |
| `LinkDialog.tsx` | 链接插入弹窗 |
| `MarkdownImport.tsx` | Markdown 导入功能 |
| `MarkdownPreview.tsx` | Markdown 预览 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `ImageDialog/` | 图片插入/上传弹窗 |
| `RichTextEditor/` | 编辑器核心实现 |

## For AI Agents

### Working In This Directory
- 编辑器基于 TipTap (ProseMirror)，扩展在 RichTextEditor/ 目录
- 新增编辑器功能需了解 TipTap Extension API
- 图片上传与 `../upload/` 组件联动

### Common Patterns
- TipTap 扩展: 使用 Extension.create() API
- 工具栏按钮: 使用 Lucide 图标 + TipTap 命令

## Dependencies

### Internal
- `../upload/` - 文件上传组件
- `../../lib/api.ts` - API 调用

### External
- TipTap - 富文本编辑框架
- @tiptap/extension-* - 编辑器扩展

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
