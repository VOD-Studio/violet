/**
 * AnnouncementCard - 公告卡片（card / article 两态共用）
 *
 * 两态在首页有明确视觉与交互差异：
 * - card（通知票据）：自包含通知，无封面、不可点击、无详情页。
 *   读完即止，content/excerpt 就是全部。
 * - article（简报入口）：带封面图 + 「阅读 →」引导，
 *   整卡可点击，跳转 /announcements/:id 看正文。
 *
 * 去赛博化后的视觉语言：
 * - 外壳用 BorderGlow 柔色发光描边（severity 决定色相），替代 SpotlightCard 聚光
 * - 标题用 BlurText 按词模糊渐显，替代 DecryptedText 解码乱码
 * - severity 仅由 BorderGlow 边框色相表达，不显示文字标签与图标
 * - severity 配色走 shadcn 色阶（shared/ui/announcement-severity），无 neon
 */
import type { Announcement } from "@features/settings/model/types";
import { getAnnouncementSev } from "@shared/ui/announcement-severity";
import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import { Link } from "@tanstack/react-router";
import BlurText from "@vendor/react-bits/BlurText";
import BorderGlow from "@vendor/react-bits/BorderGlow";
import { ArrowRight } from "lucide-react";

export interface AnnouncementCardProps {
    announcement: Announcement;
}

export default function AnnouncementCard({ announcement: a }: AnnouncementCardProps) {
    const cfg = getAnnouncementSev(a.severity);
    const isArticle = a.display === "article";
    const stamp = a.created_at
        ? new Date(a.created_at).toISOString().slice(0, 16).replace("T", " ")
        : "";

    // 卡片正文（标题 + 摘要 + affects + 底部），card 与 article 共用
    const body = (
        <>
            {/* article 形态：顶部封面图（card 形态无封面） */}
            {isArticle && a.cover_image && (
                <div className="aspect-2/1 w-full overflow-hidden border-b border-edge-hairline rounded-t-2xl rounded-b-xl">
                    <CroppedImage
                        src={a.cover_image}
                        alt={a.title}
                        loading="lazy"
                        className="h-full w-full"
                        imgClassName="transition-transform duration-500 group-hover:scale-105"
                    />
                </div>
            )}

            <div className="flex flex-1 flex-col p-6">
                {/* 顶部 metadata：左侧时间戳，右侧公告 ID */}
                <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{stamp}</span>
                    <span className="font-mono tabular-nums">#{String(a.id).padStart(3, "0")}</span>
                </div>

                {/* 标题（按词模糊渐显） */}
                <BlurText
                    text={a.title}
                    animateBy="words"
                    stepDuration={0.4}
                    delay={80}
                    className="mb-2 text-lg font-semibold leading-snug text-foreground"
                />

                {/* 摘要 */}
                <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                    {a.excerpt || a.content}
                </p>

                {/* affects 标签 */}
                {a.affects && a.affects.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1">
                        {a.affects.slice(0, 4).map((m) => (
                            <span
                                key={m}
                                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                                {m}
                            </span>
                        ))}
                    </div>
                )}

                {/* 底部票据区 */}
                <div className="mt-auto flex items-center justify-end border-t border-edge-hairline pt-3 text-xs">
                    {isArticle ? (
                        <span className="inline-flex items-center gap-1 font-medium text-foreground transition-opacity group-hover:opacity-70">
                            阅读 <ArrowRight className="size-3" />
                        </span>
                    ) : (
                        <span className="text-muted-foreground">通知</span>
                    )}
                </div>
            </div>
        </>
    );

    // BorderGlow 外壳：severity 决定色相，单色模式（三色相同）保持克制
    // 外层套 shadow-sm + ring 提供静态边界感（悬停时 BorderGlow 接管发光）
    const glowShell = (children: React.ReactNode) => (
        <div className="group rounded-2xl shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md dark:ring-white/10">
            <BorderGlow
                backgroundColor="hsl(var(--card))"
                borderRadius={16}
                glowColor={cfg.glow[0]}
                colors={[
                    `hsl(${cfg.glow[0]} / 0.9)`,
                    `hsl(${cfg.glow[1]} / 0.6)`,
                    `hsl(${cfg.glow[2]} / 0.9)`,
                ]}
                glowIntensity={0.6}
                glowRadius={20}
                animated={false}
                className="min-h-55"
            >
                {children}
            </BorderGlow>
        </div>
    );

    // article：整卡可点击，套 Link
    if (isArticle) {
        return glowShell(
            <Link
                to="/announcements/$id"
                params={{ id: String(a.id) }}
                className="flex flex-1 flex-col"
            >
                {body}
            </Link>,
        );
    }

    // card：自包含，不可点击
    return glowShell(<div className="flex flex-1 flex-col">{body}</div>);
}
