import type { AdminComment } from "@entities/comment/model/types";
import type { Tweet } from "@entities/tweet/model/types";
import { formatDate, formatRelativeTime } from "@shared/lib/date";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "@violet/ui";
import { cn } from "cn";
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

	const musings = tweets.slice(0, 2);

	const transition = { type: "spring" as const, stiffness: 130, damping: 21, mass: 0.9 };

	return (
		<section
			id="recent"
			className="mx-auto max-w-7xl scroll-mt-24 px-5 pt-20 sm:px-8 lg:px-12 lg:pt-28"
		>
			<div className="grid min-w-0 grid-cols-1 gap-14 lg:grid-cols-[1.62fr_1fr] lg:gap-12">
				<motion.div
					className="min-w-0"
					initial={false}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, amount: 0.2 }}
					transition={transition}
				>
					<div className="mb-4">
						<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
							FRESH INK
						</p>
						<h2 className="mt-1.5 font-serif text-xl font-normal leading-tight tracking-[0.08em] text-foreground/85 sm:text-2xl">
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
								className="mt-3 inline-flex items-center gap-1.5 text-xs text-link transition-colors hover:text-link-hover disabled:cursor-wait disabled:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
							>
								<RefreshCw
									className={`size-3.5 ${publicationRetrying ? "animate-spin" : ""}`}
								/>
								{publicationRetrying ? "正在重试" : "重新获取近稿"}
							</button>
						</div>
					) : writings.length > 0 ? (
						<div className="relative">
							<div
								aria-hidden
								className="pointer-events-none absolute inset-y-5 left-3 w-px -translate-x-1/2 bg-linear-to-b from-primary/70 via-border to-transparent"
							/>
							<ol aria-label="最近发布的作品" className="relative">
								{writings.map((item, index) => (
									<li key={item.id}>
										<HomeContentLink
											item={item}
											className="group relative block py-3.5 pl-9 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:pl-10"
										>
											<span
												aria-hidden
												className={cn(
													"absolute left-3 top-3.5 -translate-x-1/2 bg-background px-1 font-mono text-[10px] leading-5 tabular-nums transition-colors group-hover:text-primary group-focus-visible:text-primary",
													index === 0
														? "text-primary"
														: "text-muted-foreground/55",
												)}
											>
												{String(index + 1).padStart(2, "0")}
											</span>
											{index === 0 ? (
												<>
													<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-5 text-muted-foreground/75">
														<span>{HOME_KIND_LABEL[item.kind]}</span>
														<span
															aria-hidden
															className="text-muted-foreground/35"
														>
															·
														</span>
														<time
															dateTime={item.published_at}
															className="tabular-nums"
														>
															{formatRelativeOrDate(
																item.published_at,
															)}
														</time>
													</div>
													<h3 className="mt-2 font-serif text-xl font-normal leading-8 text-foreground wrap-break-word transition-colors group-hover:text-primary group-focus-visible:text-primary sm:text-[22px]">
														{item.title}
													</h3>
												</>
											) : (
												<>
													<div className="flex min-w-0 items-baseline justify-between gap-3 sm:gap-5">
														<h3 className="min-w-0 font-serif text-[15px] font-normal leading-6 text-foreground/85 wrap-break-word transition-colors group-hover:text-primary group-focus-visible:text-primary">
															{item.title}
														</h3>
														<time
															dateTime={item.published_at}
															className="shrink-0 text-[11px] leading-5 text-muted-foreground/60 tabular-nums"
														>
															{formatRelativeOrDate(
																item.published_at,
															)}
														</time>
													</div>
													<p className="mt-1 text-[11px] leading-4 text-muted-foreground/60">
														{HOME_KIND_LABEL[item.kind]}
													</p>
												</>
											)}
										</HomeContentLink>
									</li>
								))}
							</ol>
						</div>
					) : (
						<p className="mb-7 border-l border-border/80 pl-4 text-sm text-muted-foreground">
							尚无公开作品。
						</p>
					)}

					<div className="mt-4 pl-9 sm:pl-10">
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
							<h2 className="mt-1.5 font-serif text-xl font-normal leading-tight tracking-[0.08em] text-foreground/85 sm:text-2xl">
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
