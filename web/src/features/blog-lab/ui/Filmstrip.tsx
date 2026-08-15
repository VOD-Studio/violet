import { getDisplayName } from "@entities/user/model/display-name";
import type { Post } from "@features/posts/model/types";
import { contentImageUrl } from "@shared/lib/image-url";
import { Button } from "@shared/ui/base/button";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

/**
 * Filmstrip - 胶片条
 *
 * 横向 scroll-snap 胶片带：齿孔装饰 + 封面帧，hover 帧推进 + 齿孔随滚动
 * 流动。垂直占用最小，适合页首「最新」带或首页混排。
 */
export function Filmstrip({ posts }: { posts: Post[] }) {
	const trackRef = useRef<HTMLDivElement>(null);
	const scrollBy = (dir: 1 | -1) =>
		trackRef.current?.scrollBy({ left: dir * 480, behavior: "smooth" });

	return (
		<div className="relative">
			<div
				aria-hidden
				className="h-2 w-full bg-[repeating-linear-gradient(90deg,currentColor_0_10px,transparent_10px_24px)] opacity-20"
			/>
			<div
				ref={trackRef}
				className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-1 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{posts.map((p) => (
					<Link
						key={p.id}
						to="/blog/$slug"
						params={{ slug: p.slug }}
						className="group w-60 shrink-0 snap-start"
					>
						<div className="overflow-hidden rounded-lg border border-edge-hairline transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:shadow-black/5">
							{p.cover_image ? (
								<img
									src={contentImageUrl(p.cover_image, { width: 480 })}
									alt={p.title}
									loading="lazy"
									onError={(e) => {
										e.currentTarget.style.display = "none";
									}}
									className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105"
								/>
							) : (
								<div className="flex aspect-video w-full items-center justify-center bg-muted p-4 text-center font-mono text-xs leading-relaxed text-muted-foreground">
									{p.title.slice(0, 14)}
								</div>
							)}
						</div>
						<h3 className="mt-2 line-clamp-1 text-sm font-medium transition-colors group-hover:text-neon-blue">
							{p.title}
						</h3>
						<p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
							{p.author ? getDisplayName(p.author) : "佚名"} ·{" "}
							{formatDistanceToNow(new Date(p.published_at), {
								addSuffix: true,
								locale: zhCN,
							})}
						</p>
					</Link>
				))}
			</div>
			<div
				aria-hidden
				className="h-2 w-full bg-[repeating-linear-gradient(90deg,currentColor_0_10px,transparent_10px_24px)] opacity-20"
			/>

			<div className="absolute top-1/2 right-0 flex -translate-y-1/2 gap-1.5">
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
	);
}
