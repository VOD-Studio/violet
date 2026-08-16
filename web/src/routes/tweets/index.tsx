import { TweetTimeline } from "@features/tweets/ui/TweetTimeline";
import { PageShell } from "@shared/ui/page-shell";
import { createFileRoute } from "@tanstack/react-router";

/** /tweets - 全局推文时间线（公开）：登录态见发布框，匿名只见时间线，cursor 滚动加载 */
function TweetsPage() {
	return (
		<PageShell>
			{/* 页头随时间线同列对齐(话题页同构),避免贴宽容器左缘与内容错位 */}
			<div className="mx-auto w-full max-w-2xl">
				<header className="mb-10">
					<p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
						Timeline
					</p>
					<h1 className="font-mono text-4xl font-bold">推文</h1>
				</header>
				<TweetTimeline />
			</div>
		</PageShell>
	);
}

export const Route = createFileRoute("/tweets/")({
	component: TweetsPage,
});
