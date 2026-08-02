import { useReleases } from "@features/about/api/queries";
import { formatDate } from "@features/about/model/format";
import { MarkdownContent } from "@shared/ui/markdown-preview/MarkdownContent";
import { TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

/** 单分类条目超过该数折叠（如 v2.2.0 的「新增」23 条），点「展开全部」兜底 */
const COLLAPSE_ITEMS = 6;

/**
 * 分类标签配色：按 label 关键词匹配（release notes 已去 emoji，按纯文字 label 配色）。
 * 匹配规则：label 含关键词即命中，新功能优先于其他。
 */
const labelColorRules: { match: string; cls: string }[] = [
    {
        match: "破坏",
        cls: "border-orange-500/50 bg-orange-500/15 text-orange-600 dark:text-orange-400",
    },
    { match: "新功能", cls: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    { match: "新增", cls: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    { match: "Bug", cls: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400" },
    { match: "修复", cls: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400" },
    {
        match: "重构",
        cls: "border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400",
    },
    {
        match: "性能",
        cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
        match: "优化",
        cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
];

function categoryColor(label: string): string {
    for (const rule of labelColorRules) {
        if (label.includes(rule.match)) return rule.cls;
    }
    return "border-edge-hairline bg-muted/30 text-muted-foreground";
}

/**
 * ChangelogSection - B3 更新日志
 *
 * 版本时间线卡片：每版本一张卡，含版本号 + 日期 + 分类 Chip（emoji + label）
 * + 该分类下的条目。当前版本高亮（primary 边框 + 徽章）。长分类折叠 + 展开按钮。
 * breaking change 醒目标记。接口失败/空时优雅降级。
 */
export function ChangelogSection(_: AboutSectionProps) {
    const { data } = useReleases();
    // 展开状态按 tag:label 记：点「展开全部」后保持展开
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    if (!data || data.releases.length === 0) return null;
    const current = data.current_version;

    const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

    return (
        <section className="mx-auto w-full max-w-5xl px-6 py-14">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
            >
                <h2 className="mb-8 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    更新日志
                </h2>
                <div className="relative space-y-6 border-l border-edge-hairline pl-6">
                    {data.releases.map((release, i) => {
                        const isCurrent = release.tag === current;
                        return (
                            <motion.article
                                key={release.tag}
                                initial={{ opacity: 0, x: -10 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.4, delay: i * 0.05 }}
                                className="relative"
                            >
                                {/* 时间线节点：当前版本实心强调，历史版本淡化 */}
                                <span
                                    className={`absolute -left-7.75 top-1.5 size-3 rounded-full border-2 border-background ${
                                        isCurrent ? "bg-primary" : "bg-muted-foreground/40"
                                    }`}
                                />
                                <div
                                    className={`rounded-xl border p-5 ${
                                        isCurrent
                                            ? "border-primary/60 bg-primary/5 shadow-sm"
                                            : "border-edge-hairline bg-background"
                                    }`}
                                >
                                    <div className="mb-3 flex flex-wrap items-center gap-3">
                                        <span className="font-mono text-sm font-semibold">
                                            {release.tag}
                                        </span>
                                        {release.published_at ? (
                                            <span className="text-xs text-muted-foreground">
                                                {formatDate(release.published_at)}
                                            </span>
                                        ) : null}
                                        {isCurrent ? (
                                            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                                                当前版本
                                            </span>
                                        ) : null}
                                        {release.breaking ? (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/50 bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
                                                <TriangleAlert className="size-3.5" />
                                                破坏性变更
                                            </span>
                                        ) : null}
                                    </div>
                                    {release.categories.length > 0 ? (
                                        <div className="space-y-3">
                                            {release.categories.map((cat) => {
                                                const key = `${release.tag}:${cat.label}`;
                                                const showAll =
                                                    expanded[key] ||
                                                    cat.items.length <= COLLAPSE_ITEMS;
                                                const visible = showAll
                                                    ? cat.items
                                                    : cat.items.slice(0, COLLAPSE_ITEMS);
                                                return (
                                                    <div key={cat.label}>
                                                        <span
                                                            className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${categoryColor(cat.label)}`}
                                                        >
                                                            {cat.label}
                                                        </span>
                                                        <ul className="mt-1.5 space-y-1 pl-4 text-sm text-foreground/70 [&>li>p]:my-0 [&>li>p]:leading-6">
                                                            {visible.map((item, idx) => (
                                                                <li key={idx}>
                                                                    <MarkdownContent
                                                                        content={item}
                                                                    />
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        {cat.items.length > COLLAPSE_ITEMS && (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggle(key)}
                                                                className="mt-1.5 pl-4 text-xs font-medium text-primary hover:underline"
                                                            >
                                                                {showAll
                                                                    ? "收起"
                                                                    : `展开全部 ${cat.items.length - COLLAPSE_ITEMS} 条`}
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : release.body ? (
                                        <div className="text-sm text-foreground/70">
                                            <MarkdownContent content={release.body} />
                                        </div>
                                    ) : null}
                                </div>
                            </motion.article>
                        );
                    })}
                </div>
            </motion.div>
        </section>
    );
}
