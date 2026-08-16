import { getDisplayName } from "@entities/user/model/display-name";
import type { Post } from "@features/posts/model/types";
import { contentImageUrl } from "@shared/lib/image-url";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

/**
 * AlternatingSpread - 对开特写
 *
 * editorial 对开页节奏：每篇一整行，封面与文字左右交替（奇数篇图左文右，
 * 偶数篇翻转），大序号压角、留白充分。与特写列表（单 hero+索引）不同，
 * 这里每篇都是主角；与瀑布/织纹不同，这里行列刚性、节奏来自交替。
 * 无图/死图行退化为整行排版特写（大序号 + 标题），节奏不塌。
 */
export function AlternatingSpread({ posts }: { posts: Post[] }) {
	const reduce = useReducedMotion();
	const featured = posts.slice(0, 6);

	return (
		<div className="divide-y divide-edge-hairline">
			{featured.map((p, i) => (
				<motion.article
					key={p.id}
					initial={reduce ? false : { opacity: 0, y: 18 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, amount: 0.25 }}
					transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
					className="py-10 first:pt-0 last:pb-0"
				>
					<Link
						to="/blog/$slug"
						params={{ slug: p.slug }}
						className={`group grid items-center gap-8 md:grid-cols-2 ${
							i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
						}`}
					>
						<SpreadCover post={p} index={i} />
						<div className="min-w-0">
							<h3 className="text-2xl leading-tight font-bold tracking-tight transition-colors group-hover:text-neon-blue md:text-3xl">
								{p.title}
							</h3>
							<p className="mt-4 line-clamp-3 text-muted-foreground">{p.excerpt}</p>
							<p className="mt-4 font-mono text-xs text-muted-foreground">
								{p.author ? getDisplayName(p.author) : "佚名"} ·{" "}
								{formatDistanceToNow(new Date(p.published_at), {
									addSuffix: true,
									locale: zhCN,
								})}
							</p>
						</div>
					</Link>
				</motion.article>
			))}
		</div>
	);
}

function SpreadCover({ post, index }: { post: Post; index: number }) {
	const [brokenFor, setBrokenFor] = useState<string | null>(null);
	const hasCover = !!post.cover_image && brokenFor !== post.cover_image;

	if (!hasCover) {
		return (
			<div className="relative flex aspect-3/2 flex-col justify-between overflow-hidden rounded-2xl bg-linear-to-br from-primary/30 via-zinc-800 to-zinc-900 p-7">
				<span className="font-mono text-xs tracking-[0.3em] text-white/50">SPREAD</span>
				<span className="font-serif text-7xl leading-none font-black text-white/85">
					{String(index + 1).padStart(2, "0")}
				</span>
			</div>
		);
	}
	return (
		<div className="relative overflow-hidden rounded-2xl">
			<img
				src={contentImageUrl(post.cover_image, { width: 960 })}
				alt={post.title}
				loading="lazy"
				onError={() => setBrokenFor(post.cover_image)}
				className="aspect-3/2 w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
			/>
			<span className="absolute bottom-4 left-5 font-serif text-5xl leading-none font-black text-white/85 drop-shadow-lg">
				{String(index + 1).padStart(2, "0")}
			</span>
		</div>
	);
}
