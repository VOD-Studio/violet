import type { GalleryDraftSaveState } from "@features/gallery-editor/hooks/useGalleryDraftDocument";
import { AlertTriangle, Check, Loader2 } from "lucide-react";

interface GallerySaveIndicatorProps {
	state: GalleryDraftSaveState;
}

/** 向辅助技术持续播报工作稿保存状态。 */
export function GallerySaveIndicator({ state }: GallerySaveIndicatorProps) {
	const content: Record<GalleryDraftSaveState, { label: string; icon?: React.ReactNode }> = {
		saved: { label: "已保存", icon: <Check className="size-3.5" /> },
		dirty: { label: "等待自动保存" },
		saving: { label: "保存中", icon: <Loader2 className="size-3.5 animate-spin" /> },
		error: { label: "自动保存失败" },
		conflict: { label: "版本冲突", icon: <AlertTriangle className="size-3.5" /> },
	};
	const current = content[state];
	return (
		<span
			className="inline-flex items-center gap-1 text-xs text-muted-foreground"
			role="status"
		>
			{current.icon}
			{current.label}
		</span>
	);
}
