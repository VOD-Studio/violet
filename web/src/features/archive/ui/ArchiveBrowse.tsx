import type { PostBrowseFilter } from "@entities/post/model/types";
import { Link } from "@tanstack/react-router";
import { Button, Empty, Tag } from "@violet/ui";
import { useEffect, useRef, useState } from "react";
import { useArchiveYear, useArchiveYears } from "../api/queries";
import type { ArchiveItem } from "../model/types";
import ArchiveSkeleton from "./ArchiveSkeleton";
import ArchiveYearSkeleton from "./ArchiveYearSkeleton";

function groupByMonth(items: ArchiveItem[]) {
	const months = new Map<number, ArchiveItem[]>();
	for (const item of items) {
		const month = new Date(item.published_at).getUTCMonth() + 1;
		const group = months.get(month);
		if (group) group.push(item);
		else months.set(month, [item]);
	}
	return [...months.entries()].sort(([a], [b]) => b - a);
}

interface ArchiveYearSectionProps {
	year: number;
	filter: PostBrowseFilter;
	/** 最近年由SSR预取；其余年份接近视口或被年份链接选中时才请求。 */
	initiallyActive: boolean;
}

function ArchiveYearSection({ year, filter, initiallyActive }: ArchiveYearSectionProps) {
	const ref = useRef<HTMLElement>(null);
	const [visible, setVisible] = useState(false);
	const { data, isLoading, isError, refetch } = useArchiveYear(
		year,
		filter,
		initiallyActive || visible,
	);
	useEffect(() => {
		if (initiallyActive || visible || !ref.current) return;
		const activateHash = () => {
			if (window.location.hash === `#year-${year}`) setVisible(true);
		};
		activateHash();
		window.addEventListener("hashchange", activateHash);
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
			},
			{ rootMargin: "200px" },
		);
		observer.observe(ref.current);
		return () => {
			observer.disconnect();
			window.removeEventListener("hashchange", activateHash);
		};
	}, [initiallyActive, visible, year]);
	return (
		<section ref={ref} id={`year-${year}`} className="scroll-mt-24">
			<h2 className="mb-5 flex items-baseline gap-3 text-2xl">
				<span>{year}</span>
				{data ? (
					<span className="text-sm text-muted-foreground">{data.count} 篇</span>
				) : null}
			</h2>
			{isError ? (
				<Empty
					title="这一年暂时加载失败"
					description="其他年份仍可浏览。"
					action={
						<Button variant="outline" size="sm" onClick={() => void refetch()}>
							重试
						</Button>
					}
				/>
			) : isLoading || !data ? (
				<ArchiveYearSkeleton year={year} />
			) : (
				<div className="space-y-6">
					{groupByMonth(data.items ?? []).map(([month, items]) => (
						<div key={month}>
							<h3 className="mb-2 text-sm text-muted-foreground">{month} 月</h3>
							<ul className="space-y-3 border-l border-border pl-4">
								{items.map((item) => (
									<li key={item.id} className="flex items-baseline gap-3">
										<time
											dateTime={item.published_at}
											className="shrink-0 font-mono text-xs text-muted-foreground"
										>
											{String(
												new Date(item.published_at).getUTCDate(),
											).padStart(2, "0")}
										</time>
										<div className="min-w-0">
											<Link
												to="/blog/$slug"
												params={{ slug: item.slug }}
												className="rounded-sm wrap-break-word underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
											>
												{item.title}
											</Link>
											{item.tags?.length ? (
												<div className="mt-1.5 flex flex-wrap gap-1">
													{item.tags.map((tag) => (
														<Tag key={tag} size="sm">
															{tag}
														</Tag>
													))}
												</div>
											) : null}
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

/** 归档仅展示同时满足标签与来源的公开文章。 */
export interface ArchiveBrowseProps {
	filter: PostBrowseFilter;
}

/** 保留按年懒加载；首个年份在SSR和水合首帧都直接激活。 */
export function ArchiveBrowse({ filter }: ArchiveBrowseProps) {
	const { data, isLoading, isError, refetch } = useArchiveYears(filter);
	if (isLoading) return <ArchiveSkeleton />;
	if (isError)
		return (
			<Empty
				title="归档暂时加载失败"
				description="请重试，筛选条件会保留。"
				action={<Button onClick={() => void refetch()}>重试</Button>}
			/>
		);
	const years = data?.years ?? [];
	if (!years.length)
		return <Empty title="暂无匹配文章" description="可以更换标签或文章来源，查看其他记录。" />;
	return (
		<div>
			<nav aria-label="归档年份" className="mb-10 flex flex-wrap gap-2">
				{years.map((year) => (
					<Button key={year} variant="ghost" size="sm" asChild>
						<a href={`#year-${year}`}>{year}</a>
					</Button>
				))}
			</nav>
			<div className="space-y-12">
				{years.map((year, index) => (
					<ArchiveYearSection
						key={`${filter.tag ?? ""}:${filter.source ?? ""}:${year}`}
						year={year}
						filter={filter}
						initiallyActive={index === 0}
					/>
				))}
			</div>
		</div>
	);
}
