// 前台底部组件
// 包含版权信息和社交链接

import { Github, Twitter, Mail } from "lucide-react"

/** 社交链接配置 */
const SOCIAL_LINKS = [
  { label: "GitHub", href: "https://github.com", icon: Github },
  { label: "Twitter", href: "https://twitter.com", icon: Twitter },
  { label: "邮箱", href: "mailto:hello@example.com", icon: Mail },
] as const

/**
 * 前台底部组件
 * 显示版权信息和社交媒体链接
 */
export function Footer() {
  /** 当前年份，用于版权信息 */
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row">
        {/* 版权信息 */}
        <p className="text-sm text-muted-foreground">
          &copy; {currentYear} 我的博客. 保留所有权利.
        </p>

        {/* 社交链接图标 */}
        <div className="flex items-center gap-3">
          {SOCIAL_LINKS.map((link) => {
            const Icon = link.icon
            return (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.label}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon className="size-5" />
              </a>
            )
          })}
        </div>
      </div>
    </footer>
  )
}
