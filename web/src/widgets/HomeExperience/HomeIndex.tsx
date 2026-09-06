import type { Tweet } from "@entities/tweet/model/types";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";

import { HomeContentLink } from "./HomeContentLink";
import { HOME_KIND_LABEL } from "./home-content";
import type { HomePublicationItem } from "./types";

interface HomeIndexProps {
	items: HomePublicationItem[];
	tweets: Tweet[];
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
		return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
	}
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}.${month}.${day}`;
}

/** 首页近期创作与生活动态双栏布局。 */
export function HomeIndex({ items, tweets }: HomeIndexProps) {
	// 取最新创作（文章、笔记、图集、系列混合，按时间降序），前 5 项无重复展示
	const writings = items.slice(0, 5);
	const leadItem = writings[0];
	const subsequentItems = writings.slice(1);

	// 碎念推文（前 2~3 条）
	const musings = tweets.slice(0, 2);

	if (writings.length === 0 && musings.length === 0) return null;
	const transition = { type: "spring" as const, stiffness: 130, damping: 21, mass: 0.9 };

	return (
		<section
			id="recent"
			className="mx-auto max-w-7xl scroll-mt-24 px-5 pt-20 sm:px-8 lg:px-12 lg:pt-28"
		>
			<div className="grid min-w-0 grid-cols-1 gap-14 lg:grid-cols-[1.62fr_1fr] lg:gap-16">
				{/* 左栏：近期笔墨 */}
				<motion.div
					className="min-w-0"
					initial={false}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, amount: 0.2 }}
					transition={transition}
				>
					<div className="mb-7">
						<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
							RECENT WRITING
						</p>
						<h2 className="mt-1.5 text-2xl font-normal tracking-[-0.01em] text-foreground sm:text-[1.75rem]">
							近期笔墨
						</h2>
					</div>

					{leadItem ? (
						<article className="relative mb-7 border-l-2 border-primary pl-4">
							<span className="font-mono text-xs font-semibold tracking-wider text-primary">
								01
							</span>
							<div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground/80">
								<span className="font-normal text-muted-foreground/90">
									{HOME_KIND_LABEL[leadItem.kind]}
								</span>
								<span aria-hidden>·</span>
								<time dateTime={leadItem.publishedAt}>
									{formatRelativeOrDate(leadItem.publishedAt)}
								</time>
							</div>
							<h3 className="mt-2 text-lg font-medium leading-snug text-foreground sm:text-xl">
								<HomeContentLink
									item={leadItem}
									className="transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
								>
									{leadItem.title}
								</HomeContentLink>
							</h3>
						</article>
					) : null}

					{subsequentItems.length > 0 ? (
						<ul className="divide-y divide-border/30">
							{subsequentItems.map((item, index) => {
								const order = String(index + 2).padStart(2, "0");
								return (
									<li key={item.key} className="py-3.5 first:pt-0 last:pb-0">
										<div className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-baseline gap-3">
											<span className="font-mono text-xs text-muted-foreground/50 tabular-nums">
												{order}
											</span>
											<div className="min-w-0">
												<HomeContentLink
													item={item}
													className="block truncate text-sm font-medium text-foreground/90 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
												>
													{item.title}
												</HomeContentLink>
												<span className="mt-1 inline-block text-[11px] text-muted-foreground/70">
													{HOME_KIND_LABEL[item.kind]}
												</span>
											</div>
											<time
												dateTime={item.publishedAt}
												className="shrink-0 text-xs text-muted-foreground/70 tabular-nums"
											>
												{formatRelativeOrDate(item.publishedAt)}
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
							翻阅更多笔墨
							<ArrowRight className="size-3.5" />
						</Link>
					</div>
				</motion.div>

				{/* 右栏：碎念 + 来信 */}
				<motion.div
					className="min-w-0 lg:border-l lg:border-border/40 lg:pl-10"
					initial={false}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, amount: 0.2 }}
					transition={{ ...transition, delay: 0.08 }}
				>
					{/* 碎念区块 */}
					<div>
						<div className="mb-5">
							<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
								MUSINGS
							</p>
							<h2 className="mt-1.5 text-2xl font-normal tracking-[-0.01em] text-foreground sm:text-[1.75rem]">
								碎念
							</h2>
						</div>

						{musings.length > 0 ? (
							<div className="space-y-4">
								{musings.map((tweet) => (
									<article
										key={tweet.id}
										className="border-l border-border/80 pl-3.5"
									>
										<Link
											to="/tweets/$id"
											params={{ id: tweet.id }}
											className="block text-xs leading-relaxed text-foreground/85 transition-colors hover:text-primary line-clamp-2"
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
							<article className="border-l border-border/80 pl-3.5 text-xs text-muted-foreground">
								<p>近日无新随思，一切在平稳节奏中构建。</p>
							</article>
						)}

						<div className="mt-5">
							<Link
								to="/tweets"
								className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
							>
								查看推文时间线
								<ArrowUpRight className="size-3.5" />
							</Link>
						</div>
					</div>

					{/* 分隔线 */}
					<hr className="my-8 border-0 border-t border-border/40" />

					{/* 来信区块 */}
					<div>
						<div className="mb-5">
							<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
								LETTERS
							</p>
							<h2 className="mt-1.5 text-2xl font-normal tracking-[-0.01em] text-foreground sm:text-[1.75rem]">
								来信
							</h2>
						</div>

						<div className="space-y-5">
							<article className="relative pl-6">
								<span
									aria-hidden
									className="absolute -top-3 left-0 font-serif text-3xl leading-none text-muted-foreground/25 select-none"
								>
									“
								</span>
								<p className="text-xs leading-relaxed text-foreground/80">
									文字间流转的不仅是技术细节，更是对创造与自由的感知。在繁杂的工程体系里，保有一份对美好界面的执着，非常难得。
								</p>
								<p className="mt-2 text-right text-[11px] text-muted-foreground/75">
									— 读者来信
								</p>
							</article>

							<article className="relative border-t border-border/25 pt-4 pl-6">
								<span
									aria-hidden
									className="absolute top-1 left-0 font-serif text-3xl leading-none text-muted-foreground/25 select-none"
								>
									“
								</span>
								<p className="text-xs leading-relaxed text-foreground/80">
									字句流转，见信如晤。欢迎通过邮件或在文章与推文下方留言交流。
								</p>
								<p className="mt-2 text-right text-[11px] text-muted-foreground/75">
									— 站长笔墨
								</p>
							</article>
						</div>
					</div>
				</motion.div>
			</div>
		</section>
	);
}
