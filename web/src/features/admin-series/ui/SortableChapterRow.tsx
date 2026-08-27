import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SeriesChapterDTO } from "@features/admin-series/model/types";
import { Badge } from "@shared/ui/base/badge";
import { GripVertical, Link2, Trash2 } from "lucide-react";

interface SortableChapterRowProps {
	chapter: SeriesChapterDTO;
	/** 拖拽句柄之外的行点击行为（跳编辑文章，由父级决定） */
	onRemove: (postId: string) => void;
}

/** 卷内/根范围的可拖拽章节行：拖拽句柄 + 标题 + 状态 + 摘除按钮。 */
export function SortableChapterRow({ chapter, onRemove }: SortableChapterRowProps) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: chapter.post_id,
	});
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.4 : 1,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className="flex items-center gap-3 rounded-md border border-edge-hairline bg-background px-3 py-2"
		>
			<button
				type="button"
				className="text-muted-foreground hover:text-foreground cursor-grab touch-none active:cursor-grabbing"
				aria-label="拖拽排序"
				{...attributes}
				{...listeners}
			>
				<GripVertical className="size-4" />
			</button>
			<span className="text-muted-foreground w-6 shrink-0 font-mono text-xs">
				{String(chapter.chapter_no).padStart(2, "0")}
			</span>
			<span className="min-w-0 flex-1">
				<span className="block truncate text-sm font-medium">{chapter.title}</span>
				<span className="text-muted-foreground flex items-center gap-1 truncate font-mono text-xs">
					<Link2 className="size-3" />
					{chapter.slug}
				</span>
			</span>
			{chapter.status && chapter.status !== "published" && (
				<Badge variant="outline">
					{chapter.status === "draft" ? "草稿（书页隐藏）" : "已归档（书页隐藏）"}
				</Badge>
			)}
			<button
				type="button"
				onClick={() => onRemove(chapter.post_id)}
				className="text-muted-foreground hover:text-destructive"
				title="摘除章节（文章不受影响）"
			>
				<Trash2 className="size-3.5" />
			</button>
		</div>
	);
}
