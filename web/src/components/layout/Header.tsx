// 前台头部导航组件
// 包含 Logo、导航链接、登录/用户头像，支持响应式汉堡菜单

import { useState } from "react"
import { Link, useLocation } from "react-router"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

/** 导航链接配置列表 */
const NAV_ITEMS = [
  { label: "首页", href: "/" },
  { label: "博客", href: "/blog" },
  { label: "项目", href: "/projects" },
  { label: "关于", href: "/about" },
] as const

/**
 * 前台头部导航组件
 * 桌面端显示水平导航栏，移动端显示汉堡菜单
 */
export function Header() {
  /** 移动端菜单展开状态 */
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  /** 当前路由路径，用于高亮当前导航项 */
  const location = useLocation()
  /** 认证状态 */
  const { isAuthenticated, user, logout } = useAuth()

  /** 切换移动端菜单显示状态 */
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev)
  }

  /** 关闭移动端菜单 */
  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  /**
   * 判断导航链接是否为当前激活状态
   * 首页需要精确匹配，其他页面使用前缀匹配
   */
  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/"
    return location.pathname.startsWith(href)
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        {/* Logo / 站点名称 */}
        <Link to="/" className="text-lg font-bold" onClick={closeMobileMenu}>
          我的博客
        </Link>

        {/* 桌面端导航链接 */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                isActive(item.href)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* 桌面端右侧：登录按钮或用户信息 */}
        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              {/* 用户头像和名称 */}
              <span className="text-sm text-muted-foreground">
                {user?.username}
              </span>
              <Button variant="ghost" size="sm" onClick={logout}>
                退出
              </Button>
            </div>
          ) : (
            <Link to="/login">
              <Button variant="outline" size="sm">
                登录
              </Button>
            </Link>
          )}
        </div>

        {/* 移动端汉堡菜单按钮 */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={toggleMobileMenu}
          aria-label={isMobileMenuOpen ? "关闭菜单" : "打开菜单"}
        >
          {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {/* 移动端展开菜单 */}
      {isMobileMenuOpen && (
        <div className="border-b bg-background md:hidden">
          <nav className="container mx-auto flex flex-col gap-1 px-4 py-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={closeMobileMenu}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                  isActive(item.href)
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}

            {/* 移动端登录/退出按钮 */}
            <div className="mt-2 border-t pt-2">
              {isAuthenticated ? (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-muted-foreground">
                    {user?.username}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => { logout(); closeMobileMenu() }}>
                    退出
                  </Button>
                </div>
              ) : (
                <Link to="/login" onClick={closeMobileMenu}>
                  <Button variant="outline" size="sm" className="w-full">
                    登录
                  </Button>
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
