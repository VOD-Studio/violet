import { Bird, GitBranch, Mail, Rss, Share2, Tv } from "lucide-react";
import { motion } from "motion/react";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

/**
 * SocialMatrixSection - A4 社交矩阵（扩展版）
 *
 * 渲染已配置的社交平台：GitHub（复用 github_username）/ Twitter / Mastodon / Email / RSS / Bilibili。
 * 仅渲染非空平台。GitHub 用户名拼完整 URL。
 */
export function SocialMatrixSection({ settings }: AboutSectionProps) {
    const entries = [
        settings.github_username
            ? {
                  label: "GitHub",
                  href: `https://github.com/${settings.github_username}`,
                  sub: `@${settings.github_username}`,
                  icon: GitBranch,
              }
            : null,
        settings.social_twitter
            ? { label: "Twitter", href: settings.social_twitter, sub: "Twitter", icon: Bird }
            : null,
        settings.social_mastodon
            ? { label: "Mastodon", href: settings.social_mastodon, sub: "Mastodon", icon: Share2 }
            : null,
        settings.social_email
            ? {
                  label: "Email",
                  href: `mailto:${settings.social_email}`,
                  sub: settings.social_email,
                  icon: Mail,
              }
            : null,
        settings.social_rss
            ? { label: "RSS", href: settings.social_rss, sub: "RSS Feed", icon: Rss }
            : null,
        settings.social_bilibili
            ? { label: "Bilibili", href: settings.social_bilibili, sub: "Bilibili", icon: Tv }
            : null,
    ].filter((e): e is NonNullable<typeof e> => e !== null);

    if (entries.length === 0) return null;

    return (
        <section className="mx-auto w-full max-w-5xl px-6 py-14">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
            >
                <h2 className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    链接
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {entries.map(({ label, href, sub, icon: Icon }) => (
                        <a
                            key={label}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-4 rounded-xl border border-edge-hairline bg-background p-5 transition-all hover:border-primary/50 hover:shadow-md"
                        >
                            <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-accent">
                                <Icon className="size-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block font-semibold">{label}</span>
                                <span className="block truncate text-sm text-muted-foreground">
                                    {sub}
                                </span>
                            </span>
                        </a>
                    ))}
                </div>
            </motion.div>
        </section>
    );
}
