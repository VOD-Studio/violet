import type { AdminComment } from "@entities/comment/model/types";
import type { Tweet } from "@entities/tweet/model/types";
import { formatDate, formatRelativeTime } from "@shared/lib/date";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "@violet/ui";
import { ArrowRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { motion } from "motion/react";

import { HomeContentLink } from "./HomeContentLink";
import { HomeMissives } from "./HomeMissives";
import { HOME_KIND_LABEL } from "./home-content";
import type { HomePublicationItem } from "./types";

/** 首页近稿与偶得区块的资源状态。 */
export interface HomeIndexProps {
	items: HomePublicationItem[];
	tweets: Tweet[];
	publicationError: boolean;
	publicationRetrying: boolean;
	/** 仅重试关键发布物资源，不刷新整页。 */
	onRetryPublications: () => void;
	tweetsLoading: boolean;
	/** 尺素橱窗的最新已审核评论（调用方已滤掉纯图评论） */
	missives: AdminComment[];
	missivesLoading: boolean;
}

/**
 * 格式化相对时间：30 天内显示「X天前 / X小时前」，更久显示年月日。
 */
function formatRelativeOrDate(dateString: string): string {
	const date = new Date(dateString);
	if (Number.isNaN(date.getTime())) return dateString;
	const diffMs = Date.now() - date.getTime();
	const diffDays = Math.floor(diffMs / 86_400_000);
	if (diffDays < 30 && diffDays >= 0) {
		return formatRelativeTime(date);
	}
	return formatDate(date, "dotted-date");
}

/** 首页近稿与偶得尺素双栏布局。 */
export function HomeIndex({
	items,
	tweets,
	publicationError,
	publicationRetrying,
	onRetryPublications,
	tweetsLoading,
	missives,
	missivesLoading,
}: HomeIndexProps) {
	const writings = items.slice(0, 5);
	const leadItem = writings[0];
	const subsequentItems = writings.slice(1);

	const musings = tweets.slice(0, 2);

	const transition = { type: "spring" as const, stiffness: 130, damping: 21, mass: 0.9 };

	return (
		<section
			id="recent"
			className="mx-auto max-w-7xl scroll-mt-24 px-5 pt-20 sm:px-8 lg:px-12 lg:pt-28"
		>
			<div className="grid min-w-0 grid-cols-1 gap-14 lg:grid-cols-[1.62fr_1fr] lg:gap-16">
				<motion.div
					className="min-w-0"
					initial={false}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, amount: 0.2 }}
					transition={transition}
				>
					<div className="mb-7">
						<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
							FRESH INK
						</p>
						<h2 className="mt-2 font-serif text-[1.75rem] font-normal leading-tight tracking-[0.08em] text-foreground sm:text-3xl">
							近稿
						</h2>
					</div>

					{publicationError ? (
						<div
							role="alert"
							className="mb-7 border-l-2 border-destructive/70 py-1 pl-4 text-sm text-muted-foreground"
						>
							<p className="font-medium text-foreground">近稿暂时未能抵达。</p>
							<button
								type="button"
								disabled={publicationRetrying}
								onClick={onRetryPublications}
								className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary transition-colors hover:text-primary/80 disabled:cursor-wait disabled:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
							>
								<RefreshCw
									className={`size-3.5 ${publicationRetrying ? "animate-spin" : ""}`}
								/>
								{publicationRetrying ? "正在重试" : "重新获取近稿"}
							</button>
						</div>
					) : leadItem ? (
						<article className="mb-7 grid grid-cols-[24px_minmax(0,1fr)] items-baseline gap-3">
							<span className="font-mono text-xs font-semibold tracking-wider text-primary">
								01
							</span>
							<div className="border-l-2 border-primary pl-4">
								<div className="flex items-center gap-1.5 text-xs text-muted-foreground/80">
									<span className="font-normal text-muted-foreground/90">
										{HOME_KIND_LABEL[leadItem.kind]}
									</span>
									<span aria-hidden>·</span>
									<time dateTime={leadItem.published_at}>
										{formatRelativeOrDate(leadItem.published_at)}
									</time>
								</div>
								<h3 className="mt-2.5 font-serif text-xl font-normal leading-snug text-foreground sm:text-2xl">
									<HomeContentLink
										item={leadItem}
										className="underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
									>
										{leadItem.title}
									</HomeContentLink>
								</h3>
							</div>
						</article>
					) : (
						<p className="mb-7 border-l border-border/80 pl-4 text-sm text-muted-foreground">
							尚无公开作品。
						</p>
					)}

					{subsequentItems.length > 0 ? (
						<ul className="divide-y divide-border/30">
							{subsequentItems.map((item, index) => {
								const order = String(index + 2).padStart(2, "0");
								return (
									<li key={item.id} className="py-3.5 first:pt-0 last:pb-0">
										<div className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-baseline gap-3">
											<span className="font-mono text-xs text-muted-foreground/50 tabular-nums">
												{order}
											</span>
											<div className="min-w-0">
												<HomeContentLink
													item={item}
													className="block truncate font-serif text-sm font-normal text-foreground/90 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
												>
													{item.title}
												</HomeContentLink>
												<span className="mt-1 inline-block text-[11px] text-muted-foreground/70">
													{HOME_KIND_LABEL[item.kind]}
												</span>
											</div>
											<time
												dateTime={item.published_at}
												className="shrink-0 text-xs text-muted-foreground/70 tabular-nums"
											>
												{formatRelativeOrDate(item.published_at)}
											</time>
										</div>
									</li>
								);
							})}
						</ul>
					) : null}

					<div className="mt-7">
						<Link
							to="/blog"
							className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						>
							尽览新篇
							<ArrowRight className="size-3.5" />
						</Link>
					</div>
				</motion.div>

				<motion.div
					className="min-w-0 lg:border-l lg:border-border/40 lg:pl-10"
					initial={false}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, amount: 0.2 }}
					transition={{ ...transition, delay: 0.08 }}
				>
					<div>
						<div className="mb-5">
							<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
								GLEANINGS
							</p>
							<h2 className="mt-2 font-serif text-[1.75rem] font-normal leading-tight tracking-[0.08em] text-foreground sm:text-3xl">
								偶得
							</h2>
						</div>

						{tweetsLoading ? (
							<div aria-live="polite" className="space-y-4">
								{[0, 1].map((i) => (
									<div
										key={i}
										className="space-y-2 border-l border-border/80 pl-3.5"
									>
										<Skeleton className="h-3.5 w-full rounded" />
										<Skeleton className="h-3 w-16 rounded" />
									</div>
								))}
							</div>
						) : musings.length > 0 ? (
							<div className="space-y-4">
								{musings.map((tweet) => (
									<article
										key={tweet.id}
										className="border-l border-border/80 pl-3.5"
									>
										<Link
											to="/tweets/$id"
											params={{ id: tweet.id }}
											className="block font-serif text-[13px] italic leading-relaxed text-foreground/85 transition-colors hover:text-primary line-clamp-2"
										>
											{tweet.content.trim() ||
												(tweet.images.length > 0
													? `发布了 ${tweet.images.length} 张图片`
													: "随手记录")}
										</Link>
										<time
											dateTime={tweet.created_at}
											className="mt-1 block text-[11px] text-muted-foreground/70 tabular-nums"
										>
											{formatRelativeOrDate(tweet.created_at)}
										</time>
									</article>
								))}
							</div>
						) : (
							<article className="text-[13px] text-muted-foreground">
								<p className="font-serif italic leading-relaxed">
									近日未有新得，静待文思泉涌。
								</p>
							</article>
						)}

						<div className="mt-5">
							<Link
								to="/tweets"
								className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
							>
								回看全部偶得
								<ArrowUpRight className="size-3.5" />
							</Link>
						</div>
					</div>

					<hr className="my-7 border-0 border-t border-border/40" />

					<HomeMissives missives={missives} isLoading={missivesLoading} />
				</motion.div>
			</div>
		</section>
	);
}
