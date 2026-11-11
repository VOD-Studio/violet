import type { SeriesChapterDTO } from "@features/admin-series/model/types";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Button, Sortable } from "@violet/ui";
import { BookPlus, Trash2 } from "lucide-react";
import { SortableChapterRow } from "./SortableChapterRow";

interface SeriesChapterScopeProps {
	label: string | null;
	chapters: SeriesChapterDTO[];
	disabled: boolean;
	onAttach: () => void;
	onDetach: (chapter: SeriesChapterDTO) => void;
	onReorder: (chapters: SeriesChapterDTO[]) => Promise<unknown>;
	onRemoveSection?: () => void;
}

/** 卷内或书根的章节列表；跨卷移动仍由挂入和摘除完成。 */
export function SeriesChapterScope({
	label,
	chapters,
	disabled,
	onAttach,
	onDetach,
	onReorder,
	onRemoveSection,
}: SeriesChapterScopeProps) {
	return (
		<div className="rounded-lg border border-edge-hairline p-4">
			<div className="mb-3 flex items-center justify-between">
				<h3 className="text-sm font-medium">{label ?? "书根章节（未分卷）"}</h3>
				<PermissionGuard permission="series:update">
					<div className="flex items-center gap-1">
						<Button size="sm" variant="outline" onClick={onAttach}>
							<BookPlus className="size-4" />
							挂入章节
						</Button>
						{onRemoveSection && (
							<Button
								iconOnly
								size="sm"
								variant="ghost"
								aria-label={`删除卷 ${label}`}
								title="删除卷（须先移出全部章节）"
								onClick={onRemoveSection}
							>
								<Trash2 className="size-4" />
							</Button>
						)}
					</div>
				</PermissionGuard>
			</div>
			{chapters.length === 0 ? (
				<p className="py-4 text-center text-sm text-muted-foreground">暂无章节</p>
			) : (
				<Sortable
					aria-label={`${label ?? "书根"}章节顺序`}
					items={chapters}
					getId={(chapter) => chapter.post_id}
					getLabel={(chapter) => chapter.title}
					disabled={disabled}
					onReorder={onReorder}
					renderItem={(chapter) => (
						<SortableChapterRow chapter={chapter} onRemove={() => onDetach(chapter)} />
					)}
				/>
			)}
		</div>
	);
}
