/**
 * 后台管理布局组件
 * 包含顶部栏、可折叠侧边栏和内容区域
 * 使用 zustand store 管理侧边栏状态
 */

import { Outlet } from "react-router"
import { AdminSidebar } from "./AdminSidebar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useSidebarStore } from "@/store"
import { useAuth } from "@/hooks/useAuth"

/**
 * 后台管理布局
 * 顶部栏包含搜索框和用户菜单，左侧可折叠侧边栏，右侧为内容区域
 */
export default function AdminLayout() {
  const { toggle } = useSidebarStore()
  const { user, logout } = useAuth()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 左侧侧边栏 */}
      <AdminSidebar />

      {/* 右侧主内容区域 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 顶部栏 */}
        <header className="flex h-14 items-center justify-between border-b bg-background px-4">
          {/* 左侧：折叠按钮和搜索框 */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label="切换侧边栏"
            >
              <svg
                className="size-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </Button>
            <Input
              type="search"
              placeholder="搜索文章、评论..."
              className="w-64"
            />
          </div>

          {/* 右侧：用户头像下拉菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex size-8 cursor-pointer items-center justify-center rounded-full hover:bg-muted">
              <Avatar className="size-8">
                <AvatarFallback>
                  {user?.username?.charAt(0)?.toUpperCase() ?? "管"}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem className="text-sm text-muted-foreground" disabled>
                {user?.username ?? "管理员"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={logout}
              >
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* 页面内容区域 */}
        <main id="admin-content" className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
