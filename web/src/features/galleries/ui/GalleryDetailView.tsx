import { useMe } from "@features/auth/api/queries";
import { avatarUrl, contentImageUrl } from "@shared/lib/image-url";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Edit, Film, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/shared/ui/base/button";
import { ImagePreview } from "@/shared/ui/image-preview";
import { Modal } from "@/shared/ui/modal";
import { justifyRows } from "../lib/justify-layout";
import type { GalleryDetail, GalleryItem } from "../model/types";

const TARGET_ROW_HEIGHT = 220;
const GRID_GAP = 8;

export interface GalleryDetailViewProps {
	gallery: GalleryDetail;
}

/**
 * 图集详情主体：图片项点击进全屏灯箱（shared ImagePreview，←/→ 键盘导航），
 * 底部外挂当前项 caption；视频项点击进弹层 `<video controls>` 播放。
 * 灯箱序列只含图片项（视频源无法交给图片预览渲染），网格顺序保持。
 */
export function GalleryDetailView({ gallery }: GalleryDetailViewProps) {
	const { data: me } = useMe();
	const isOwner = !!me && me.id === gallery.author.id;
	const items = gallery.items;

	// 灯箱：序列只含图片项，lightboxIndex 指向该子序列
	const imageItems = useMemo(() => items.filter((it) => isImageItem(it)), [items]);
	const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
	const [videoItem, setVideoItem] = useState<GalleryItem | null>(null);
	const gridRef = useRef<HTMLDivElement>(null);
	const [gridWidth, setGridWidth] = useState(0);

	useEffect(() => {
		const el = gridRef.current;
		if (!el || typeof ResizeObserver === "undefined") return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setGridWidth(entry.contentRect.width);
			}
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const rows = useMemo(
		() => justifyRows(items, gridWidth, TARGET_ROW_HEIGHT, GRID_GAP),
		[items, gridWidth],
	);

	const currentCaption =
		lightboxIndex !== null && imageItems[lightboxIndex]
			? imageItems[lightboxIndex].caption
			: (videoItem?.caption ?? "");

	return (
		<div>
			<header className="mb-8">
				<p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
					Galleries
				</p>
				<h1 className="text-3xl font-bold">{gallery.title}</h1>
				<div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
					<Link
						to="/users/$username"
						params={{ username: gallery.author.username }}
						className="flex items-center gap-1.5 hover:text-foreground"
					>
						<img
							src={avatarUrl(gallery.author.avatar_url, gallery.author.username)}
							alt={gallery.author.username}
							className="size-5 rounded-full object-cover"
						/>
						{gallery.author.username}
					</Link>
					<span>·</span>
					<span>{gallery.item_count} 项</span>
					<span>·</span>
					<span>
						{formatDistanceToNow(new Date(gallery.created_at), {
							addSuffix: true,
							locale: zhCN,
						})}
					</span>
					{isOwner ? (
						<Button variant="outline" size="sm" asChild className="ml-auto">
							<Link
								to="/galleries/$id/edit"
								params={{ id: gallery.id }}
								aria-label="编辑图集"
							>
								<Edit className="size-3.5" />
								编辑
							</Link>
						</Button>
					) : null}
				</div>
				{gallery.description ? (
					<p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
						{gallery.description}
					</p>
				) : null}
			</header>

			<div ref={gridRef}>
				{gridWidth > 0 ? (
					<div className="flex flex-col" style={{ gap: GRID_GAP }}>
						{rows.map((row, ri) => (
							<div key={ri} className="flex" style={{ gap: GRID_GAP }}>
								{row.cells.map((cell) => {
									const it = items[cell.index];
									return (
										<MediaCell
											key={it.file_id}
											item={it}
											width={cell.w}
											height={cell.h}
											onOpen={() =>
												isImageItem(it)
													? setLightboxIndex(imageIndexOf(imageItems, it))
													: setVideoItem(it)
											}
										/>
									);
								})}
							</div>
						))}
					</div>
				) : null}
			</div>

			{/* 图片灯箱：序列为图片项，缩略图对应飞入动画 */}
			<ImagePreview
				open={lightboxIndex !== null}
				onClose={() => setLightboxIndex(null)}
				images={imageItems.map((it) => it.url)}
				thumbnails={imageItems.map(
					(it) => it.thumbnail || contentImageUrl(it.url, { width: 300 }),
				)}
				currentIndex={lightboxIndex ?? 0}
				onIndexChange={setLightboxIndex}
			/>
			{lightboxIndex !== null && currentCaption ? (
				// z-10000 盖过 ImagePreview portal 的 z-9999 遮罩
				<p className="pointer-events-none fixed inset-x-0 bottom-6 z-10000 text-center text-sm text-white/90 drop-shadow">
					{currentCaption}
				</p>
			) : null}

			{/* 视频弹层：原生控件播放 + caption */}
			<Modal
				open={!!videoItem}
				onOpenChange={(open) => {
					if (!open) setVideoItem(null);
				}}
				title={videoItem?.caption || "视频"}
				size="lg"
				footer={null}
			>
				{videoItem ? (
					// eslint-disable-next-line jsx-a11y/media-has-caption
					<video src={videoItem.url} controls autoPlay className="w-full rounded-lg" />
				) : null}
			</Modal>
		</div>
	);
}

export default GalleryDetailView;

function isImageItem(it: GalleryItem) {
	return !it.mime_type.startsWith("video/");
}

function imageIndexOf(imageItems: GalleryItem[], target: GalleryItem) {
	const i = imageItems.findIndex((it) => it.file_id === target.file_id);
	return i < 0 ? 0 : i;
}

interface MediaCellProps {
	item: GalleryItem;
	width: number;
	height: number;
	onOpen: () => void;
}

/** 网格单元：图片缩略档直出；视频用首帧缩略图 + 播放钮覆盖 */
function MediaCell({ item, width, height, onOpen }: MediaCellProps) {
	const isVideo = item.mime_type.startsWith("video/");
	const src =
		item.thumbnail ||
		(isVideo ? "" : contentImageUrl(item.url, { width: Math.ceil(width * 1.5) }));
	return (
		<button
			type="button"
			onClick={onOpen}
			className="group relative overflow-hidden rounded-lg bg-muted"
			style={{ width, height }}
			aria-label={item.caption || (isVideo ? "播放视频" : "查看图片")}
		>
			{src ? (
				<img
					src={src}
					alt={item.caption}
					loading="lazy"
					className="size-full object-cover"
				/>
			) : (
				<div className="flex size-full items-center justify-center text-muted-foreground">
					<Film className="size-8" />
				</div>
			)}
			{isVideo ? (
				<span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/40">
					<span className="flex size-11 items-center justify-center rounded-full bg-black/60 text-white">
						<Play className="size-5 translate-x-0.5 fill-current" />
					</span>
				</span>
			) : null}
			{item.caption ? (
				<span className="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/70 to-transparent px-2 py-1 text-left text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
					{item.caption}
				</span>
			) : null}
		</button>
	);
}
