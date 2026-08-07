import { TweetTimeline } from "@features/tweets/ui/TweetTimeline";
import { PageShell } from "@shared/ui/page-shell";
import { createFileRoute } from "@tanstack/react-router";

/**
 * /tweets - 全局推文时间线（公开）
 *
 * 登录态见发布框在顶部，匿名只见时间线。cursor 滚动加载。
 * 详情页 /tweets/$id 由后续 ticket 接入（故用目录式路由）。
 */
function TweetsPage() {
	return (
		<PageShell>
			<header className="mb-8">
				<p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
					Timeline
				</p>
				<h1 className="font-mono text-4xl font-bold">推文</h1>
			</header>
			<TweetTimeline />
		</PageShell>
	);
}

export const Route = createFileRoute("/tweets/")({
	component: TweetsPage,
});
