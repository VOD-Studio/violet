import { Badge } from "@shared/ui/base/badge";
import { Card, CardContent } from "@shared/ui/base/card";
import { format } from "date-fns";
import { Clock3 } from "lucide-react";
import type { PostSummaryDTO } from "../model/types";

/**
 * 最近发布时间线卡。
 *
 * 后端按 created_at DESC 取 5 条（含 draft）；状态徽章区分草稿/已发布。
 */
export function RecentPostsTile({ posts }: { posts: PostSummaryDTO[] }) {
	return (
		<Card className="border-border/60">
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
					<ul className="flex flex-1 flex-col justify-center">
						{posts.map((post) => (
							<li
								key={post.id}
								className="border-border/60 flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0 last:pb-0 first:pt-0"
							>
								<div className="flex min-w-0 items-center gap-2">
									<span className="text-muted-foreground size-1.5 shrink-0 rounded-full bg-current" />
									<span className="truncate text-sm">{post.title}</span>
									{post.status !== "published" && (
										<Badge variant="secondary" className="shrink-0">
											{post.status === "draft" ? "草稿" : post.status}
										</Badge>
									)}
								</div>
								<span className="text-muted-foreground shrink-0 text-xs tabular-nums">
									{post.published_at
										? format(new Date(post.published_at), "MM-dd HH:mm")
										: "未发布"}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
