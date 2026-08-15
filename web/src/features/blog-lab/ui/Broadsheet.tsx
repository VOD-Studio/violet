import { getDisplayName } from "@entities/user/model/display-name";
import type { Post } from "@features/posts/model/types";
import { contentImageUrl } from "@shared/lib/image-url";
import { Link } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Broadsheet - 头版报纸
 *
 * 报纸解剖学：日期线 → 居中衬线报头 → 粗细双线 → 通栏头条 → 分版简讯。
 * 图文版/文字版按封面**运行时可加载性**分流（预探测），死链封面不再
 * 留在图文版产生空洞。动效克制：报线先画，整版一次浮现。
 */
export function Broadsheet({ posts }: { posts: Post[] }) {
	const reduce = useReducedMotion();
	const [headline, ...briefs] = posts;
	// 图文版最多收 3 条,溢出退入文字版;孤图在外层升格为图片故事
	const aliveAll = useAliveCovers(briefs);
	const photoBriefs = briefs.filter((p) => aliveAll.has(p.cover_image)).slice(0, 3);
	const photoIds = new Set(photoBriefs.map((p) => p.id));
	const textBriefs = briefs.filter((p) => !photoIds.has(p.id));
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
						{headline.author ? getDisplayName(headline.author) : "佚名"} ·{" "}
						{formatDistanceToNow(new Date(headline.published_at), {
							addSuffix: true,
							locale: zhCN,
						})}
					</p>
				</Link>
			)}

			{/* 分版按存活图数量自适应：孤图升格「图片故事」整行图文并排，
				2 图双栏、3 图三栏、溢出退入文字版——孤图塞多栏格会留大片空栏 */}
			<motion.div
				initial={reduce ? false : { opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
			>
				{photoBriefs.length === 1 && (
					<Link
						to="/blog/$slug"
						params={{ slug: photoBriefs[0].slug }}
						className="group grid gap-6 border-b border-edge-hairline py-6 md:grid-cols-2 md:items-center"
					>
						<img
							src={contentImageUrl(photoBriefs[0].cover_image, { width: 960 })}
							alt={photoBriefs[0].title}
							onError={(e) => {
								e.currentTarget.style.display = "none";
							}}
							className="aspect-[3/2] w-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
						/>
						<div>
							<p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground/70 uppercase">
								图片故事 · Picture Story
							</p>
							<h4 className="mt-3 text-2xl leading-snug font-bold tracking-tight transition-colors group-hover:text-neon-blue">
								{photoBriefs[0].title}
							</h4>
							<p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
								{photoBriefs[0].excerpt}
							</p>
							<p className="mt-3 font-mono text-[11px] text-muted-foreground">
								{photoBriefs[0].author
									? getDisplayName(photoBriefs[0].author)
									: "佚名"}{" "}
								· {format(new Date(photoBriefs[0].published_at), "MM-dd")}
							</p>
						</div>
					</Link>
				)}
				{photoBriefs.length >= 2 && (
					<div
						className={`grid border-b border-edge-hairline ${
							photoBriefs.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"
						}`}
					>
						{photoBriefs.map((p, i) => (
							<article
								key={p.id}
								className="flex flex-col py-6 md:border-l md:px-6 md:first:border-l-0 md:first:pl-0 md:last:pr-0"
							>
								<Link
									to="/blog/$slug"
									params={{ slug: p.slug }}
									className="group flex h-full flex-col"
								>
									<p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground/70 uppercase">
										图文 {String(i + 1).padStart(2, "0")}
									</p>
									<img
										src={contentImageUrl(p.cover_image, { width: 480 })}
										alt={p.title}
										loading="lazy"
										onError={(e) => {
											e.currentTarget.style.display = "none";
										}}
										className="mt-3 aspect-video w-full object-cover grayscale transition-all duration-500 group-hover:scale-[1.02] group-hover:grayscale-0"
									/>
									<h4 className="mt-3 line-clamp-2 text-lg leading-snug font-bold tracking-tight transition-colors group-hover:text-neon-blue">
										{p.title}
									</h4>
									<p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
										{p.excerpt}
									</p>
									<p className="mt-auto pt-3 font-mono text-[11px] text-muted-foreground">
										{p.author ? getDisplayName(p.author) : "佚名"} ·{" "}
										{format(new Date(p.published_at), "MM-dd")}
									</p>
								</Link>
							</article>
						))}
					</div>
				)}

				{textBriefs.length > 0 && (
					<div>
						<p className="border-b border-edge-hairline py-2 font-mono text-[10px] tracking-[0.35em] text-muted-foreground uppercase">
							简讯版 · Briefs
						</p>
						{/* 双栏+中缝竖线:4 列会把中文标题挤断成碎片,报纸摘要栏从不这样排 */}
						<div className="grid md:grid-cols-2">
							{textBriefs.map((p) => (
								<article
									key={p.id}
									className="border-b border-edge-hairline py-5 md:px-8 md:first:pl-0 md:[&:nth-child(2)]:pr-0 md:[&:nth-child(even)]:border-l md:[&:nth-child(even)]:border-edge-hairline"
								>
									<Link
										to="/blog/$slug"
										params={{ slug: p.slug }}
										className="group block"
									>
										<h4 className="line-clamp-2 text-[17px] leading-snug font-bold tracking-tight transition-colors group-hover:text-neon-blue">
											{p.title}
										</h4>
										<p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
											{p.excerpt}
										</p>
										<p className="mt-2.5 font-mono text-[10px] text-muted-foreground">
											{format(new Date(p.published_at), "MM-dd")}
										</p>
									</Link>
								</article>
							))}
						</div>
					</div>
				)}
			</motion.div>
		</div>
	);
}

function useAliveCovers(posts: Post[]): Set<string> {
	const [alive, setAlive] = useState<Set<string>>(new Set());
	useEffect(() => {
		const withCover = posts.filter((p) => p.cover_image);
		if (withCover.length === 0) return;
		const ok = new Set<string>();
		let done = 0;
		const settle = () => {
			done += 1;
			if (done === withCover.length) setAlive(new Set(ok));
		};
		for (const p of withCover) {
			const img = new Image();
			img.onload = () => {
				ok.add(p.cover_image);
				settle();
			};
			img.onerror = settle;
			img.src = contentImageUrl(p.cover_image, { width: 480 });
		}
	}, [posts]);
	return alive;
}
