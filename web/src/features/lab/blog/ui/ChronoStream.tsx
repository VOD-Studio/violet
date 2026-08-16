import { getDisplayName } from "@entities/user/model/display-name";
import type { Post } from "@features/posts/model/types";
import { contentImageUrl } from "@shared/lib/image-url";
import { Link } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

/**
 * ChronoStream - 编年轨道
 *
 * 发光垂直轨道贯穿而下，条目自左滑入、节点滚动到位时点亮（scale + 辉光）。
 * 无卡片框，只有排版与细线；滚动即「沿时间下行」。
 */
export function ChronoStream({ posts }: { posts: Post[] }) {
	const reduce = useReducedMotion();

	return (
		<div className="relative ml-2 pl-10">
			{/* 轨道：主色渐隐 */}
			<div
				aria-hidden
				className="absolute top-0 bottom-0 left-0 w-px bg-gradient-to-b from-primary/70 via-edge-hairline to-transparent"
			/>
			{posts.map((p) => (
				<TimelineItem key={p.id} post={p} reduce={reduce} />
			))}
		</div>
	);
}

function TimelineItem({ post: p, reduce }: { post: Post; reduce: boolean | null }) {
	// 死图时连缩略图占位一起移除,避免 wrapper 的 w-44 留下空列
	const [brokenFor, setBrokenFor] = useState<string | null>(null);
	const hasCover = !!p.cover_image && brokenFor !== p.cover_image;

	return (
		<motion.article
			initial={reduce ? false : { opacity: 0, x: -18 }}
			whileInView={{ opacity: 1, x: 0 }}
			viewport={{ once: true, amount: 0.3 }}
			transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
			className="relative pb-12 last:pb-0"
		>
			{/* 节点：入场后点亮 */}
			<motion.span
				aria-hidden
				initial={reduce ? false : { scale: 0 }}
				whileInView={{ scale: 1 }}
				viewport={{ once: true }}
				transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.1 }}
				className="absolute top-1 -left-[44.5px] size-2.5 rounded-full border-2 border-background bg-primary shadow-[0_0_12px] shadow-primary/60"
			/>
			<p className="font-mono text-xs text-muted-foreground">
				{format(new Date(p.published_at), "MM·dd")} ·{" "}
				{formatDistanceToNow(new Date(p.published_at), {
					addSuffix: true,
					locale: zhCN,
				})}
			</p>
			<h3 className="mt-1.5 text-xl font-semibold tracking-tight">
				<Link
					to="/blog/$slug"
					params={{ slug: p.slug }}
					className="transition-colors hover:text-neon-blue"
				>
					{p.title}
				</Link>
			</h3>
			<div className="mt-3 flex flex-col gap-4 md:flex-row">
				{hasCover && (
					<Link
						to="/blog/$slug"
						params={{ slug: p.slug }}
						className="w-full shrink-0 md:w-44"
					>
						<img
							src={contentImageUrl(p.cover_image, { width: 480 })}
							alt={p.title}
							loading="lazy"
							onError={() => setBrokenFor(p.cover_image)}
							className="aspect-video w-full rounded-lg object-cover"
						/>
					</Link>
				)}
				<div className="min-w-0">
					<p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
						{p.excerpt}
					</p>
					<p className="mt-2 font-mono text-[11px] text-muted-foreground">
						{p.author ? getDisplayName(p.author) : "佚名"}
						{p.tags.length > 0 && ` · ${p.tags.slice(0, 3).join(" / ")}`}
					</p>
				</div>
			</div>
		</motion.article>
	);
}
