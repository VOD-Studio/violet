import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface PostListCardProps {
	title: string;
	posts?: Array<{
		id: string;
		title: string;
		slug: string;
		status: string;
		view_count: number;
		published_at?: string;
	}>;
}

/**
 * PostListCard - 仪表盘文章列表卡片
 */
export function PostListCard({ title, posts }: PostListCardProps) {
	const safePosts = posts ?? [];
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{safePosts.length === 0 ? (
					<p className="text-sm text-muted-foreground">暂无文章</p>
				) : (
					<ul className="space-y-3 text-sm">
						{safePosts.map((post) => (
							<li key={post?.id ?? Math.random()} className="flex items-center justify-between">
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium">{post?.title ?? "—"}</p>
									<p className="text-xs text-muted-foreground">
										{post?.published_at
											? formatDistanceToNow(new Date(post.published_at), {
													addSuffix: true,
													locale: zhCN,
												})
											: "未发布"}
									</p>
								</div>
								<span className="font-mono text-xs text-muted-foreground">
									{post?.view_count ?? 0} 浏览
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
