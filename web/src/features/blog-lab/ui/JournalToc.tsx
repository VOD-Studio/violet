import { getDisplayName } from "@entities/user/model/display-name";
import type { Post } from "@features/posts/model/types";
import { Link } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { motion, useReducedMotion } from "motion/react";

/**
 * JournalToc - 杂志目录
 *
 * 真目录语法：栏目分区（细线夹小写字距题字）→ 条目「编号 + 标题 + 点线
 * 引导 + 右对齐日期」单行排版，字号层级代替框层级。零图片、最安静。
 */
export function JournalToc({ posts }: { posts: Post[] }) {
	const reduce = useReducedMotion();
	const [feature, ...rest] = posts;

	return (
		<div>
			{feature && (
				<motion.div
					initial={reduce ? false : { opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
				>
					<p className="mb-4 font-mono text-[11px] tracking-[0.35em] text-muted-foreground uppercase">
						卷首 · Latest
					</p>
					<Link
						to="/blog/$slug"
						params={{ slug: feature.slug }}
						className="group block pb-10"
					>
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

			<div className="flex items-center gap-4 border-y border-edge-hairline py-2">
				<p className="font-mono text-[11px] tracking-[0.35em] text-muted-foreground uppercase">
					目录 · Contents
				</p>
				<p className="font-mono text-[11px] text-muted-foreground/60">
					共 {rest.length} 篇
				</p>
			</div>

			<ol>
				{rest.map((p, i) => (
					<motion.li
						key={p.id}
						initial={reduce ? false : { opacity: 0 }}
						whileInView={{ opacity: 1 }}
						viewport={{ once: true }}
						transition={{ duration: 0.35, delay: Math.min(i, 6) * 0.04 }}
						className="border-b border-edge-hairline"
					>
						<Link
							to="/blog/$slug"
							params={{ slug: p.slug }}
							className="group flex items-baseline gap-4 py-4"
						>
							<span className="font-mono text-xs text-muted-foreground/60 tabular-nums">
								{String(i + 2).padStart(2, "0")}
							</span>
							<span className="min-w-0 truncate font-medium transition-colors group-hover:text-neon-blue">
								{p.title}
							</span>
							<span
								aria-hidden
								className="mx-1 min-w-6 flex-1 border-b border-dotted border-edge-hairline"
							/>
							<span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
								{format(new Date(p.published_at), "MM-dd")}
							</span>
						</Link>
					</motion.li>
				))}
			</ol>
		</div>
	);
}
