<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-06-18 -->

# components/layout

## Purpose
页面布局组件，提供前台展示和管理后台的页面框架结构。

## Key Files
| File | Description |
|------|-------------|
| `Layout.tsx` | 前台页面主布局，组合 Header + AnimatedOutlet + Footer + AnnouncementBar + SidebarWidgets |
| `Header.tsx` | 前台顶部导航栏，支持响应式汉堡菜单与移动端 AnimatePresence 动画 |
| `Footer.tsx` | 前台页脚 |
| `AdminLayout.tsx` | 管理后台布局，侧边栏 + 内容区 |
| `AdminSidebar.tsx` | 管理后台侧边栏导航 |
| `AnimatedOutlet.tsx` | 带动画的路由出口，基于 TanStack Router Outlet + AnimatePresence |
| `PageTransition.tsx` | 页面切换过渡动画，支持 fade/slide/scale 三种类型 |

## For AI Agents

### Working In This Directory
- 布局组件影响全局页面结构，修改需谨慎
- 新增导航项在 Header 或 AdminSidebar 中添加
- 路由结构使用 TanStack Router 文件路由约定，在 `src/routes/` 中定义
- 前台路由使用 `/_public` pathless layout 包裹 Layout，认证路由使用 `/_auth` pathless layout 提供干净外壳

### Common Patterns
- TanStack Router Outlet 用于嵌套布局
- 动画使用 Framer Motion，AnimatePresence 管理进出场
- 响应式：移动端侧边栏折叠，Header 汉堡菜单带高度/透明度过渡动画
- 减少动画偏好通过 `prefers-reduced-motion` 自动降级

## Dependencies

### Internal
- `../../hooks/useTheme.ts` - 主题切换
- `../../store/slices/sidebar.ts` - 侧边栏状态
- `../../components/shared/AnnouncementBar.tsx` - 公告栏
- `../../components/shared/SidebarWidgets.tsx` - 悬浮侧边组件
- `../../components/shared/SettingsProvider.tsx` - 站点设置

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
