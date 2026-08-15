import { getDisplayName } from "@entities/user/model/display-name";
import type { Post } from "@features/posts/model/types";
import { contentImageUrl } from "@shared/lib/image-url";
import { Link } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { motion, useReducedMotion } from "motion/react";

/**
 * Broadsheet - 头版报纸
 *
 * 报头（站名 · ISSUE № · 日期）+ 通栏头条 + 三栏 briefs，栏间细线。
 * 报头先落、头条 blur-in、briefs 按栏序交错入场——像报纸摊开。
 */
export function Broadsheet({ posts }: { posts: Post[] }) {
	const reduce = useReducedMotion();
	const [headline, ...briefs] = posts;

	return (
		<div>
			<motion.header
				initial={reduce ? false : { opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
				className="flex items-baseline justify-between border-b-2 border-foreground pb-3 font-mono text-xs"
			>
				<span className="text-sm font-bold tracking-[0.35em]">VIOLET</span>
				<span className="text-muted-foreground">
					ISSUE №{String(posts.length).padStart(3, "0")} ·{" "}
					{format(Date.now(), "yyyy-MM-dd")}
				</span>
			</motion.header>

			{headline && (
				<motion.div initial={false} className="animate-blur-in">
					<Link
						to="/blog/$slug"
						params={{ slug: headline.slug }}
						className="group block border-b border-edge-hairline py-8"
					>
						<h2 className="max-w-4xl text-3xl leading-tight font-bold tracking-tight transition-colors group-hover:text-neon-blue md:text-4xl">
							{headline.title}
						</h2>
						<p className="mt-3 line-clamp-2 max-w-3xl text-muted-foreground">
							{headline.excerpt}
						</p>
						<p className="mt-3 font-mono text-xs text-muted-foreground">
							By {headline.author ? getDisplayName(headline.author) : "佚名"} ·{" "}
							{formatDistanceToNow(new Date(headline.published_at), {
								addSuffix: true,
								locale: zhCN,
							})}
						</p>
					</Link>
				</motion.div>
			)}

			<div className="grid border-t border-edge-hairline md:grid-cols-3">
				{briefs.map((p, i) => (
					<motion.article
						key={p.id}
						initial={reduce ? false : { opacity: 0, y: 18 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, amount: 0.2 }}
						transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
						className="border-b border-edge-hairline py-6 md:border-l md:px-5 md:first:border-l-0 md:first:pl-0 md:last:pr-0"
					>
						<Link to="/blog/$slug" params={{ slug: p.slug }} className="group">
							{p.cover_image && (
								<img
									src={contentImageUrl(p.cover_image, { width: 480 })}
									alt={p.title}
									loading="lazy"
									onError={(e) => {
										e.currentTarget.style.display = "none";
									}}
									className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
								/>
							)}
							<h3 className="mt-3 font-semibold transition-colors group-hover:text-neon-blue">
								{p.title}
							</h3>
							<p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
								{p.excerpt}
							</p>
							<p className="mt-2 font-mono text-[11px] text-muted-foreground">
								{p.author ? getDisplayName(p.author) : "佚名"} ·{" "}
								{format(new Date(p.published_at), "MM-dd")}
							</p>
						</Link>
					</motion.article>
				))}
			</div>
		</div>
	);
}
