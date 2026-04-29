/**
 * 后台管理布局组件
 * 包含顶部栏、可折叠侧边栏和内容区域
 */

import { useState } from "react"
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
import { clearToken } from "@/middleware/auth"

/**
 * 后台管理布局
 * 顶部栏包含搜索框和用户菜单，左侧可折叠侧边栏，右侧为内容区域
 */
export default function AdminLayout() {
  /** 控制侧边栏折叠状态 */
  const [collapsed, setCollapsed] = useState(false)

  /**
   * 处理退出登录
   * 清除 token 后跳转到登录页
   */
  function handleLogout() {
    clearToken()
    window.location.href = "/login"
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 左侧侧边栏 */}
      <AdminSidebar collapsed={collapsed} />

      {/* 右侧主内容区域 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 顶部栏 */}
        <header className="flex h-14 items-center justify-between border-b bg-background px-4">
          {/* 左侧：折叠按钮和搜索框 */}
          <div className="flex items-center gap-3">
            {/* 侧边栏折叠/展开按钮 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {collapsed ? (
                  <>
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="15" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </>
                )}
              </svg>
            </Button>
            {/* 全局搜索框 */}
            <Input
              type="search"
              placeholder="搜索文章、评论..."
              className="w-64"
            />
          </div>

          {/* 右侧：用户头像下拉菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="size-8">
                  <AvatarFallback>管</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem>个人资料</DropdownMenuItem>
              <DropdownMenuItem>账号设置</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={handleLogout}
              >
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* 页面内容区域 */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
