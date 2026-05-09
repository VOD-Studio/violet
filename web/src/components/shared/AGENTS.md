<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# components/shared

## Purpose
通用共享组件，被多个页面/功能复用的功能性组件。

## Key Files
| File | Description |
|------|-------------|
| `SEO.tsx` | SEO meta 标签管理 |
| `StructuredData.tsx` | 结构化数据 (JSON-LD) |
| `Pagination.tsx` | 分页导航 |
| `LoadingSpinner.tsx` | 加载状态指示 |
| `EmptyState.tsx` | 空数据占位 |
| `ErrorFallback.tsx` | 错误边界回退 |
| `ConfirmDialog.tsx` | 确认操作弹窗 |
| `Toast.tsx` | 消息提示 |
| `BackToTop.tsx` | 回到顶部按钮 |
| `AnnouncementBar.tsx` | 公告横幅 |
| `ImageGallery.tsx` | 图片画廊 |
| `PermissionGuard.tsx` | 权限守卫组件 |
| `RequirePermission.tsx` | 权限检查包装器 |
| `SettingsProvider.tsx` | 全局设置 Provider |
| `index.ts` | 桶式导出 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `ImagePreview/` | 图片预览组件 |
| `SidebarWidgets/` | 侧边栏小部件 |

## For AI Agents

### Working In This Directory
- 这些组件被广泛复用，修改需确保向后兼容
- 新增通用组件放在此目录并通过 index.ts 导出

### Common Patterns
- 所有组件通过 index.ts 桶式导出
- 使用 React Helmet 管理 SEO
- 权限守卫: 结合 usePermission hook

## Dependencies

### Internal
- `../../hooks/usePermission.ts` - 权限检查
- `../../lib/utils.ts` - cn() 工具

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
