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
 * 报纸解剖学：日期线 → 居中衬线报头 → 粗细双线 → 通栏头条（kicker/衬线
 * 大标题/斜体 deck/署名）→ 三栏 briefs（栏间细线，无图即纯文字简讯，
 * 符合报纸惯例）。动效克制：报线先画，整版随后一次浮现，无逐项飞入。
 */
export function Broadsheet({ posts }: { posts: Post[] }) {
	const reduce = useReducedMotion();
	const [headline, ...briefs] = posts;
	const issue = String(posts.length).padStart(3, "0");

	return (
		<div className="font-serif">
			{/* 日期线 */}
			<div className="flex items-center justify-between border-b border-edge-hairline pb-2 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
				<span>{format(Date.now(), "yyyy年MM月dd日")}</span>
				<span>第 {issue} 期</span>
			</div>

			{/* 报头 */}
			<motion.h2
				initial={reduce ? false : { opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.4 }}
				className="py-6 text-center text-5xl font-black tracking-[0.18em]"
			>
				VIOLET
			</motion.h2>

			{/* 粗细双线 */}
			<motion.div
				aria-hidden
				initial={reduce ? false : { scaleX: 0 }}
				animate={{ scaleX: 1 }}
				transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
				className="border-t-[3px] border-b border-foreground pb-1"
			/>

			{headline && (
				<Link
					to="/blog/$slug"
					params={{ slug: headline.slug }}
					className="group block border-b border-edge-hairline py-8"
				>
					<p className="text-center font-mono text-[11px] tracking-[0.35em] text-muted-foreground uppercase">
						头版 · Headline
					</p>
					<h3 className="mx-auto mt-4 max-w-4xl text-center text-3xl leading-snug font-black tracking-tight transition-colors group-hover:text-neon-blue md:text-[2.75rem] md:leading-[1.15]">
						{headline.title}
					</h3>
					<p className="mx-auto mt-4 line-clamp-2 max-w-3xl text-center text-sm italic text-muted-foreground md:text-base">
						{headline.excerpt}
					</p>
					<p className="mt-5 text-center font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
						{headline.author ? getDisplayName(headline.author) : "佚名"} 撰 ·{" "}
						{formatDistanceToNow(new Date(headline.published_at), {
							addSuffix: true,
							locale: zhCN,
						})}
					</p>
				</Link>
			)}

			{/* 三栏简讯:栏间细线,整版一次浮现 */}
			<motion.div
				initial={reduce ? false : { opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
				className="grid md:grid-cols-3"
			>
				{briefs.map((p, i) => (
					<article
						key={p.id}
						className="border-b border-edge-hairline py-6 md:border-l md:px-6 md:first:border-l-0 md:first:pl-0 md:last:pr-0"
					>
						{/* 结构预算:标题限2行、摘要限3行、署名 mt-auto 钉底——有图/无图简讯底线对齐 */}
						<Link
							to="/blog/$slug"
							params={{ slug: p.slug }}
							className="group flex h-full flex-col"
						>
							<p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground/70 uppercase">
								简讯 {String(i + 1).padStart(2, "0")}
							</p>
							{p.cover_image && (
								<img
									src={contentImageUrl(p.cover_image, { width: 480 })}
									alt={p.title}
									loading="lazy"
									onError={(e) => {
										e.currentTarget.style.display = "none";
									}}
									className="mt-3 aspect-video w-full object-cover grayscale transition-all duration-500 group-hover:scale-[1.02] group-hover:grayscale-0"
								/>
							)}
							<h4 className="mt-3 line-clamp-2 text-lg leading-snug font-bold tracking-tight transition-colors group-hover:text-neon-blue">
								{p.title}
							</h4>
							<p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
								{p.excerpt}
							</p>
							<p className="mt-auto pt-3 font-mono text-[11px] text-muted-foreground">
								{p.author ? getDisplayName(p.author) : "佚名"} ·{" "}
								{format(new Date(p.published_at), "MM-dd")}
							</p>
						</Link>
					</article>
				))}
			</motion.div>
		</div>
	);
}
