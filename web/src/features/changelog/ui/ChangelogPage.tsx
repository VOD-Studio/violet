import { formatDate } from "@features/about/model/format";
import { useReleases } from "@shared/api/releases";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";

/** 单分类条目超过该数折叠（如 v2.2.0 的「新增」23 条），点「展开全部」兜底 */
const COLLAPSE_ITEMS = 6;

/** 分类纯文字色（无边框胶囊，简洁优先） */
const labelColorRules: { match: string; cls: string }[] = [
    { match: "破坏", cls: "text-orange-600 dark:text-orange-400" },
    { match: "新功能", cls: "text-blue-600 dark:text-blue-400" },
    { match: "新增", cls: "text-blue-600 dark:text-blue-400" },
    { match: "Bug", cls: "text-red-600 dark:text-red-400" },
    { match: "修复", cls: "text-red-600 dark:text-red-400" },
    { match: "重构", cls: "text-purple-600 dark:text-purple-400" },
    { match: "性能", cls: "text-emerald-600 dark:text-emerald-400" },
    { match: "优化", cls: "text-emerald-600 dark:text-emerald-400" },
];

function categoryColor(label: string): string {
    for (const rule of labelColorRules) {
        if (label.includes(rule.match)) return rule.cls;
    }
    return "text-muted-foreground";
}

/** 条目 markdown 拆 scope：**audit:** 描述 → { scope: "audit", rest: "描述" } */
function splitItem(item: string): { scope: string; rest: string } {
    const m = item.match(/^\*\*([^*]+)\*\*:\s*(.*)$/);
    if (m) return { scope: m[1], rest: m[2] };
    return { scope: "", rest: item.replace(/[*_`]/g, "") };
}

/**
 * ChangelogPage - 更新日志独立页（/changelog）
 *
 * 简洁时间线：左侧竖线 + 圆点，右侧版本号 → 分类 → 条目三级层级。
 * 分类用纯文字色 label（不做彩色胶囊堆叠），条目 scope 加粗。
 * 当前版本实心徽章高亮；长分类折叠 + 展开按钮。
 */
export function ChangelogPage() {
    const { data } = useReleases();
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    if (!data || data.releases.length === 0) return null;

    const current = data.current_version;
    const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

    return (
        <main className="mx-auto w-full max-w-3xl px-6 py-20">
            <header className="mb-16">
                <h1 className="text-3xl font-semibold tracking-tight">更新日志</h1>
                <p className="mt-2 text-sm text-muted-foreground">本站各版本的变更记录</p>
            </header>

            <div className="relative space-y-12 border-l border-edge-hairline pl-8">
                {data.releases.map((release) => {
                    const isCurrent = release.tag === current;
                    return (
                        <article key={release.tag} className="relative">
                            {/* 时间线节点：当前版本实心强调，历史版本淡化 */}
                            <span
                                className={`absolute -left-9.5 top-1.5 size-3.5 rounded-full border-2 border-background ${
                                    isCurrent ? "bg-primary" : "bg-muted-foreground/40"
                                }`}
                            />
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                <h2
                                    className={`font-mono text-lg font-semibold tracking-tight ${
                                        isCurrent ? "text-primary" : ""
                                    }`}
                                >
                                    {release.tag}
                                </h2>
                                {release.published_at ? (
                                    <span className="text-sm text-muted-foreground">
                                        {formatDate(release.published_at)}
                                    </span>
                                ) : null}
                                {isCurrent ? (
                                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                                        当前版本
                                    </span>
                                ) : null}
                                {release.breaking ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                                        <TriangleAlert className="size-3.5" />
                                        破坏性变更
                                    </span>
                                ) : null}
                            </div>

                            {release.categories.length > 0 ? (
                                <div className="mt-5 space-y-6">
                                    {release.categories.map((cat) => {
                                        const key = `${release.tag}:${cat.label}`;
                                        const showAll =
                                            expanded[key] || cat.items.length <= COLLAPSE_ITEMS;
                                        const visible = showAll
                                            ? cat.items
                                            : cat.items.slice(0, COLLAPSE_ITEMS);
                                        return (
                                            <section key={cat.label}>
                                                <h3
                                                    className={`text-xs font-semibold uppercase tracking-wider ${categoryColor(cat.label)}`}
                                                >
                                                    {cat.label}
                                                </h3>
                                                <ul className="mt-2.5 space-y-2.5">
                                                    {visible.map((item, idx) => {
                                                        const { scope, rest } = splitItem(item);
                                                        return (
                                                            <li
                                                                key={idx}
                                                                className="break-words text-[15px] leading-relaxed text-foreground/75"
                                                            >
                                                                {scope ? (
                                                                    <span className="font-semibold text-foreground">
                                                                        {scope}:
                                                                    </span>
                                                                ) : null}
                                                                {scope ? " " : null}
                                                                {rest}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                                {cat.items.length > COLLAPSE_ITEMS && (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggle(key)}
                                                        className="mt-2 text-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                                                    >
                                                        {showAll
                                                            ? "收起"
                                                            : `展开全部 ${cat.items.length - COLLAPSE_ITEMS} 条`}
                                                    </button>
                                                )}
                                            </section>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </article>
                    );
                })}
            </div>
        </main>
    );
}
