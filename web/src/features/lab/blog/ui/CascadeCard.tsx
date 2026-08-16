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

export function CascadeCard({ post, index }: { post: Post; index: number }) {
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
						{post.is_featured && (
							<p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] text-neon-blue uppercase">
								<span aria-hidden>★</span> Featured
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
