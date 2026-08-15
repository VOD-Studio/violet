import { getDisplayName } from "@entities/user/model/display-name";
import type { Post } from "@features/posts/model/types";
import { contentImageUrl } from "@shared/lib/image-url";
import { Link } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

/**
 * FeaturedList - 特写列表
 *
 * 顶级博客的主流范式：一篇大特写建立视线锚点（封面 + 标题 + 摘要 +
 * 阅读引导），其余文章收敛为紧凑索引行（编号 · 标题 · 日期），特写负责
 * 情绪、列表负责扫读效率。死图特写退化为深色排版特写，不破版。
 */
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
							{formatDistanceToNow(new Date(featured.published_at), {
								addSuffix: true,
								locale: zhCN,
							})}
						</p>
						<p className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
							阅读全文
							<ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
						</p>
					</div>
				</Link>
			</motion.div>

			<div className="mt-12 border-t border-edge-hairline">
				{rest.map((p, i) => (
					<motion.div
						key={p.id}
						initial={reduce ? false : { opacity: 0 }}
						whileInView={{ opacity: 1 }}
						viewport={{ once: true }}
						transition={{ duration: 0.3, delay: Math.min(i, 6) * 0.04 }}
						className="border-b border-edge-hairline"
					>
						<Link
							to="/blog/$slug"
							params={{ slug: p.slug }}
							className="group flex items-baseline gap-4 py-4 transition-colors hover:bg-accent/30"
						>
							<span className="font-mono text-xs text-muted-foreground/60 tabular-nums">
								{String(i + 2).padStart(2, "0")}
							</span>
							<span className="min-w-0 flex-1 truncate font-medium transition-colors group-hover:text-neon-blue">
								{p.title}
							</span>
							<span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:block">
								{p.author ? getDisplayName(p.author) : "佚名"}
							</span>
							<span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
								{format(new Date(p.published_at), "MM-dd")}
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
			<div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary/40 via-zinc-800 to-zinc-900 p-8">
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
				className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
			/>
		</div>
	);
}
