/**
 * 全站图集浏览流：照片堆叠卡片网格（T0 选型，PhotoStack）+ 页码分页。
 * 每张卡是一沓可拖拽翻页的照片叠（preview_urls），footer 标题区承担详情导航
 * （Link 不包裹整个 PhotoStack——栈内展开控件需要独立响应点击）。
 */

import { PhotoStack } from "@shared/ui/photo-stack";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { Button } from "@/shared/ui/base/button";
import { Skeleton } from "@/shared/ui/base/skeleton";
import { GALLERY_PAGE_SIZE } from "../api/queries";
import type { GallerySummary } from "../model/types";

export interface GalleryFeedProps {
	/** 当前页（1 起） */
	page: number;
	items: GallerySummary[];
	total: number;
	isLoading: boolean;
	onPageChange: (page: number) => void;
}

export function GalleryFeed({ page, items, total, isLoading, onPageChange }: GalleryFeedProps) {
	const totalPages = Math.max(1, Math.ceil(total / GALLERY_PAGE_SIZE));

	if (isLoading) {
		return (
			<div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }, (_, i) => (
					<Skeleton key={i} className="aspect-4/5 w-full rounded-2xl" />
				))}
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
				<Images className="size-10" />
				<p className="text-sm">还没有公开图集</p>
			</div>
		);
	}

	return (
		<div>
			<div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
				{items.map((g) => (
					<PhotoStack
						key={g.id}
						images={stackImages(g)}
						footer={
							<Link
								to="/galleries/$id"
								params={{ id: g.id }}
								className="group/gallery-link block min-w-0"
								aria-label={`查看图集：${g.title}`}
							>
								<h3 className="line-clamp-1 font-semibold transition-colors group-hover/gallery-link:text-primary">
									{g.title}
								</h3>
								<p className="mt-1 truncate font-mono text-xs text-muted-foreground">
									{g.author.username} · {g.item_count} 项 ·{" "}
									{formatDistanceToNow(new Date(g.created_at), {
										addSuffix: true,
										locale: zhCN,
									})}
								</p>
							</Link>
						}
					/>
				))}
			</div>

			{totalPages > 1 ? (
				<div className="mt-10 flex items-center justify-center gap-4">
					<Button
						variant="outline"
						size="icon"
						disabled={page <= 1}
						onClick={() => onPageChange(page - 1)}
						aria-label="上一页"
					>
						<ChevronLeft className="size-4" />
					</Button>
					<span className="font-mono text-sm text-muted-foreground">
						{page} / {totalPages}
					</span>
					<Button
						variant="outline"
						size="icon"
						disabled={page >= totalPages}
						onClick={() => onPageChange(page + 1)}
						aria-label="下一页"
					>
						<ChevronRight className="size-4" />
					</Button>
				</div>
			) : null}
		</div>
	);
}

export default GalleryFeed;

/** 堆叠图源：preview_urls（缩略图/首帧），一张都没有时回退封面 */
function stackImages(g: GallerySummary) {
	const urls = g.preview_urls.length > 0 ? g.preview_urls : g.cover_url ? [g.cover_url] : [];
	return urls.map((src, i) => ({ src, alt: i === 0 ? g.title : `${g.title} 之${i + 1}` }));
}
