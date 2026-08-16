import { getDisplayName } from "@entities/user/model/display-name";
import type { Post } from "@features/posts/model/types";
import { CroppedImage } from "@shared/ui/image-cropper/CroppedImage";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { motion } from "motion/react";
import { useState } from "react";
import { Waterfall } from "./Waterfall";

/**
 * CascadeFlow - 主轴瀑布
 *
 * 最新一篇做全宽主轴(封面 + 渐变遮罩 + 大字浮排),其余走 Waterfall 分列
 * 瀑布;无封面/失效封面退化为排版卡(№ 序号 + 大字标题)。
 */
export function CascadeFlow({ posts }: { posts: Post[] }) {
	const [hero, ...rest] = posts;
	if (!hero) return null;

	return (
		<div>
			{/* 文字必须清晰入场(blur 会牺牲正文可读性),余韵 blur 只留给封面图 */}
			<motion.div
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
				className="group relative mb-8 overflow-hidden rounded-2xl border border-edge-hairline"
			>
				<HeroCover post={hero} />
				<div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent" />
				<Link
					to="/blog/$slug"
					params={{ slug: hero.slug }}
					className="absolute inset-0 flex flex-col justify-end p-6 md:p-10"
				>
					<p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-mono text-[10px] tracking-[0.25em] text-white/90 uppercase backdrop-blur-sm">
						{hero.is_featured ? "★ Featured" : "Latest"}
					</p>
					<h2 className="max-w-3xl text-2xl leading-tight font-bold tracking-tight text-white md:text-4xl">
						{hero.title}
					</h2>
					<p className="mt-3 line-clamp-1 max-w-2xl text-sm text-white/75 md:text-base">
						{hero.excerpt}
					</p>
					<p className="mt-3 font-mono text-xs text-white/60">
						{hero.author ? getDisplayName(hero.author) : "佚名"} ·{" "}
						{formatDistanceToNow(new Date(hero.published_at), {
							addSuffix: true,
							locale: zhCN,
						})}
					</p>
				</Link>
			</motion.div>

			<Waterfall posts={rest} />
		</div>
	);
}

/** hero 封面:有图带选区裁剪复现,失效/缺失退化为品牌渐变底 */
function HeroCover({ post }: { post: Post }) {
	const [brokenFor, setBrokenFor] = useState<string | null>(null);
	if (!post.cover_image || brokenFor === post.cover_image) {
		return (
			<div className="aspect-16/10 w-full bg-linear-to-br from-primary/25 via-muted to-muted md:aspect-21/9" />
		);
	}
	return (
		// 余韵 blur 动画落在容器:CroppedImage 渲染普通 img,挂不了 motion 属性
		<motion.div
			initial={{ filter: "blur(10px)" }}
			animate={{ filter: "blur(0px)" }}
			transition={{ duration: 0.5, ease: "easeOut" }}
		>
			<CroppedImage
				src={post.cover_image}
				width={1280}
				alt={post.title}
				onError={() => setBrokenFor(post.cover_image)}
				className="aspect-16/10 w-full md:aspect-21/9"
				imgClassName="transition-transform duration-700 group-hover:scale-[1.03]"
			/>
		</motion.div>
	);
}
