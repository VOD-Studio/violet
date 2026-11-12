import type { GalleryDraftSaveState } from "@features/gallery-editor/hooks/useGalleryDraftDocument";
import { iconProps, Spinner } from "@violet/ui";
import { Check, TriangleAlert } from "lucide-react";

interface GallerySaveIndicatorProps {
	state: GalleryDraftSaveState;
}

/** 向辅助技术持续播报工作稿保存状态。 */
export function GallerySaveIndicator({ state }: GallerySaveIndicatorProps) {
	const content: Record<GalleryDraftSaveState, { label: string; icon?: React.ReactNode }> = {
		saved: { label: "已保存", icon: <Check {...iconProps(14)} /> },
		dirty: { label: "等待自动保存" },
		saving: { label: "保存中", icon: <Spinner size={16} aria-hidden="true" /> },
		error: { label: "自动保存失败" },
		conflict: { label: "版本冲突", icon: <TriangleAlert {...iconProps(14)} /> },
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
