/**
 * 后台管理侧边栏组件
 * 包含导航菜单、折叠功能、主题切换，当前路由自动高亮
 */

import { NavLink } from "react-router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useSidebarStore } from "@/store";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Tag,
  Image,
  Smile,
  Music,
  Users,
  Settings,
  Home,
} from "lucide-react";

/** 导航菜单项配置 */
interface NavItem {
  /** 路由路径 */
  to: string;
  /** 菜单标签 */
  label: string;
  /** 图标组件 */
  icon: React.ReactNode;
  /** 是否精确匹配路由 */
  end?: boolean;
}

/** 后台导航菜单列表 */
const navItems: NavItem[] = [
  {
    to: "/admin",
    label: "数据看板",
    end: true,
    icon: <LayoutDashboard className="size-4" />,
  },
  {
    to: "/admin/posts",
    label: "文章管理",
    icon: <FileText className="size-4" />,
  },
  {
    to: "/admin/comments",
    label: "评论管理",
    icon: <MessageSquare className="size-4" />,
  },
  {
    to: "/admin/tags",
    label: "标签管理",
    icon: <Tag className="size-4" />,
  },
  {
    to: "/admin/media",
    label: "媒体库",
    icon: <Image className="size-4" />,
  },
  {
    to: "/admin/emojis",
    label: "表情",
    icon: <Smile className="size-4" />,
  },
  {
    to: "/admin/playlists",
    label: "音乐歌单",
    icon: <Music className="size-4" />,
  },
  {
    to: "/admin/users",
    label: "用户管理",
    icon: <Users className="size-4" />,
  },
  {
    to: "/admin/settings",
    label: "站点设置",
    icon: <Settings className="size-4" />,
  },
];

/**
 * 后台管理侧边栏
 * 显示导航菜单，支持折叠和路由高亮
 */
export function AdminSidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* 侧边栏头部 Logo 和主题切换 */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        {collapsed ? (
          <span className="text-xl font-bold">B</span>
        ) : (
          <span className="text-lg font-bold">博客后台管理</span>
        )}
        {!collapsed && <ThemeToggle />}
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
                collapsed && "justify-center px-2",
              )
            }
          >
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* 底部分割线和返回前台链接 */}
      <Separator />
      <div className="p-2">
        <NavLink to="/">
          {() => (
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3",
                collapsed && "justify-center px-2",
              )}
            >
              <Home className="size-4 shrink-0" />
              {!collapsed && <span>返回前台</span>}
            </Button>
          )}
        </NavLink>
      </div>
    </aside>
  );
}