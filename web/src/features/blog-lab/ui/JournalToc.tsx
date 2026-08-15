import { getDisplayName } from "@entities/user/model/display-name";
import type { Post } from "@features/posts/model/types";
import { Link } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { motion, useReducedMotion } from "motion/react";

/**
 * JournalToc - 杂志目录
 *
 * 纯排版零图片：头条大字 + 双列目录，字号层级代替框层级。入场自上而下
 * 交错（标题先落、目录随后），最安静的方向，碎图问题从根上不存在。
 */
export function JournalToc({ posts }: { posts: Post[] }) {
	const reduce = useReducedMotion();
	const [feature, ...rest] = posts;

	return (
		<div>
			{feature && (
				<motion.div
					initial={reduce ? false : { opacity: 0, y: 18 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
				>
					<Link
						to="/blog/$slug"
						params={{ slug: feature.slug }}
						className="group block border-y border-edge-hairline py-10"
					>
						<p className="mb-3 font-mono text-xs tracking-[0.25em] text-muted-foreground uppercase">
							Latest · {format(new Date(feature.published_at), "yyyy-MM-dd")}
						</p>
						<h2 className="max-w-3xl text-3xl leading-tight font-bold tracking-tight transition-colors group-hover:text-neon-blue md:text-4xl">
							{feature.title}
						</h2>
						<p className="mt-4 line-clamp-2 max-w-2xl text-muted-foreground">
							{feature.excerpt}
						</p>
						<p className="mt-3 font-mono text-xs text-muted-foreground">
							{feature.author ? getDisplayName(feature.author) : "佚名"} ·{" "}
							{formatDistanceToNow(new Date(feature.published_at), {
								addSuffix: true,
								locale: zhCN,
							})}
						</p>
					</Link>
				</motion.div>
			)}

			<ol className="mt-2 grid gap-x-12 md:grid-cols-2">
				{rest.map((p, i) => (
					<motion.li
						key={p.id}
						initial={reduce ? false : { opacity: 0, y: 14 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, amount: 0.4 }}
						transition={{ duration: 0.4, delay: (i % 4) * 0.05 }}
						className="border-b border-edge-hairline py-5"
					>
						<Link
							to="/blog/$slug"
							params={{ slug: p.slug }}
							className="group flex gap-4"
						>
							<span className="pt-1 font-mono text-xs text-muted-foreground/70 tabular-nums">
								{String(i + 2).padStart(2, "0")}
							</span>
							<div className="min-w-0">
								<h3 className="font-semibold transition-colors group-hover:text-neon-blue">
									{p.title}
								</h3>
								<p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
									{p.excerpt}
								</p>
								<p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
									{p.author ? getDisplayName(p.author) : "佚名"} ·{" "}
									{formatDistanceToNow(new Date(p.published_at), {
										addSuffix: true,
										locale: zhCN,
									})}
								</p>
							</div>
						</Link>
					</motion.li>
				))}
			</ol>
		</div>
	);
}
