import { Card, CardContent } from "@shared/ui/base/card";
import { format } from "date-fns";
import { Clock3 } from "lucide-react";
import type { PostSummaryDTO } from "../model/types";

/**
 * 最近发布时间线卡。
 *
 * 后端口径：仅 published、按 published_at DESC 取 5 条，发布时间必有值。
 */
export function RecentPostsTile({ posts }: { posts: PostSummaryDTO[] }) {
	return (
		<Card className="border-border/60 h-full">
			<CardContent className="flex h-full flex-col gap-3 p-6">
				<div className="flex items-center justify-between">
					<span className="text-sm font-medium">最近发布</span>
					<Clock3 className="text-muted-foreground size-4" />
				</div>
				{posts.length === 0 ? (
					<div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-1 text-sm">
						<span>还没有文章</span>
						<span className="text-muted-foreground/70 text-xs">
							写下第一篇，驾驶舱从这里开始记录
						</span>
					</div>
				) : (
					<ul className="flex flex-col">
						{posts.map((post) => (
							<li
								key={post.id}
								className="border-border/60 flex items-center justify-between gap-3 border-b py-2.5 first:pt-0 last:border-b-0 last:pb-0"
							>
								<div className="flex min-w-0 items-center gap-2">
									<span className="text-muted-foreground size-1.5 shrink-0 rounded-full bg-current" />
									<span className="truncate text-sm">{post.title}</span>
								</div>
								<span className="text-muted-foreground shrink-0 text-xs tabular-nums">
									{post.published_at
										? format(new Date(post.published_at), "MM-dd HH:mm")
										: "—"}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
