// 前台底部组件
// 包含版权信息和社交链接

import { GitFork, MessageCircle, Mail } from "lucide-react";
import { useSiteSettings } from "@/components/shared/SettingsProvider";

/**
 * 前台底部组件
 * 显示版权信息和社交媒体链接
 */
export function Footer() {
  /** 当前年份，用于版权信息 */
  const currentYear = new Date().getFullYear();
  /** 站点设置 */
  const settings = useSiteSettings();

  /** 社交链接配置，根据 github_username 动态生成 GitHub 链接 */
  const socialLinks = [
    {
      label: "GitHub",
      href: settings.github_username
        ? `https://github.com/${settings.github_username}`
        : "https://github.com",
      icon: GitFork,
    },
    { label: "Twitter", href: "https://twitter.com", icon: MessageCircle },
    { label: "邮箱", href: "mailto:hello@example.com", icon: Mail },
  ] as const;

  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row">
        {/* 版权信息 */}
        <p className="text-sm text-muted-foreground">
          &copy; {currentYear} {settings.site_name}. {settings.footer_text || "保留所有权利."}
        </p>

        {/* 社交链接图标 */}
        <div className="flex items-center gap-3">
          {socialLinks.map((link) => {
            const Icon = link.icon;
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
            );
          })}
        </div>
      </div>
    </footer>
  );
}
