<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# components/layout

## Purpose
页面布局组件，提供前台展示和管理后台的页面框架结构。

## Key Files
| File | Description |
|------|-------------|
| `Layout.tsx` | 前台页面主布局 (Header + Content + Footer) |
| `Header.tsx` | 前台顶部导航栏 |
| `Footer.tsx` | 前台页脚 |
| `AdminLayout.tsx` | 管理后台布局 (侧边栏 + 内容区) |
| `AdminSidebar.tsx` | 管理后台侧边栏导航 |
| `AnimatedOutlet.tsx` | 带动画的路由出口 |
| `PageTransition.tsx` | 页面切换过渡动画 |

## For AI Agents

### Working In This Directory
- 布局组件影响全局页面结构，修改需谨慎
- 新增导航项在 Header 或 AdminSidebar 中添加
- 路由结构在 App.tsx 定义，布局组件包裹内容区

### Common Patterns
- React Router Outlet 用于嵌套布局
- 动画使用 Framer Motion
- 响应式: 移动端侧边栏折叠

## Dependencies

### Internal
- `../../hooks/useTheme.ts` - 主题切换
- `../../store/slices/sidebar.ts` - 侧边栏状态

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
