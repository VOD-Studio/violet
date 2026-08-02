import { formatDate } from "@features/about/model/format";
import { useReleases } from "@shared/api/releases";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

/** 入口卡片展示的最新动态条数 */
const PREVIEW_ITEMS = 3;

/**
 * ChangelogSection - 更新日志入口（about 页区块，后台可开关/排序）
 *
 * 完整日志在独立路由 /changelog；本区块只展示最新版本摘要 + 跳转入口，
 * 避免 about 页堆叠长列表。接口失败/空时优雅降级（不渲染）。
 */
export function ChangelogSection(_: AboutSectionProps) {
    const { data, isPending } = useReleases();

    // 加载中：区块级骨架（标题静态 + 入口卡片形状占位）
    if (isPending) {
        return (
            <section className="mx-auto w-full max-w-5xl px-6 py-14">
                <div>
                    <ShimmerSkeleton className="mb-6 h-3 w-20" />
                    <div className="rounded-xl border border-edge-hairline p-6">
                        <div className="flex items-center gap-3">
                            <ShimmerSkeleton className="h-5 w-24" />
                            <ShimmerSkeleton className="h-3 w-16" />
                        </div>
                        <div className="mt-4 space-y-2">
                            <ShimmerSkeleton className="h-4 w-full" />
                            <ShimmerSkeleton className="h-4 w-5/6" />
                            <ShimmerSkeleton className="h-4 w-2/3" />
                        </div>
                        <ShimmerSkeleton className="mt-5 h-4 w-32" />
                    </div>
                </div>
            </section>
        );
    }

    if (!data || data.releases.length === 0) return null;

    const latest = data.releases[0];
    const preview = latest.categories.flatMap((c) => c.items).slice(0, PREVIEW_ITEMS);

    return (
        <section className="mx-auto w-full max-w-5xl px-6 py-14">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
            >
                <h2 className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    更新日志
                </h2>
                <Link
                    to="/changelog"
                    className="group block rounded-xl border border-edge-hairline bg-background p-6 transition-colors hover:border-primary/40"
                >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-mono text-base font-semibold text-foreground">
                            {latest.tag}
                        </span>
                        {latest.published_at ? (
                            <span className="text-sm text-muted-foreground">
                                {formatDate(latest.published_at)}
                            </span>
                        ) : null}
                        <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                            当前版本
                        </span>
                    </div>
                    {preview.length > 0 ? (
                        <ul className="mt-3.5 space-y-2">
                            {preview.map((item, idx) => (
                                <li
                                    key={idx}
                                    className="truncate text-[15px] leading-7 text-foreground/75"
                                >
                                    {item.replace(/\*\*/g, "").replace(/^[*_-]\s*/, "")}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                        查看完整更新日志
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                </Link>
            </motion.div>
        </section>
    );
}
