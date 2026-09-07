import { getDisplayName } from "@entities/user/model/display-name";
import type { Post } from "@features/posts/model/types";
import { formatDate, formatRelativeTime } from "@shared/lib/date";
import { contentImageUrl } from "@shared/lib/image-url";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

/** 首页实验布局：一篇特写与紧凑文章索引。 */
export function FeaturedList({ posts }: { posts: Post[] }) {
	const reduce = useReducedMotion();
	const [featured, ...rest] = posts;

	if (!featured) return null;

	return (
		<div>
			<motion.div
				initial={reduce ? false : { opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
			>
				<Link
					to="/blog/$slug"
					params={{ slug: featured.slug }}
					className="group grid gap-8 md:grid-cols-2 md:items-center"
				>
					<FeatureCover post={featured} />
					<div>
						<p className="font-mono text-[11px] tracking-[0.35em] text-muted-foreground uppercase">
							特写 · Featured
						</p>
						<h2 className="mt-3 text-3xl leading-tight font-bold tracking-tight transition-colors group-hover:text-neon-blue md:text-4xl">
							{featured.title}
						</h2>
						<p className="mt-4 line-clamp-3 text-muted-foreground">
							{featured.excerpt}
						</p>
						<p className="mt-4 font-mono text-xs text-muted-foreground">
							{featured.author ? getDisplayName(featured.author) : "佚名"} ·{" "}
							{formatRelativeTime(featured.published_at)}
						</p>
						<p className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
							阅读全文
							<ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
						</p>
					</div>
				</Link>
			</motion.div>

			<div className="mt-12 border-t border-edge-hairline">
				{rest.map((post, index) => (
					<motion.div
						key={post.id}
						initial={reduce ? false : { opacity: 0 }}
						whileInView={{ opacity: 1 }}
						viewport={{ once: true }}
						transition={{ duration: 0.3, delay: Math.min(index, 6) * 0.04 }}
						className="border-b border-edge-hairline"
					>
						<Link
							to="/blog/$slug"
							params={{ slug: post.slug }}
							className="group flex items-baseline gap-4 py-4 transition-colors hover:bg-accent/30"
						>
							<span className="font-mono text-xs text-muted-foreground/60 tabular-nums">
								{String(index + 2).padStart(2, "0")}
							</span>
							<span className="min-w-0 flex-1 truncate font-medium transition-colors group-hover:text-neon-blue">
								{post.title}
							</span>
							<span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:block">
								{post.author ? getDisplayName(post.author) : "佚名"}
							</span>
							<span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
								{formatDate(post.published_at, "month-day")}
							</span>
						</Link>
					</motion.div>
				))}
			</div>
		</div>
	);
}

function FeatureCover({ post }: { post: Post }) {
	const [brokenFor, setBrokenFor] = useState<string | null>(null);
	const hasCover = !!post.cover_image && brokenFor !== post.cover_image;

	if (!hasCover) {
		return (
			<div className="flex aspect-16/10 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br from-primary/40 via-zinc-800 to-zinc-900 p-8">
				<p className="line-clamp-4 text-center text-2xl leading-snug font-bold tracking-tight text-white/90">
					{post.title}
				</p>
			</div>
		);
	}
	return (
		<div className="overflow-hidden rounded-2xl">
			<img
				src={contentImageUrl(post.cover_image, { width: 960 })}
				alt={post.title}
				loading="lazy"
				onError={() => setBrokenFor(post.cover_image)}
				className="aspect-16/10 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
			/>
		</div>
	);
}
