import { getDisplayName } from "@entities/user/model/display-name";
import type { Post } from "@features/posts/model/types";
import { contentImageUrl } from "@shared/lib/image-url";
import { cn } from "@shared/lib/utils";
import { SpotlightCard } from "@shared/vendor/react-bits/SpotlightCard";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

/**
 * CascadeFlow - 主轴瀑布
 *
 * 最新一篇做全宽主轴（封面 + 渐变遮罩 + 大字浮排，封面短促余韵 blur、
 * 文字清晰淡入上升）；其余走 CSS columns 自然高度瀑布流——封面自然宽高比、
 * 摘要不锁行数，「大小不一」是节奏不是缺陷。无封面/失效封面退化为排版卡
 * （№ 序号 + 大字标题），与图片卡交织出杂志感。卡片用全站签名 SpotlightCard
 * 冷光 + 上浮 + 封面缩放三层 hover。
 */
export function CascadeFlow({ posts }: { posts: Post[] }) {
	const [hero, ...rest] = posts;
	if (!hero) return null;

	return (
		<div>
			{/* ===== 主轴 hero =====
				文字必须清晰入场（blur 会牺牲正文可读性），余韵 blur 只留给封面图 */}
			<motion.div
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
				className="group relative mb-8 overflow-hidden rounded-2xl border border-edge-hairline"
			>
				<HeroCover post={hero} />
				<div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent" />
				<Link
					to="/blog/$slug"
					params={{ slug: hero.slug }}
					className="absolute inset-0 flex flex-col justify-end p-6 md:p-10"
				>
					<p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-mono text-[10px] tracking-[0.25em] text-white/90 uppercase backdrop-blur-sm">
						Latest
					</p>
					<h2 className="max-w-3xl text-2xl leading-tight font-bold tracking-tight text-white md:text-4xl">
						{hero.title}
					</h2>
					<p className="mt-3 line-clamp-1 max-w-2xl text-sm text-white/75 md:text-base">
						{hero.excerpt}
					</p>
					<p className="mt-3 font-mono text-xs text-white/60">
						{hero.author ? getDisplayName(hero.author) : "佚名"} ·{" "}
						{formatDistanceToNow(new Date(hero.published_at), {
							addSuffix: true,
							locale: zhCN,
						})}
					</p>
				</Link>
			</motion.div>

			{/* ===== 瀑布流 ===== */}
			<div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
				{rest.map((p, i) => (
					<CascadeCard key={p.id} post={p} index={i} />
				))}
			</div>
		</div>
	);
}

/** hero 封面：有图自然比例 21:9，失效/缺失退化为品牌渐变底 */
function HeroCover({ post }: { post: Post }) {
	const [brokenFor, setBrokenFor] = useState<string | null>(null);
	if (!post.cover_image || brokenFor === post.cover_image) {
		return (
			<div className="aspect-21/9 w-full bg-linear-to-br from-primary/25 via-muted to-muted" />
		);
	}
	return (
		<motion.img
			src={contentImageUrl(post.cover_image, { width: 1280 })}
			alt={post.title}
			onError={() => setBrokenFor(post.cover_image)}
			initial={{ filter: "blur(10px)" }}
			animate={{ filter: "blur(0px)" }}
			transition={{ duration: 0.5, ease: "easeOut" }}
			className="aspect-21/9 w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
		/>
	);
}

function CascadeCard({ post, index }: { post: Post; index: number }) {
	const reduce = useReducedMotion();
	const [brokenFor, setBrokenFor] = useState<string | null>(null);
	const coverBroken = brokenFor === post.cover_image;
	const hasCover = !!post.cover_image && !coverBroken;

	return (
		<motion.article
			initial={reduce ? false : { opacity: 0, y: 26 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, amount: 0.15 }}
			transition={{
				duration: 0.55,
				delay: (index % 5) * 0.07,
				ease: [0.16, 1, 0.3, 1],
			}}
			className="mb-6 break-inside-avoid"
		>
			<Link to="/blog/$slug" params={{ slug: post.slug }} className="group block">
				<SpotlightCard
					className={cn(
						"overflow-hidden rounded-2xl border border-edge-hairline bg-card",
						"transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30",
					)}
				>
					{hasCover ? (
						<div className="overflow-hidden">
							<img
								src={contentImageUrl(post.cover_image, { width: 640 })}
								alt={post.title}
								loading="lazy"
								onError={() => setBrokenFor(post.cover_image)}
								className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
							/>
						</div>
					) : null}

					<div className={cn("p-5", !hasCover && "bg-muted/30 p-6")}>
						{!hasCover && (
							<p className="mb-2 font-mono text-[10px] tracking-[0.3em] text-muted-foreground/70 uppercase">
								№ {String(index + 2).padStart(2, "0")}
							</p>
						)}
						{post.tags.length > 0 && (
							<p className="mb-2 font-mono text-[10px] text-muted-foreground">
								{post.tags.slice(0, 3).join(" / ")}
							</p>
						)}
						<h3
							className={cn(
								"leading-snug font-semibold tracking-tight transition-colors group-hover:text-neon-blue",
								hasCover ? "line-clamp-2 text-lg" : "line-clamp-3 text-xl",
							)}
						>
							{post.title}
						</h3>
						<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
							{hasCover ? (
								<span className="line-clamp-3">{post.excerpt}</span>
							) : (
								<span className="line-clamp-5">{post.excerpt}</span>
							)}
						</p>
						<p className="mt-4 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
							<span className="truncate">
								{post.author ? getDisplayName(post.author) : "佚名"}
							</span>
							<time className="shrink-0">
								{formatDistanceToNow(new Date(post.published_at), {
									addSuffix: true,
									locale: zhCN,
								})}
							</time>
						</p>
					</div>
				</SpotlightCard>
			</Link>
		</motion.article>
	);
}
