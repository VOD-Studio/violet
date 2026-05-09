<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# components/upload

## Purpose
文件上传组件集。提供拖拽上传、分块上传和文件预览功能。

## Key Files
| File | Description |
|------|-------------|
| `FileUploader.tsx` | 文件上传主组件 |
| `FilePreview.tsx` | 文件预览组件 |
| `ChunkedUpload.ts` | 大文件分块上传逻辑 |
| `index.ts` | 桶式导出 |

## For AI Agents

### Working In This Directory
- 大文件使用分块上传 (ChunkedUpload)
- 上传后端接口在 api/internal/handler/upload.go
- 支持图片/视频/音频等多种文件类型

### Common Patterns
- 拖拽上传: HTML5 Drag & Drop API
- 分块上传: 将大文件分割后逐块上传
- 进度反馈: 使用 onProgress 回调

## Dependencies

### Internal
- `../../hooks/useFileUpload.ts` - 上传 hook
- `../../lib/api.ts` - API 客户端

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
