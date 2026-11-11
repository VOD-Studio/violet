import type { GalleryItem } from "@entities/gallery/model/types";
import { Button, Input, Label, Textarea } from "@violet/ui";

import { Trash2 } from "lucide-react";

interface GalleryItemEditorProps {
	item: GalleryItem;
	index: number;
	disabled: boolean;
	onChange: (patch: Pick<GalleryItem, "caption" | "alt_text_override">) => void;
	onRemove: () => void;
}

/** 单个图集项的顺序、说明与替代文本编辑面。 */
export function GalleryItemEditor({
	item,
	index,
	disabled,
	onChange,
	onRemove,
}: GalleryItemEditorProps) {
	return (
		<div className="grid gap-4 p-2 sm:grid-cols-[112px_minmax(0,1fr)]">
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
						autoSize={{ minRows: 2, maxRows: 6 }}
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
