import { fetchArchiveYear, fetchArchiveYears } from "@features/archive/api/client";
import { archiveKeys } from "@features/archive/api/keys";
import { useArchiveYear, useArchiveYears } from "@features/archive/api/queries";
import ArchiveSkeleton from "@features/archive/ui/ArchiveSkeleton";
import ArchiveYearSkeleton from "@features/archive/ui/ArchiveYearSkeleton";
import type { ArchiveItem } from "@features/archive/model/types";
import { Badge } from "@shared/ui/badge";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useEffect, useRef, useState } from "react";

/** 按月分组：{ [month]: items[] }，月份倒序（items 已倒序，仅 key 排序） */
function groupByMonth(items: ArchiveItem[]): Map<number, ArchiveItem[]> {
    const map = new Map<number, ArchiveItem[]>();
    for (const item of items) {
        const month = new Date(item.published_at).getMonth() + 1;
        if (!map.has(month)) map.set(month, []);
        map.get(month)?.push(item);
    }
    return new Map([...map.entries()].sort((a, b) => b[0] - a[0]));
}

/**
 * YearSection - 单个年份区块。
 *
 * 懒加载策略：默认不请求该年文章，进入视口（rootMargin 200px）或被激活时
 * 才调 useArchiveYear 拉取。最近一年由父组件默认激活，首屏直出。
 */
function YearSection({
    year,
    active,
    onActivate,
}: {
    year: number;
    active: boolean;
    onActivate: () => void;
}) {
    const ref = useRef<HTMLElement>(null);
    const { data, isLoading, error, refetch } = useArchiveYear(
        year,
        active, // 仅在激活（最近年或进入视口）时拉取
    );

    // 进入视口自动激活（已激活则跳过）
    useEffect(() => {
        if (active) return;
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    onActivate();
                    obs.disconnect();
                }
            },
            { rootMargin: "200px" },
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [active, onActivate]);

    return (
        <section ref={ref} id={`year-${year}`} className="scroll-mt-20">
            <h2 className="mb-4 text-xl font-bold">
                {year} <span className="text-muted-foreground">· {data?.count ?? 0} 篇</span>
            </h2>
            {isLoading && <ArchiveYearSkeleton year={year} />}
            {error && (
                <button type="button" onClick={() => refetch()} className="text-destructive">
                    加载失败，点击重试
                </button>
            )}
            {data && (
                <div className="space-y-6">
                    {[...groupByMonth(data.items).entries()].map(([month, items]) => (
                        <div key={month}>
                            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                                {format(new Date(2020, month - 1, 1), "MMMM", { locale: zhCN })}
                            </h3>
                            <ul className="space-y-2 border-l-2 border-border pl-4">
                                {items.map((item) => (
                                    <li key={item.id} className="flex items-start gap-3">
                                        <span className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                                            {format(new Date(item.published_at), "MM-dd")}
                                        </span>
                                        <div>
                                            <a
                                                href={`/blog/${item.slug}`}
                                                className="font-medium hover:text-primary hover:underline"
                                            >
                                                {item.title}
                                            </a>
                                            {item.tags.length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {item.tags.map((t) => (
                                                        <Badge
                                                            key={t}
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            {t}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function ArchivePage() {
    const { data: indexData, isLoading } = useArchiveYears();
    const years = indexData?.years ?? [];
    // 默认激活最近一年（首屏直出该年文章）
    const [activeYears, setActiveYears] = useState<Set<number>>(new Set());

    // 年份索引加载后激活最近一年
    useEffect(() => {
        if (years.length > 0 && activeYears.size === 0) {
            setActiveYears(new Set([years[0]]));
        }
    }, [years, activeYears.size]);

    return (
        <div className="container mx-auto px-4 py-12">
            <header className="mb-10">
                <h1 className="text-3xl font-bold">归档</h1>
                <p className="mt-2 text-muted-foreground">共 {years.length} 个年份</p>
            </header>

            {/* 年份快速导航（锚点平滑滚动） */}
            {years.length > 1 && (
                <nav className="mb-10 flex flex-wrap gap-2">
                    {years.map((y) => (
                        <a
                            key={y}
                            href={`#year-${y}`}
                            className="rounded-full border px-3 py-1 text-sm hover:bg-accent"
                        >
                            {y}
                        </a>
                    ))}
                </nav>
            )}

            {isLoading ? (
                <ArchiveSkeleton />
            ) : years.length === 0 ? (
                <div className="text-muted-foreground">暂无文章</div>
            ) : (
                <div className="space-y-12">
                    {years.map((y) => (
                        <YearSection
                            key={y}
                            year={y}
                            active={activeYears.has(y)}
                            onActivate={() => setActiveYears((prev) => new Set(prev).add(y))}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export const Route = createFileRoute("/blog/archive")({
    // SSR 预取年份索引 + 最近一年文章（首屏直出，与组件默认激活 years[0] 一致）
    loader: async ({ context }) => {
        const index = await context.queryClient.fetchQuery({
            queryKey: archiveKeys.years(),
            queryFn: () => fetchArchiveYears(),
        });
        const latest = index?.years?.[0];
        if (latest) {
            await context.queryClient
                .ensureQueryData({
                    queryKey: archiveKeys.year(latest),
                    queryFn: () => fetchArchiveYear(latest),
                })
                .catch(() => {
                    /* 最近年文章失败不阻塞，客户端懒加载兜底 */
                });
        }
    },
    component: ArchivePage,
});
