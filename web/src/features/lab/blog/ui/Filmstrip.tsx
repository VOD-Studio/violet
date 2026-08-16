import { getDisplayName } from "@entities/user/model/display-name";
import type { Post } from "@features/posts/model/types";
import { contentImageUrl } from "@shared/lib/image-url";
import { Button } from "@shared/ui/base/button";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

// 齿孔:白亮短划在暗带上排成两行,读作胶卷穿孔而非随机虚线
const SPROCKET =
	"repeating-linear-gradient(90deg, rgba(255,255,255,0.22) 0 10px, transparent 10px 24px)";
// 场记板板条:顶边黑白斜纹,胶片语法的专属标记,与织纹的交叉纹理区分
const CLAPPER =
	"repeating-linear-gradient(45deg, rgba(255,255,255,0.5) 0 5px, transparent 5px 10px)";

/**
 * Filmstrip - 胶片条
 *
 * 暗色胶卷带横陈页面：上下穿孔 + 横向 scroll-snap 画幅。有图帧直接曝光；
 * 无图/死图帧退化为「场记板」排版帧（№ 编号 + 浅字标题，胶卷上不出现黑字灰底）。
 * 标题与元信息浮排在画幅内，垂直占用最小，适合页首「最新」带。
 */
export function Filmstrip({ posts }: { posts: Post[] }) {
	const trackRef = useRef<HTMLDivElement>(null);
	const scrollBy = (dir: 1 | -1) =>
		trackRef.current?.scrollBy({ left: dir * 480, behavior: "smooth" });

	return (
		<div>
			<div className="mb-3 flex items-center justify-between px-1">
				<p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground/60 uppercase">
					Frames · {posts.length} exposed
				</p>
				<div className="flex gap-1.5">
					<Button
						size="icon-sm"
						variant="outline"
						aria-label="向左滚动"
						onClick={() => scrollBy(-1)}
					>
						<ChevronLeft className="size-4" />
					</Button>
					<Button
						size="icon-sm"
						variant="outline"
						aria-label="向右滚动"
						onClick={() => scrollBy(1)}
					>
						<ChevronRight className="size-4" />
					</Button>
				</div>
			</div>

			<div className="rounded-2xl border border-white/10 bg-zinc-900 py-1">
				<div aria-hidden className="mx-3 h-2.5" style={{ backgroundImage: SPROCKET }} />
				<div
					ref={trackRef}
					className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				>
					{posts.map((p, i) => (
						<Frame key={p.id} post={p} index={i} />
					))}
				</div>
				<div aria-hidden className="mx-3 h-2.5" style={{ backgroundImage: SPROCKET }} />
			</div>
		</div>
	);
}

function Frame({ post: p, index }: { post: Post; index: number }) {
	// 死图时连 img 带占位一起换成场记板帧,避免画幅塌成空框
	const [brokenFor, setBrokenFor] = useState<string | null>(null);
	const hasCover = !!p.cover_image && brokenFor !== p.cover_image;

	return (
		<Link
			to="/blog/$slug"
			params={{ slug: p.slug }}
			className="group relative block w-52 shrink-0 snap-start overflow-hidden rounded-md ring-1 ring-white/10 transition-all duration-300 hover:-translate-y-0.5 hover:ring-white/30"
		>
			{hasCover ? (
				<img
					src={contentImageUrl(p.cover_image, { width: 480 })}
					alt={p.title}
					loading="lazy"
					onError={() => setBrokenFor(p.cover_image)}
					className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105"
				/>
			) : (
				<div className="flex aspect-video w-full flex-col bg-zinc-800">
					<div
						aria-hidden
						className="h-2.5 w-full shrink-0"
						style={{ backgroundImage: CLAPPER }}
					/>
					<div className="flex flex-1 flex-col items-start gap-2 p-3 pt-2.5">
						<span className="font-mono text-[10px] tracking-[0.25em] text-white/40">
							№ {String(index + 1).padStart(2, "0")}
						</span>
						<p className="line-clamp-3 text-left text-xs leading-snug font-medium text-zinc-100">
							{p.title}
						</p>
					</div>
				</div>
			)}
			<div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pt-6 pb-2">
				{hasCover && (
					<p className="truncate text-[11px] font-medium text-white">{p.title}</p>
				)}
				<p className="truncate font-mono text-[10px] text-white/70">
					{p.author ? getDisplayName(p.author) : "佚名"} ·{" "}
					{formatDistanceToNow(new Date(p.published_at), {
						addSuffix: true,
						locale: zhCN,
					})}
				</p>
			</div>
		</Link>
	);
}
