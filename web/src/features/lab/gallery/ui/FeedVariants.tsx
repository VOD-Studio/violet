import { Play } from "lucide-react";
import type { MockGallery } from "../model/mock";
import { GalleryCover } from "./GalleryCover";

/**
 * 浏览流方向 A · 封面大卡片
 *
 * 封面即门面：大封面 + 标题/作者/项数，每卡一列信息，扫读靠图。
 */
export function FeedCoverCards({ galleries }: { galleries: MockGallery[] }) {
	return (
		<div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
			{galleries.map((g) => (
				<article key={g.id} className="group">
					<GalleryCover
						gallery={g}
						className="rounded-xl shadow-sm transition-transform duration-300 group-hover:-translate-y-1"
					/>
					<div className="mt-3 flex items-baseline justify-between gap-3">
						<h3 className="line-clamp-1 font-semibold group-hover:text-primary">
							{g.title}
						</h3>
						<span className="shrink-0 font-mono text-xs text-muted-foreground">
							{g.itemCount} 项
						</span>
					</div>
					<p className="mt-1 text-sm text-muted-foreground">
						{g.author} · {g.createdAt.slice(5)}
					</p>
				</article>
			))}
		</div>
	);
}

/**
 * 浏览流方向 B · 九宫格预览
 *
 * 封面 + 首 8 张缩略的九宫格——不点开就能感知图集内容密度，比单封面
 * 信息量大，代价是卡片更高。
 */
export function FeedGridPeek({ galleries }: { galleries: MockGallery[] }) {
	return (
		<div className="grid gap-6 sm:grid-cols-2">
			{galleries.map((g) => (
				<article key={g.id} className="group">
					<div className="grid aspect-square grid-cols-3 grid-rows-3 gap-0.5 overflow-hidden rounded-xl">
						<div className="col-span-2 row-span-2">
							<img
								src={g.cover}
								alt={g.title}
								loading="lazy"
								className="size-full object-cover"
							/>
						</div>
						{[1, 2, 3, 4, 5].map((i) => (
							<div key={i} className="relative">
								<img
									src={`https://picsum.photos/seed/${g.id}-peek${i}/300/300`}
									alt=""
									loading="lazy"
									className="size-full object-cover transition-opacity group-hover:opacity-80"
								/>
							</div>
						))}
						<div className="relative bg-muted">
							<span className="absolute inset-0 flex items-center justify-center font-mono text-xs text-muted-foreground">
								+{Math.max(g.itemCount - 5, 0)}
							</span>
						</div>
					</div>
					<div className="mt-3 flex items-baseline justify-between gap-3">
						<h3 className="line-clamp-1 font-semibold group-hover:text-primary">
							{g.title}
						</h3>
						<span className="shrink-0 font-mono text-xs text-muted-foreground">
							{g.itemCount} 项
						</span>
					</div>
				</article>
			))}
		</div>
	);
}

/**
 * 浏览流方向 C · 杂志横排
 *
 * hairline 行式条目：小封面开道 + 标题描述横排 + 行尾元数据，与
 * EditorialIndex 目录语言同源——最安静，图集多时扫读效率最高。
 */
export function FeedMagazineRows({ galleries }: { galleries: MockGallery[] }) {
	return (
		<div className="border-t border-edge-hairline">
			{galleries.map((g) => (
				<article
					key={g.id}
					className="group flex items-center gap-5 border-b border-edge-hairline py-4"
				>
					<img
						src={g.cover}
						alt={g.title}
						loading="lazy"
						className="w-28 shrink-0 rounded-md object-cover shadow-sm aspect-4/3"
					/>
					<div className="min-w-0 flex-1">
						<h3 className="line-clamp-1 text-lg font-semibold group-hover:text-primary">
							{g.title}
						</h3>
						<p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
							{g.description}
						</p>
					</div>
					<div className="hidden shrink-0 items-center gap-3 font-mono text-xs text-muted-foreground sm:flex">
						<span>{g.author}</span>
						<span>{g.itemCount} 项</span>
						<span>{g.createdAt.slice(5)}</span>
					</div>
				</article>
			))}
		</div>
	);
}

/** 视频项角标（网格与卡片共用的播放提示） */
export function VideoBadge() {
	return (
		<span className="absolute inset-0 flex items-center justify-center">
			<span className="flex size-9 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
				<Play className="size-4 text-white" />
			</span>
		</span>
	);
}
