import { TweetTimeline } from "@features/tweets/ui/TweetTimeline";
import { PageHeader } from "@shared/ui/page-header";
import { PageShell } from "@shared/ui/page-shell";
import { createFileRoute } from "@tanstack/react-router";

/** /tweets - 全局推文时间线（公开）：登录态见发布框，匿名只见时间线，cursor 滚动加载 */
function TweetsPage() {
	return (
		<PageShell>
			{/* 页头随时间线同列对齐(话题页同构),避免贴宽容器左缘与内容错位 */}
			<div className="mx-auto w-full max-w-2xl">
				<PageHeader eyebrow="Timeline" title="推文" />
				<TweetTimeline />
			</div>
		</PageShell>
	);
}

export const Route = createFileRoute("/tweets/")({
	component: TweetsPage,
});
