import { type Release, useReleases } from "@features/about/api/queries";
import { motion } from "motion/react";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

/** 手工里程碑（对齐 project_milestones JSON 的 milestones 数组项） */
interface Milestone {
    date: string;
    title: string;
    description?: string;
    link?: string;
}

/** 时间轴节点（统一 releases 与里程碑两种来源） */
interface TimelineNode {
    /** 排序与显示用的日期（ISO） */
    date: string;
    /** 节点类型 */
    type: "release" | "milestone";
    /** release 数据（type=release 时） */
    release?: Release;
    /** milestone 数据（type=milestone 时） */
    milestone?: Milestone;
}

/**
 * ProjectTimelineSection - B4 项目时间轴
 *
 * 把更新日志（releases）节点与手工里程碑（project_milestones）合并，
 * 按时间倒序排成一条项目历程叙事线，区分两类节点。
 * 复用 useReleases 数据；里程碑从 settings.project_milestones 解析。
 */
export function ProjectTimelineSection({ settings }: AboutSectionProps) {
    const { data: releasesData } = useReleases();
    const milestones = parseMilestones(settings.project_milestones);

    const releases = releasesData?.releases ?? [];
    if (releases.length === 0 && milestones.length === 0) return null;

    // 合并为统一节点
    const nodes: TimelineNode[] = [
        ...releases.map((r) => ({
            date: r.published_at,
            type: "release" as const,
            release: r,
        })),
        ...milestones.map((m) => ({
            date: m.date,
            type: "milestone" as const,
            milestone: m,
        })),
    ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // 倒序

    return (
        <section className="container mx-auto px-6 py-20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="mx-auto max-w-2xl"
            >
                <h2 className="mb-8 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    项目历程
                </h2>
                <div className="relative space-y-6 border-l border-edge-hairline pl-6">
                    {nodes.map((node, i) => (
                        <motion.div
                            key={`${node.type}-${node.date}-${i}`}
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, delay: i * 0.05 }}
                            className="relative"
                        >
                            <span
                                className={`absolute -left-[31px] top-1.5 size-3 rounded-full border-2 border-background ${
                                    node.type === "milestone" ? "bg-amber-500" : "bg-primary"
                                }`}
                            />
                            <div className="rounded-xl border border-edge-hairline bg-background p-5">
                                <div className="mb-1 flex items-center gap-2">
                                    {node.type === "milestone" ? (
                                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                                            里程碑
                                        </span>
                                    ) : (
                                        <span className="font-mono text-sm font-semibold">
                                            {node.release?.tag}
                                        </span>
                                    )}
                                    {node.date ? (
                                        <span className="text-xs text-muted-foreground">
                                            {formatDate(node.date)}
                                        </span>
                                    ) : null}
                                </div>
                                {node.type === "milestone" && node.milestone ? (
                                    <div>
                                        <p className="font-medium">{node.milestone.title}</p>
                                        {node.milestone.description ? (
                                            <p className="mt-1 text-sm text-foreground/70">
                                                {node.milestone.description}
                                            </p>
                                        ) : null}
                                    </div>
                                ) : node.release?.name ? (
                                    <p className="text-sm text-foreground/70">
                                        {node.release.name}
                                    </p>
                                ) : null}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </section>
    );
}

/** parseMilestones 解析 project_milestones JSON（容错回退空） */
function parseMilestones(raw: string | undefined | null): Milestone[] {
    if (!raw || raw.trim() === "") return [];
    try {
        const parsed = JSON.parse(raw) as { milestones?: Milestone[] };
        if (!Array.isArray(parsed.milestones)) return [];
        return parsed.milestones;
    } catch {
        return [];
    }
}

/** formatDate - 格式化 ISO 日期为 YYYY-MM-DD */
function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
