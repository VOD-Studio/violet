import type { MediaFile } from "@entities/media/model/types";
import { MediaViewer, type MediaViewerItem } from "@shared/ui/media-viewer";

interface MediaLightboxProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	files: MediaFile[];
	index: number;
	onIndexChange: (index: number) => void;
	triggerElement?: HTMLElement | null;
}

function toViewerItem(file: MediaFile): MediaViewerItem {
	return {
		id: file.id,
		url: file.url,
		thumbnailUrl: file.thumbnail || undefined,
		mimeType: file.mime_type,
		name: file.original_name,
		size: file.size,
	};
}

/** 将素材库读模型适配到公共媒体查看器。 */
export function MediaLightbox({
	open,
	onOpenChange,
	files,
	index,
	onIndexChange,
	triggerElement,
}: MediaLightboxProps) {
	return (
		<MediaViewer
			open={open}
			onOpenChange={onOpenChange}
			items={files.map(toViewerItem)}
			index={index}
			onIndexChange={onIndexChange}
			triggerElement={triggerElement}
		/>
	);
}
