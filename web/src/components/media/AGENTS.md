<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# components/media

## Purpose
媒体相关组件，包含媒体库选择弹窗等。

## Key Files
| File | Description |
|------|-------------|
| `MediaLibraryDialog.tsx` | 媒体库选择弹窗，用于从已上传媒体中选择 |
| `index.ts` | 桶式导出 |

## For AI Agents

### Working In This Directory
- MediaLibraryDialog 供编辑器和管理后台复用
- 媒体数据通过 features/admin/media hooks 获取

## Dependencies

### Internal
- `../../features/admin/media/` - 媒体管理 hooks
- `../ui/dialog.tsx` - 弹窗基础组件

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
