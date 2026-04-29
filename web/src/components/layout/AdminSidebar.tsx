/**
 * 后台管理侧边栏组件
 * 包含导航菜单和折叠功能，当前路由自动高亮
 */

import { NavLink } from "react-router"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

/** 导航菜单项配置 */
interface NavItem {
  /** 路由路径 */
  to: string
  /** 菜单标签 */
  label: string
  /** 图标标识 */
  icon: string
  /** 是否精确匹配路由 */
  end?: boolean
}

/** 后台导航菜单列表 */
const navItems: NavItem[] = [
  { to: "/admin", label: "数据看板", icon: "📊", end: true },
  { to: "/admin/posts", label: "文章管理", icon: "📝" },
  { to: "/admin/comments", label: "评论管理", icon: "💬" },
  { to: "/admin/media", label: "媒体库", icon: "🖼️" },
  { to: "/admin/users", label: "用户管理", icon: "👥" },
  { to: "/admin/settings", label: "站点设置", icon: "⚙️" },
]

/** 组件属性 */
interface AdminSidebarProps {
  /** 侧边栏是否折叠 */
  collapsed: boolean
}

/**
 * 后台管理侧边栏
 * 显示导航菜单，支持折叠和路由高亮
 */
export function AdminSidebar({ collapsed }: AdminSidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* 侧边栏头部 Logo */}
      <div className="flex h-14 items-center justify-center border-b px-4">
        {collapsed ? (
          <span className="text-xl font-bold">B</span>
        ) : (
          <span className="text-lg font-bold">博客后台管理</span>
        )}
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                collapsed && "justify-center px-2"
              )
            }
          >
            <span className="text-base">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* 底部分割线和返回前台链接 */}
      <Separator />
      <div className="p-2">
        <NavLink to="/">
          {({ isActive }) => (
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3",
                collapsed && "justify-center px-2"
              )}
            >
              <span className="text-base">🏠</span>
              {!collapsed && <span>返回前台</span>}
            </Button>
          )}
        </NavLink>
      </div>
    </aside>
  )
}
