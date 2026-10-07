import { TweetTimeline } from "@features/tweets/ui/TweetTimeline";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@violet/ui";

/** /tweets - 全局推文时间线（公开）：登录态见发布框，匿名只见时间线，cursor 滚动加载 */
function TweetsPage() {
	return (
		<PageShell>
			<div className="mx-auto w-full max-w-3xl">
				<header className="mb-6 px-1">
					<h1 className="font-mono text-3xl font-bold tracking-tight">推文</h1>
				</header>
				<TweetTimeline />
			</div>
		</PageShell>
	);
}

export const Route = createFileRoute("/tweets/")({
	component: TweetsPage,
});
