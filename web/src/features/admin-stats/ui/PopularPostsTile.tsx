import { Link } from "@tanstack/react-router";
import type { PostSummaryDTO } from "../model/types";
import { TermPane } from "./TermPane";

/**
 * 热门文章排行窗格。
 *
 * 仅 published 文章（后端口径）；横条宽度 = 浏览量相对榜首比例。
 * 新标签打开：从后台预览前台渲染是旁路查看，不打断后台工作流。
 */
export function PopularPostsTile({ posts }: { posts: PostSummaryDTO[] }) {
	const max = Math.max(...posts.map((p) => p.view_count), 1);
	return (
		<TermPane tag="~/top" title="热门文章" className="h-full">
			{posts.length === 0 ? (
				<div className="text-muted-foreground flex h-full min-h-24 items-center justify-center text-sm">
					暂无热门文章
				</div>
			) : (
				<ul className="flex flex-col gap-1.5 pt-1">
					{posts.map((post, i) => (
						<li key={post.id} className="group">
							<Link
								to="/blog/$slug"
								params={{ slug: post.slug }}
								target="_blank"
								rel="noreferrer"
								title={post.title}
								className="hover:bg-accent/60 -mx-3 block rounded-md px-3 py-2 transition-colors"
							>
								<div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
									<span className="truncate group-hover:text-primary transition-colors">
										<span className="text-muted-foreground mr-1.5 inline-block w-4 font-mono text-xs tabular-nums">
											{i + 1}
										</span>
										{post.title}
									</span>
									<span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
										{post.view_count}
									</span>
								</div>
								<div className="bg-secondary h-1 overflow-hidden rounded-full">
									<div
										className="from-chart-1 to-chart-2 h-full rounded-full bg-linear-to-r"
										style={{ width: `${(post.view_count / max) * 100}%` }}
									/>
								</div>
							</Link>
						</li>
					))}
				</ul>
			)}
		</TermPane>
	);
}
