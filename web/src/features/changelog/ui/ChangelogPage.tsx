import { formatDate } from "@features/about/model/format";
import { useScrollSpy } from "@features/changelog/hooks/use-scroll-spy";
import { cleanItem, groupItems } from "@features/changelog/model/clean-item";
import { VersionNav, versionAnchorId } from "@features/changelog/ui/VersionNav";
import { useReleases } from "@shared/api/releases";
import { Button } from "@shared/ui/base/button";
import Empty from "@shared/ui/empty";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { ChangelogPageSkeleton } from "./ChangelogPageSkeleton";

/** 单分类条目超过该数折叠（如 v2.4.0 的「修复」18 条），点「展开全部」兜底 */
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

/**
 * ChangelogPage - 更新日志独立页（/changelog）
 *
 * 布局：桌面端左 sticky 版本目录（scroll-spy 高亮阅读位置）+ 右侧时间线；
 * 移动端版本目录收成吸顶横向 chip 条。条目经 cleanItem 清洗（issue 引用
 * 收成行尾小链接、任务号剥除），同分类内 ≥2 次的 scope 聚合为子组。
 */
export function ChangelogPage() {
	const { data, isPending, error, refetch } = useReleases();
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});

	const anchorIds = useMemo(
		() => (data?.releases ?? []).map((r) => versionAnchorId(r.tag)),
		[data],
	);
	const activeId = useScrollSpy(anchorIds);

	// 加载中：整页骨架屏（布局 1:1 模拟，避免白屏跳变）
	if (isPending) return <ChangelogPageSkeleton />;

	// 失败：错误态 + 重试（独立页无内容可降级，必须可重试）
	if (error) {
		return (
			<main className="mx-auto w-full max-w-4xl px-6 py-20">
				<Empty
					title="更新日志加载失败"
					description="无法获取版本发布记录，请稍后重试"
					action={
						<Button variant="outline" size="sm" onClick={() => refetch()}>
							<RefreshCw className="size-4" />
							重试
						</Button>
					}
				/>
			</main>
		);
	}

	if (!data || data.releases.length === 0) return null;

	const current = data.current_version;
	const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
	const navItems = data.releases.map((r) => ({
		tag: r.tag,
		itemCount: r.categories.reduce((n, c) => n + c.items.length, 0),
	}));

	return (
		<main className="mx-auto w-full max-w-6xl px-6 py-20">
			<header className="mb-16">
				<p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
					Updates
				</p>
				<h1 className="font-mono text-4xl font-bold tracking-tight">更新日志</h1>
				<p className="mt-3 text-base text-muted-foreground">本站各版本的变更记录</p>
			</header>

			<div className="lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-16">
				<VersionNav items={navItems} current={current} activeId={activeId} />

				<div className="relative space-y-14 lg:border-l lg:border-edge-hairline lg:pl-10">
					{data.releases.map((release) => {
						const isCurrent = release.tag === current;
						return (
							<article
								key={release.tag}
								id={versionAnchorId(release.tag)}
								// 吸顶 Header(h-16) + 移动端 chip 条：锚点跳转需留出遮挡高度
								className="relative scroll-mt-32 lg:scroll-mt-24"
							>
								{/* 时间线节点：当前版本实心强调，历史版本淡化；移动端无时间线不渲染 */}
								<span
									className={`absolute top-2 -left-11.75 hidden size-3.5 rounded-full border-2 border-background lg:block ${
										isCurrent ? "bg-primary" : "bg-muted-foreground/40"
									}`}
								/>
								<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
									<h2 className="font-mono text-2xl font-bold tracking-tight">
										{release.tag}
									</h2>
									{release.published_at ? (
										<span className="text-sm text-muted-foreground">
											{formatDate(release.published_at)}
										</span>
									) : null}
									{isCurrent ? (
										<span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
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
											const groups = groupItems(cat.items.map(cleanItem));
											// 折叠按条目数跨组截断；组内可见条目为空则不渲染该组
											let budget = showAll
												? Number.POSITIVE_INFINITY
												: COLLAPSE_ITEMS;
											return (
												<section key={cat.label}>
													<h3
														className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${categoryColor(cat.label)}`}
													>
														{cat.label}
													</h3>
													<div className="mt-4 space-y-5">
														{groups.map((g) => {
															if (budget <= 0) return null;
															const visible = g.items.slice(
																0,
																budget,
															);
															budget -= visible.length;
															return (
																<div key={g.scope ?? "loose"}>
																	{g.scope ? (
																		<p className="mb-1.5 text-sm font-semibold text-foreground">
																			{g.scope}
																		</p>
																	) : null}
																	<ul className="list-disc space-y-2.5 pl-5 marker:text-muted-foreground/40">
																		{visible.map(
																			(item, idx) => (
																				<li
																					key={idx}
																					className="wrap-break-word text-base leading-relaxed text-foreground/80"
																				>
																					{item.text}
																					{item.refs.map(
																						(ref) => (
																							<a
																								key={
																									ref.label
																								}
																								href={
																									ref.url
																								}
																								target="_blank"
																								rel="noreferrer"
																								className="ml-1.5 align-baseline text-xs font-medium text-muted-foreground/70 underline decoration-muted-foreground/30 underline-offset-2 transition-colors hover:text-primary hover:decoration-primary/50"
																							>
																								{
																									ref.label
																								}
																							</a>
																						),
																					)}
																				</li>
																			),
																		)}
																	</ul>
																</div>
															);
														})}
													</div>
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
			</div>
		</main>
	);
}
