import type { Tweet } from "@entities/tweet/model/types";
import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle } from "lucide-react";
import { motion } from "motion/react";
import { HomeContentLink } from "./HomeContentLink";
import { formatHomeDate, HOME_KIND_LABEL } from "./home-content";
import type { HomePublicationItem } from "./types";

interface HomeIndexProps {
	items: HomePublicationItem[];
	tweets: Tweet[];
}

type HomeActivity =
	| { key: string; kind: "publication"; publishedAt: string; item: HomePublicationItem }
	| { key: string; kind: "tweet"; publishedAt: string; tweet: Tweet };

/** 最近发布与动态使用双栏轻量列表，不把内容装进等权卡片。 */
export function HomeIndex({ items, tweets }: HomeIndexProps) {
	const articles = items.filter((item) => item.kind === "article").slice(0, 5);
	const notes = items.filter((item) => item.kind === "note").slice(0, 4);
	const primaryItems = articles.length > 0 ? articles : items.slice(0, 5);
	const activities: HomeActivity[] = [
		...items.slice(0, 6).map((item) => ({
			key: item.key,
			kind: "publication" as const,
			publishedAt: item.publishedAt,
			item,
		})),
		...tweets.slice(0, 4).map((tweet) => ({
			key: `tweet-${tweet.id}`,
			kind: "tweet" as const,
			publishedAt: tweet.created_at,
			tweet,
		})),
	]
		.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
		.slice(0, 8);

	if (primaryItems.length === 0 && activities.length === 0) return null;
	const transition = { type: "spring" as const, stiffness: 130, damping: 21, mass: 0.9 };

	return (
		<section
			id="recent"
			className="mx-auto max-w-7xl scroll-mt-24 px-5 pt-20 sm:px-8 lg:px-12 lg:pt-28"
		>
			<div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-16 lg:grid-cols-2 lg:gap-24">
				<motion.div
					className="min-w-0"
					initial={false}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, amount: 0.2 }}
					transition={transition}
				>
					<PublicationGroup
						title={articles.length > 0 ? "最近文章" : "最近发布"}
						items={primaryItems}
						moreTo="/blog"
					/>
					{notes.length > 0 ? (
						<div className="mt-12 border-t border-border pt-10">
							<PublicationGroup title="最近笔记" items={notes} moreTo="/notes" />
						</div>
					) : null}
				</motion.div>

				{activities.length > 0 ? (
					<motion.div
						className="min-w-0"
						initial={false}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, amount: 0.2 }}
						transition={{ ...transition, delay: 0.08 }}
					>
						<h2 className="text-2xl leading-loose font-medium tracking-[-0.02em]">
							最近动态
						</h2>
						<div className="mt-6 max-h-112 overflow-y-auto pr-3">
							<ul className="relative space-y-6 before:absolute before:top-3 before:bottom-3 before:left-3 before:w-px before:bg-border">
								{activities.map((activity) => (
									<ActivityRow key={activity.key} activity={activity} />
								))}
							</ul>
						</div>
						<Link
							to="/tweets"
							className="mt-7 flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
						>
							查看推文时间线
							<ArrowRight className="size-4" />
						</Link>
					</motion.div>
				) : null}
			</div>
		</section>
	);
}

function PublicationGroup({
	title,
	items,
	moreTo,
}: {
	title: string;
	items: HomePublicationItem[];
	moreTo: "/blog" | "/notes";
}) {
	return (
		<div className="min-w-0">
			<h2 className="text-2xl leading-loose font-medium tracking-[-0.02em]">{title}</h2>
			<ul className="mt-6 min-w-0 space-y-1">
				{items.map((item) => (
					<li key={item.key} className="min-w-0">
						<HomeContentLink
							item={item}
							className="group flex w-full min-w-0 items-baseline justify-between gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
						>
							<span className="min-w-0 truncate text-[0.95rem] font-medium transition-colors group-hover:text-primary">
								{item.title}
							</span>
							<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
								{formatHomeDate(item.publishedAt)}
							</span>
						</HomeContentLink>
					</li>
				))}
			</ul>
			<Link
				to={moreTo}
				className="mt-5 flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
			>
				查看更多
				<ArrowRight className="size-4" />
			</Link>
		</div>
	);
}

function ActivityRow({ activity }: { activity: HomeActivity }) {
	if (activity.kind === "tweet") {
		const { tweet } = activity;
		const summary =
			tweet.content.trim() ||
			(tweet.images.length > 0 ? `发布了 ${tweet.images.length} 张图片` : "发布了一条推文");
		return (
			<li className="relative flex gap-4 pl-9">
				<span className="absolute left-0 z-10 flex size-6 items-center justify-center rounded-full border border-primary/30 bg-background text-primary">
					<MessageCircle className="size-3" />
				</span>
				<div className="min-w-0 pb-1">
					<p className="text-xs text-muted-foreground">
						@{tweet.author.username} · {formatHomeDate(tweet.created_at)}
					</p>
					<Link
						to="/tweets/$id"
						params={{ id: tweet.id }}
						className="mt-2 block rounded-xl rounded-tl-sm bg-muted/70 px-3 py-2.5 text-sm leading-6 text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary line-clamp-3"
					>
						{summary}
					</Link>
				</div>
			</li>
		);
	}

	return (
		<li className="relative flex gap-4 pl-9">
			<span className="absolute left-0 z-10 flex size-6 items-center justify-center rounded-full border border-primary/30 bg-background">
				<span className="size-1.5 rounded-full bg-primary" />
			</span>
			<div className="min-w-0 pb-1">
				<p className="text-xs text-muted-foreground">
					发布了{HOME_KIND_LABEL[activity.item.kind]} ·{" "}
					{formatHomeDate(activity.publishedAt)}
				</p>
				<HomeContentLink
					item={activity.item}
					className="mt-1 block truncate text-sm font-medium transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
				>
					{activity.item.title}
				</HomeContentLink>
			</div>
		</li>
	);
}
