import type { SeriesChapterDTO } from "@features/admin-series/model/types";
import { Badge, Button, iconProps } from "@violet/ui";

import { Link2, Trash2 } from "lucide-react";

interface SortableChapterRowProps {
	chapter: SeriesChapterDTO;
	onRemove: (postId: string) => void;
}

/** 章节内容与摘除操作；顺序交给列表所属的 Sortable。 */
export function SortableChapterRow({ chapter, onRemove }: SortableChapterRowProps) {
	return (
		<div className="flex min-h-8 items-center gap-3">
			<span className="text-muted-foreground w-6 shrink-0 font-mono text-xs">
				{String(chapter.chapter_no).padStart(2, "0")}
			</span>
			<span className="min-w-0 flex-1">
				<span className="block truncate text-sm font-medium">{chapter.title}</span>
				<span className="text-muted-foreground flex items-center gap-1 truncate font-mono text-xs">
					<Link2 {...iconProps(12)} />
					{chapter.slug}
				</span>
			</span>
			{chapter.status && chapter.status !== "published" && (
				<Badge tone={chapter.status === "draft" ? "neutral" : "off"}>
					{chapter.status === "draft" ? "草稿（书页隐藏）" : "已归档（书页隐藏）"}
				</Badge>
			)}
			<Button
				iconOnly
				variant="ghost"
				size="sm"
				onClick={() => onRemove(chapter.post_id)}
				className="text-muted-foreground hover:text-destructive"
				title="摘除章节（文章不受影响）"
				aria-label={`摘除章节 ${chapter.title}`}
			>
				<Trash2 className="size-4" />
			</Button>
		</div>
	);
}
