import { format } from "date-fns";
import type { PostSummaryDTO } from "../model/types";
import { TermPane } from "./TermPane";

/**
 * 最近发布时间线窗格。
 *
 * 后端口径：仅 published、按 published_at DESC 取 5 条，发布时间必有值。
 */
export function RecentPostsTile({ posts }: { posts: PostSummaryDTO[] }) {
	return (
		<TermPane tag="~/recent" title="最近发布" className="h-full">
			{posts.length === 0 ? (
				<div className="text-muted-foreground flex h-full min-h-24 flex-col items-center justify-center gap-1 text-sm">
					<span>还没有文章</span>
					<span className="text-muted-foreground/70 text-xs">
						写下第一篇，驾驶舱从这里开始记录
					</span>
				</div>
			) : (
				<ul className="flex flex-col pt-1">
					{posts.map((post) => (
						<li
							key={post.id}
							className="border-edge-hairline flex items-center justify-between gap-3 border-b py-2.5 first:pt-0 last:border-b-0 last:pb-0"
						>
							<div className="flex min-w-0 items-center gap-2">
								<span className="text-muted-foreground size-1.5 shrink-0 rounded-full bg-current" />
								<span className="truncate text-sm">{post.title}</span>
							</div>
							<span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
								{post.published_at
									? format(new Date(post.published_at), "MM-dd HH:mm")
									: "—"}
							</span>
						</li>
					))}
				</ul>
			)}
		</TermPane>
	);
}
