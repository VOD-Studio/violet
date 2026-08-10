import TweetTimeline from "@features/tweets/ui/TweetTimeline";
import { PageShell } from "@shared/ui/page-shell";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Hash } from "lucide-react";

function TopicTimelinePage() {
	const { tag } = Route.useParams();
	const navigate = useNavigate();

	return (
		<PageShell>
			<div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
				<button
					type="button"
					onClick={() => navigate({ to: "/tweets" })}
					className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				>
					<ArrowLeft className="size-3.5" />
					返回时间线
				</button>

				<header className="mb-4 flex items-center gap-3">
					<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<Hash className="size-5" />
					</div>
					<div>
						<h1 className="font-mono text-2xl font-bold">#{tag}#</h1>
						<p className="text-xs text-muted-foreground">话题聚合时间线</p>
					</div>
				</header>

				<TweetTimeline tag={tag} />
			</div>
		</PageShell>
	);
}

export const Route = createFileRoute("/tweets/topics/$tag")({
	component: TopicTimelinePage,
	head: ({ params }) => ({
		meta: [
			{ title: `#${params.tag}# 话题 - 推文` },
			{ name: "description", content: `#${params.tag}# 话题下的推文动态` },
		],
	}),
});
