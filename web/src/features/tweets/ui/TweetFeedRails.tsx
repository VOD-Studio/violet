import { avatarUrl } from "@shared/lib/image-url";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import type { FeedInsights } from "../model/feed-insights";
import { RailCard } from "./profile/UserProfileRail";

/** 时间线左栏：近期话题与活跃作者；没有内容的卡片不渲染。 */
export function TweetFeedLeftRail({
	insights,
	activeTag,
}: {
	insights: FeedInsights;
	activeTag?: string;
}) {
	const { topics, authors } = insights;
	if (topics.length === 0 && authors.length === 0) return null;
	return (
		<>
			{topics.length > 0 && (
				<RailCard title="近期话题" aside="已加载的推文">
					<ul className="flex flex-col gap-1">
						{topics.map(({ tag, count }) => (
							<li key={tag}>
								<Link
									to="/tweets/topics/$tag"
									params={{ tag }}
									aria-current={tag === activeTag ? "page" : undefined}
									className={cn(
										"flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors",
										tag === activeTag
											? "bg-primary/10 font-medium text-primary"
											: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
									)}
								>
									<span className="truncate">#{tag}#</span>
									<span className="text-xs tabular-nums">{count}</span>
								</Link>
							</li>
						))}
					</ul>
				</RailCard>
			)}
			{authors.length > 0 && (
				<RailCard title="活跃作者">
					<ul className="flex flex-col gap-1">
						{authors.map((author) => (
							<li key={author.id}>
								<Link
									to="/users/$username"
									params={{ username: author.username }}
									className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent"
								>
									<img
										src={avatarUrl(author.avatarUrl, author.username)}
										alt=""
										loading="lazy"
										className="size-6 shrink-0 rounded-full object-cover"
									/>
									<span className="min-w-0 flex-1 truncate">
										{author.username}
									</span>
									<span className="text-xs text-muted-foreground tabular-nums">
										{author.count} 条
									</span>
								</Link>
							</li>
						))}
					</ul>
				</RailCard>
			)}
		</>
	);
}

/** 时间线右栏：最近的图片墙，点击进入对应推文。 */
export function TweetFeedRightRail({ insights }: { insights: FeedInsights }) {
	if (insights.photos.length === 0) return null;
	return (
		<RailCard title="最近的图片">
			<ul className="grid grid-cols-3 gap-1.5">
				{insights.photos.map((photo) => (
					<li key={photo.src} className="aspect-square">
						<Link
							to="/tweets/$id"
							params={{ id: photo.tweetId }}
							aria-label="查看这张图片所在的推文"
							className="block size-full overflow-hidden rounded-lg bg-muted ring-1 ring-border ring-inset transition-opacity hover:opacity-80"
						>
							<img
								src={photo.src}
								alt=""
								loading="lazy"
								referrerPolicy="no-referrer"
								className="size-full object-cover"
							/>
						</Link>
					</li>
				))}
			</ul>
		</RailCard>
	);
}
