import { formatDate } from "@features/about/model/format";
import { useReleases } from "@shared/api/releases";
import { Button } from "@shared/ui/base/button";
import Empty from "@shared/ui/empty";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { ChangelogPageSkeleton } from "./ChangelogPageSkeleton";

/** 单分类条目超过该数折叠（如 v2.2.0 的「新增」23 条），点「展开全部」兜底 */
const COLLAPSE_ITEMS = 6;

/** 分类标签配色：浅底深字 badge（对齐全站 severity 标签范式），按 label 关键词匹配 */
const labelColorRules: { match: string; cls: string }[] = [
	{ match: "破坏", cls: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
	{ match: "新功能", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
	{ match: "新增", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
	{ match: "Bug", cls: "bg-red-500/10 text-red-600 dark:text-red-400" },
	{ match: "修复", cls: "bg-red-500/10 text-red-600 dark:text-red-400" },
	{ match: "重构", cls: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
	{ match: "性能", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
	{ match: "优化", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
];

function categoryColor(label: string): string {
	for (const rule of labelColorRules) {
		if (label.includes(rule.match)) return rule.cls;
	}
	return "bg-muted/50 text-muted-foreground";
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
 * 视觉对齐全站语言：页面标题 font-mono text-4xl font-bold（博客页同款），
 * 分类用浅底深字 badge（severity 范式），条目 text-base 舒朗排版。
 * 时间线：左侧竖线 + 圆点；当前版本 primary 高亮 + 实心徽章。
 */
export function ChangelogPage() {
	const { data, isPending, error, refetch } = useReleases();
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});

	// 加载中：整页骨架屏（布局 1:1 模拟，避免白屏跳变）
	if (isPending) return <ChangelogPageSkeleton />;

	// 失败：错误态 + 重试（独立页无内容可降级，必须可重试）
	if (error) {
		return (
			<main className="mx-auto w-full max-w-4xl px-6 py-20">
				<Empty
					title="加载失败"
					description={error instanceof Error ? error.message : "未知错误"}
					action={
						<Button variant="outline" size="sm" onClick={() => refetch()}>
							<RefreshCw className="size-3.5" />
							重试
						</Button>
					}
					className="py-20"
				/>
			</main>
		);
	}

	if (!data || data.releases.length === 0) return null;

	const current = data.current_version;
	const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

	return (
		<main className="mx-auto w-full max-w-4xl px-6 py-20">
			<header className="mb-16">
				<p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
					Updates
				</p>
				<h1 className="font-mono text-4xl font-bold tracking-tight">更新日志</h1>
				<p className="mt-3 text-base text-muted-foreground">本站各版本的变更记录</p>
			</header>

			<div className="relative space-y-14 border-l border-edge-hairline pl-10">
				{data.releases.map((release) => {
					const isCurrent = release.tag === current;
					return (
						<article key={release.tag} className="relative">
							{/* 时间线节点：当前版本实心强调，历史版本淡化 */}
							<span
								className={`absolute -left-11.75 top-2 size-3.5 rounded-full border-2 border-background ${
									isCurrent ? "bg-primary" : "bg-muted-foreground/40"
								}`}
							/>
							<div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
								<h2 className="font-mono text-2xl font-bold tracking-tight">
									{release.tag}
								</h2>
								{release.published_at ? (
									<span className="text-sm text-muted-foreground">
										{formatDate(release.published_at)}
									</span>
								) : null}
								{isCurrent ? (
									<span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
										当前版本
									</span>
								) : null}
								{release.breaking ? (
									<span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold text-orange-600 dark:text-orange-400">
										<TriangleAlert className="size-3.5" />
										破坏性变更
									</span>
								) : null}
							</div>

							{release.categories.length > 0 ? (
								<div className="mt-6 space-y-7">
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
													className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${categoryColor(cat.label)}`}
												>
													{cat.label}
												</h3>
												<ul className="mt-3 space-y-2.5">
													{visible.map((item, idx) => {
														const { scope, rest } = splitItem(item);
														return (
															<li
																key={idx}
																className="break-words text-base leading-relaxed text-foreground/80"
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
														className="mt-2.5 text-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
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
