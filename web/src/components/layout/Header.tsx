/**
 * 前台头部导航组件
 * 包含 Logo、导航链接、登录/用户头像、主题切换，支持响应式汉堡菜单
 */

import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  /** 路由导航函数 */
  const navigate = useNavigate()
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

        {/* 桌面端右侧：主题切换 + 用户菜单或登录按钮 */}
        <div className="hidden items-center gap-1 md:flex">
          <ThemeToggle />
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="relative flex size-8 items-center justify-center rounded-full hover:bg-muted">
                <Avatar className="size-8">
                  <AvatarImage src={user?.avatar_url} alt={user?.username} />
                  <AvatarFallback>
                    {user?.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user?.username}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {user?.role === "admin" && (
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    管理后台
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={logout}>
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login">
              <Button variant="outline" size="sm">
                登录
              </Button>
            </Link>
          )}
        </div>

        {/* 移动端：主题切换 + 汉堡菜单按钮 */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMobileMenu}
            aria-label={isMobileMenuOpen ? "关闭菜单" : "打开菜单"}
          >
            {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
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

            {/* 移动端登录/用户菜单 */}
            <div className="mt-2 border-t pt-2">
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-md px-3 py-2 hover:bg-muted">
                    <Avatar className="size-8">
                      <AvatarImage src={user?.avatar_url} alt={user?.username} />
                      <AvatarFallback>
                        {user?.username?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start">
                      <p className="text-sm font-medium">{user?.username}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end">
                    {user?.role === "admin" && (
                      <DropdownMenuItem onClick={() => { navigate("/admin"); closeMobileMenu() }}>
                        管理后台
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => { logout(); closeMobileMenu() }}>
                      退出登录
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
