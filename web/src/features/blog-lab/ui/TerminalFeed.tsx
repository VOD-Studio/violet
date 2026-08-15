import { getDisplayName } from "@entities/user/model/display-name";
import type { Post } from "@features/posts/model/types";
import { contentImageUrl } from "@shared/lib/image-url";
import { Link } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { motion, useReducedMotion } from "motion/react";

/**
 * TerminalFeed - 终端索引
 *
 * $ ls ~/posts --sort=time 的 mono 行式清单：光标闪烁、行序交错入场，
 * hover 时行平滑展开（grid-rows 动画）露出封面缩略与摘要。封面退居
 * 交互层，外链碎图不构成视觉问题；行密度最高，最贴全站终端 DNA。
 */
export function TerminalFeed({ posts }: { posts: Post[] }) {
	const reduce = useReducedMotion();

	return (
		<div className="font-mono text-sm">
			<p className="mb-3 text-muted-foreground">
				$ ls ~/posts --sort=time
				<span className="animate-caret-blink">▌</span>
			</p>
			<ul>
				{posts.map((p, i) => (
					<motion.li
						key={p.id}
						initial={reduce ? false : { opacity: 0, x: -14 }}
						whileInView={{ opacity: 1, x: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.04 }}
						className="group border-b border-edge-hairline/60"
					>
						<Link
							to="/blog/$slug"
							params={{ slug: p.slug }}
							className="-mx-2 flex items-baseline gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent/40"
						>
							<time className="shrink-0 text-xs text-muted-foreground tabular-nums">
								{format(new Date(p.published_at), "yyyy-MM-dd")}
							</time>
							<span className="min-w-0 flex-1 truncate transition-colors group-hover:text-neon-blue">
								{p.title}
								<span className="text-muted-foreground/60">.md</span>
							</span>
							<span className="hidden shrink-0 gap-1.5 text-[11px] text-muted-foreground sm:flex">
								{p.tags.slice(0, 2).map((t) => (
									<span key={t}>[{t}]</span>
								))}
							</span>
						</Link>

						{/* hover 平滑展开：grid-rows 0fr→1fr */}
						<div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-hover:grid-rows-[1fr]">
							<div className="overflow-hidden">
								<div className="flex items-start gap-4 pb-3 pl-2">
									{p.cover_image && (
										<img
											src={contentImageUrl(p.cover_image, { width: 320 })}
											alt=""
											loading="lazy"
											onError={(e) => {
												e.currentTarget.style.display = "none";
											}}
											className="h-16 w-28 shrink-0 rounded-md object-cover"
										/>
									)}
									<div className="min-w-0">
										<p className="line-clamp-2 font-sans text-xs leading-relaxed text-muted-foreground">
											{p.excerpt}
										</p>
										<p className="mt-1.5 text-[11px] text-muted-foreground">
											{p.author ? getDisplayName(p.author) : "佚名"} ·{" "}
											{formatDistanceToNow(new Date(p.published_at), {
												addSuffix: true,
												locale: zhCN,
											})}
										</p>
									</div>
								</div>
							</div>
						</div>
					</motion.li>
				))}
			</ul>
			<p className="mt-4 text-xs text-muted-foreground">
				{posts.length} posts · press :q to exit
			</p>
		</div>
	);
}
