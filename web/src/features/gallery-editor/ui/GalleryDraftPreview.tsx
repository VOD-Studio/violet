import type { GalleryItem } from "@entities/gallery/model/types";
import { PhotoStack } from "@shared/ui/photo-stack";
import { Images } from "lucide-react";

interface GalleryDraftPreviewProps {
	title: string;
	summary: string;
	items: GalleryItem[];
}

/** 使用生产 PhotoStack 即时预览当前工作稿，不截断图片数组。 */
export function GalleryDraftPreview({ title, summary, items }: GalleryDraftPreviewProps) {
	if (items.length === 0) {
		return (
			<div className="flex aspect-3/4 items-center justify-center rounded-xl border border-dashed bg-muted/30 text-muted-foreground">
				<div className="text-center">
					<Images className="mx-auto mb-2 size-8" />
					<p className="text-sm">选择图片后可在这里预览</p>
				</div>
			</div>
		);
	}

	return (
		<PhotoStack
			images={items.map((item, index) => ({
				src: item.thumbnail || item.url,
				alt:
					item.alt_text_override ||
					item.asset_alt_text ||
					(title ? `${title} · ${index + 1}` : `图集图片 ${index + 1}`),
			}))}
			footer={
				<div>
					<p className="truncate font-medium">{title || "未命名图集"}</p>
					{summary ? (
						<p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{summary}</p>
					) : null}
				</div>
			}
		/>
	);
}
