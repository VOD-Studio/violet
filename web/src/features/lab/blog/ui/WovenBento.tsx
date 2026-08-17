import { getDisplayName } from "@entities/user/model/display-name";
import type { Post } from "@features/posts/model/types";
import { cn } from "@shared/lib/utils";
import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

/**
 * WovenBento - 织纹 Bento
 *
 * 确定性跨格节奏：6 篇恰好铺满 4 列 × 3 行（面积 4+2+1+2+2+1=12），
 * 自动布局零留白。移动端（2 列 148px 窄格）：标题只留 1 行、导语
 * 隐藏、主格字级降档——窄格里塞多行文字只会截得难看。有图格文字浮于图上（渐变遮罩），格子入场交错缩放
 * （scale 0.94→1），hover 封面推进。「大小不一」就是设计本身。
 * 无图格（死链封面是本地主数据形态）退化为排版织块：织线纹理面 +
 * 按格型分级的字块（主格/高格带导语），尺寸节奏靠字级与信息密度保持。
 */
const SPANS = [
	"md:col-span-2 md:row-span-2", // 主格 2×2 → r1-2 c1-2
	"md:col-span-2", // 宽扁 → r1 c3-4
	"", // 方 → r2 c3
	"md:row-span-2", // 高瘦 → r2-3 c4
	"md:col-span-2", // 宽扁 → r3 c1-2
	"", // 方 → r3 c3
];

/** 格型决定无图字块的排版密度；与 SPANS 槽位一一对应 */
const SHAPES = ["hero", "wide", "square", "tall", "wide", "square"] as const;
type BentoShape = (typeof SHAPES)[number];

export function WovenBento({ posts }: { posts: Post[] }) {
	const reduce = useReducedMotion();

	return (
		<div className="grid auto-rows-42.5 grid-cols-2 gap-3 md:grid-cols-4">
			{posts.map((p, i) => {
				const slot = i % 6;
				return (
					<motion.div
						key={p.id}
						initial={reduce ? false : { opacity: 0, scale: 0.94 }}
						whileInView={{ opacity: 1, scale: 1 }}
						viewport={{ once: true, amount: 0.2 }}
						transition={{
							duration: 0.45,
							delay: slot * 0.06,
							ease: [0.16, 1, 0.3, 1],
						}}
						className={cn("min-h-0", SPANS[slot])}
					>
						<BentoCell post={p} shape={SHAPES[slot]} />
					</motion.div>
				);
			})}
		</div>
	);
}

function BentoCell({ post, shape }: { post: Post; shape: BentoShape }) {
	const [brokenFor, setBrokenFor] = useState<string | null>(null);
	const hasCover = !!post.cover_image && brokenFor !== post.cover_image;

	return (
		<Link
			to="/blog/$slug"
			params={{ slug: post.slug }}
			className="group relative block h-full overflow-hidden rounded-xl border border-edge-hairline"
		>
			{hasCover ? (
				<>
					<CroppedImage
						src={post.cover_image}
						width={shape === "hero" ? 960 : 480}
						alt={post.title}
						loading="lazy"
						onError={() => setBrokenFor(post.cover_image)}
						className="absolute inset-0"
						imgClassName="transition-transform duration-500 group-hover:scale-105"
					/>
					<div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/25 to-transparent" />
					<div className="absolute inset-x-0 bottom-0 p-4 text-white">
						<h3
							className={cn(
								"line-clamp-1 leading-snug font-semibold tracking-tight md:line-clamp-2",
								shape === "hero"
									? "text-xl"
									: shape === "tall"
										? "text-base"
										: "text-sm",
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
				</>
			) : (
				<TypeTile post={post} shape={shape} />
			)}
		</Link>
	);
}

/**
 * TypeTile - 无图格的排版织块
 *
 * 织线用 --edge-hairline token（随主题自适应明暗），替代原硬编码
 * zinc 深色渐变——原兜底在浅色主题下是突兀的黑块，且全格同纹理抹平
 * 了 bento 的尺寸节奏。字级与导语按格型分级：主格/高格带导语，
 * 宽扁/方格只留标题，让「大格更重」的节奏在无图时依然可读。
 */
function TypeTile({ post, shape }: { post: Post; shape: BentoShape }) {
	const hero = shape === "hero";
	const tall = shape === "tall";

	return (
		<div className="absolute inset-0 bg-muted">
			<div
				aria-hidden
				className="absolute inset-0"
				style={{
					backgroundImage:
						"repeating-linear-gradient(45deg, var(--edge-hairline) 0 1px, transparent 1px 9px), repeating-linear-gradient(-45deg, var(--edge-hairline) 0 1px, transparent 1px 9px)",
				}}
			/>
			<div className={cn("relative flex h-full flex-col", hero ? "p-6" : "p-4")}>
				<h3
					className={cn(
						"leading-snug font-semibold tracking-tight transition-colors group-hover:text-neon-blue",
						hero
							? "line-clamp-1 text-lg md:line-clamp-3 md:text-2xl"
							: tall
								? "line-clamp-1 text-sm md:line-clamp-3 md:text-base"
								: shape === "wide"
									? "line-clamp-1 text-sm md:line-clamp-2 md:text-[15px]"
									: "line-clamp-1 text-sm md:line-clamp-2",
					)}
				>
					{post.title}
				</h3>
				{(hero || tall) && (
					<p className="mt-2 hidden text-[13px] leading-relaxed text-muted-foreground line-clamp-3 md:block">
						{post.excerpt}
					</p>
				)}
				<p className="mt-auto truncate pt-3 font-mono text-[10px] text-muted-foreground">
					{post.author ? getDisplayName(post.author) : "佚名"} ·{" "}
					{formatDistanceToNow(new Date(post.published_at), {
						addSuffix: true,
						locale: zhCN,
					})}
				</p>
			</div>
		</div>
	);
}
