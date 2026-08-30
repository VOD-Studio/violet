import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { GalleryItem } from "@entities/gallery/model/types";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import { Textarea } from "@shared/ui/base/textarea";
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from "lucide-react";

interface GalleryItemEditorProps {
	item: GalleryItem;
	index: number;
	total: number;
	disabled: boolean;
	onChange: (patch: Pick<GalleryItem, "caption" | "alt_text_override">) => void;
	onMove: (to: number) => void;
	onRemove: () => void;
}

/** 单个图集项的顺序、说明与替代文本编辑面。 */
export function GalleryItemEditor({
	item,
	index,
	total,
	disabled,
	onChange,
	onMove,
	onRemove,
}: GalleryItemEditorProps) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: item.file_id,
		disabled,
	});
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[112px_minmax(0,1fr)]"
		>
			<div className="relative overflow-hidden rounded-lg bg-muted">
				<img
					src={item.thumbnail || item.url}
					alt={item.alt_text_override || item.asset_alt_text || `第 ${index + 1} 张图片`}
					className="aspect-3/4 w-full object-cover"
				/>
				<span className="absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium tabular-nums">
					{index + 1}
				</span>
			</div>

			<div className="min-w-0 space-y-4">
				<div className="flex flex-wrap items-center gap-1">
					<button
						type="button"
						className="mr-1 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
						disabled={disabled}
						aria-label={`拖拽第 ${index + 1} 张图片排序`}
						{...attributes}
						{...listeners}
					>
						<GripVertical className="size-4" />
					</button>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						disabled={disabled || index === 0}
						onClick={() => onMove(index - 1)}
						aria-label={`将第 ${index + 1} 张图片前移`}
					>
						<ArrowUp className="size-4" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						disabled={disabled || index === total - 1}
						onClick={() => onMove(index + 1)}
						aria-label={`将第 ${index + 1} 张图片后移`}
					>
						<ArrowDown className="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="ml-auto text-destructive hover:text-destructive"
						disabled={disabled}
						onClick={onRemove}
					>
						<Trash2 className="size-4" />
						移除
					</Button>
				</div>

				<div className="space-y-2">
					<Label htmlFor={`gallery-caption-${item.file_id}`}>图片说明</Label>
					<Textarea
						id={`gallery-caption-${item.file_id}`}
						value={item.caption}
						maxLength={500}
						disabled={disabled}
						placeholder="可选，补充图片的上下文"
						className="min-h-18 resize-y"
						onChange={(event) =>
							onChange({
								caption: event.target.value,
								alt_text_override: item.alt_text_override,
							})
						}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor={`gallery-alt-${item.file_id}`}>替代文本覆盖</Label>
					<Input
						id={`gallery-alt-${item.file_id}`}
						value={item.alt_text_override}
						maxLength={300}
						disabled={disabled}
						placeholder={item.asset_alt_text || "可选，用于无障碍与 SEO"}
						onChange={(event) =>
							onChange({
								caption: item.caption,
								alt_text_override: event.target.value,
							})
						}
					/>
				</div>
			</div>
		</div>
	);
}
