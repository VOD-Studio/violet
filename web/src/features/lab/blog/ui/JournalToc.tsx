import type { Post } from "@features/posts/model/types";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";

/**
 * JournalToc - 杂志目录
 *
 * 真目录语法：按栏目（首标签）分组的分区目录——standing head（细线夹
 * 小写字距题字 + 篇数）+ 双列「编号·标题·点线引导·右对齐日期」条目。
 * 无卷首特写（与特写列表方向区分），零图片、最安静、信息密度最高。
 */
export function JournalToc({ posts }: { posts: Post[] }) {
	const reduce = useReducedMotion();

	const sections = useMemo(() => {
		const map = new Map<string, Post[]>();
		for (const p of posts) {
			const key = p.tags[0] ?? "随笔";
			const list = map.get(key);
			if (list) list.push(p);
			else map.set(key, [p]);
		}
		return [...map.entries()];
	}, [posts]);

	return (
		<div>
			<div className="mb-2 flex items-center gap-4 border-y-2 border-foreground py-2.5">
				<p className="font-mono text-xs font-bold tracking-[0.35em] uppercase">Contents</p>
				<p className="font-mono text-[11px] text-muted-foreground">
					{posts.length} 篇 · {sections.length} 个栏目
				</p>
			</div>

			{sections.map(([section, list], si) => (
				<motion.section
					key={section}
					initial={reduce ? false : { opacity: 0 }}
					whileInView={{ opacity: 1 }}
					viewport={{ once: true }}
					transition={{ duration: 0.4, delay: Math.min(si, 4) * 0.06 }}
					className="mt-8 first:mt-6"
				>
					<div className="mb-2 flex items-baseline justify-between">
						<h3 className="font-serif text-xl font-black tracking-wide">{section}</h3>
						<span className="font-mono text-[11px] text-muted-foreground/60">
							{String(list.length).padStart(2, "0")} items
						</span>
					</div>
					<ol className="grid gap-x-12 md:grid-cols-2">
						{list.map((p, i) => (
							<li key={p.id} className="border-b border-edge-hairline">
								<Link
									to="/blog/$slug"
									params={{ slug: p.slug }}
									className="group flex items-baseline gap-3 py-3.5"
								>
									<span className="font-mono text-xs text-muted-foreground/60 tabular-nums">
										{String(i + 1).padStart(2, "0")}
									</span>
									<span className="min-w-0 truncate text-[15px] font-medium transition-colors group-hover:text-neon-blue">
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
							</li>
						))}
					</ol>
				</motion.section>
			))}
		</div>
	);
}
