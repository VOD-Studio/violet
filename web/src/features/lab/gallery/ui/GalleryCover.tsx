import { ImageOff } from "lucide-react";
import type { MockGallery } from "../model/mock";

/**
 * GalleryCover - 图集封面（浏览流共用件）。
 *
 * 有真图显示真图；无封面复用 PostCard 兜底（muted + ImageOff），
 * 不造假封面（与书籍封面规则一致）。
 */
export function GalleryCover({ gallery, className }: { gallery: MockGallery; className?: string }) {
	if (!gallery.cover) {
		return (
			<div
				className={`flex aspect-4/3 items-center justify-center bg-muted ${className ?? ""}`}
			>
				<ImageOff className="size-7 text-muted-foreground/50" />
			</div>
		);
	}
	return (
		<img
			src={gallery.cover}
			alt={gallery.title}
			loading="lazy"
			className={`aspect-4/3 w-full object-cover ${className ?? ""}`}
		/>
	);
}
