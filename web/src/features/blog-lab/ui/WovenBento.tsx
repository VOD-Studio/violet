import { getDisplayName } from "@entities/user/model/display-name";
import type { Post } from "@features/posts/model/types";
import { contentImageUrl } from "@shared/lib/image-url";
import { cn } from "@shared/lib/utils";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

/**
 * WovenBento - 织纹 Bento
 *
 * 确定性跨格节奏（每 6 篇铺满一循环）：2×2 主格 + 高瘦 + 宽扁 + 2 方 + 宽扁。
 * 文字浮于图上（渐变遮罩），格子入场交错缩放（scale 0.94→1），
 * hover 封面推进。「大小不一」就是设计本身。
 */
const SPANS = [
	"md:col-span-2 md:row-span-2",
	"md:row-span-2",
	"md:col-span-2",
	"",
	"",
	"md:col-span-2",
];

export function WovenBento({ posts }: { posts: Post[] }) {
	const reduce = useReducedMotion();

	return (
		<div className="grid auto-rows-[170px] grid-cols-2 gap-3 md:grid-cols-4">
			{posts.map((p, i) => {
				const big = i % 6 === 0;
				return (
					<motion.div
						key={p.id}
						initial={reduce ? false : { opacity: 0, scale: 0.94 }}
						whileInView={{ opacity: 1, scale: 1 }}
						viewport={{ once: true, amount: 0.2 }}
						transition={{
							duration: 0.45,
							delay: (i % 6) * 0.06,
							ease: [0.16, 1, 0.3, 1],
						}}
						className={cn("min-h-0", SPANS[i % 6])}
					>
						<BentoCell post={p} big={big} />
					</motion.div>
				);
			})}
		</div>
	);
}

function BentoCell({ post, big }: { post: Post; big: boolean }) {
	const [brokenFor, setBrokenFor] = useState<string | null>(null);
	const hasCover = !!post.cover_image && brokenFor !== post.cover_image;

	return (
		<Link
			to="/blog/$slug"
			params={{ slug: post.slug }}
			className="group relative block h-full overflow-hidden rounded-xl border border-edge-hairline"
		>
			{hasCover ? (
				<img
					src={contentImageUrl(post.cover_image, { width: big ? 960 : 480 })}
					alt={post.title}
					loading="lazy"
					onError={() => setBrokenFor(post.cover_image)}
					className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
				/>
			) : (
				<div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-muted to-muted" />
			)}
			<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
			<div className="absolute inset-x-0 bottom-0 p-4 text-white">
				<h3
					className={cn(
						"line-clamp-2 leading-snug font-semibold tracking-tight",
						big ? "text-xl" : "text-sm",
					)}
				>
					{post.title}
				</h3>
				<p className="mt-1 truncate font-mono text-[10px] text-white/70">
					{post.author ? getDisplayName(post.author) : "佚名"} ·{" "}
					{formatDistanceToNow(new Date(post.published_at), {
						addSuffix: true,
						locale: zhCN,
					})}
				</p>
			</div>
		</Link>
	);
}
