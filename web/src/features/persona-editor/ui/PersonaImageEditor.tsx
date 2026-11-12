import type { PersonaAdminImage } from "@entities/persona/model/types";
import { contentImageUrl } from "@shared/lib/image-url";
import { Button, Input, Label, Tag, Textarea } from "@violet/ui";

import { Trash2 } from "lucide-react";

interface PersonaImageEditorProps {
	image: PersonaAdminImage;
	index: number;
	disabled: boolean;
	onPreview: (trigger: HTMLButtonElement) => void;
	onChange: (patch: Pick<PersonaAdminImage, "caption" | "alt_text_override">) => void;
	onRemove: () => void;
}

/** 单张设定图的顺序、说明与替代文本编辑面。 */
export function PersonaImageEditor({
	image,
	index,
	disabled,
	onPreview,
	onChange,
	onRemove,
}: PersonaImageEditorProps) {
	return (
		<div className="grid gap-4 p-2 sm:grid-cols-[128px_minmax(0,1fr)]">
			<div className="space-y-2">
				<button
					type="button"
					className="block aspect-4/3 w-full cursor-zoom-in overflow-hidden rounded-lg bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					onClick={(event) => onPreview(event.currentTarget)}
					aria-label={`预览第 ${index + 1} 张设定图`}
				>
					<img
						src={contentImageUrl(image.thumbnail || image.url, { width: 320 })}
						alt={
							image.alt_text_override || image.alt_text || `第 ${index + 1} 张设定图`
						}
						className="size-full object-cover"
						loading="lazy"
					/>
				</button>
				{index === 0 ? (
					<Tag tone="accent" className="w-fit">
						公开主视觉
					</Tag>
				) : null}
			</div>

			<div className="min-w-0 space-y-4">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<p className="truncate font-mono text-xs text-muted-foreground">
						{image.file_id}
					</p>
					{!disabled ? (
						<div className="flex items-center gap-1">
							<Button
								iconOnly
								type="button"
								variant="ghost"
								size="sm"
								className="text-destructive hover:bg-destructive/10 hover:text-destructive"
								onClick={onRemove}
								aria-label={`删除第 ${index + 1} 张设定图`}
							>
								<Trash2 className="size-4" />
							</Button>
						</div>
					) : null}
				</div>

				<div className="space-y-2">
					<Label htmlFor={`persona-image-caption-${image.file_id}`}>图片说明</Label>
					<Textarea
						id={`persona-image-caption-${image.file_id}`}
						value={image.caption}
						disabled={disabled}
						aria-invalid={Array.from(image.caption).length > 500}
						className="min-h-20 resize-y"
						placeholder="可选，说明这张设定图展示的内容"
						onChange={(event) =>
							onChange({
								caption: event.target.value,
								alt_text_override: image.alt_text_override,
							})
						}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor={`persona-image-alt-${image.file_id}`}>替代文本覆盖</Label>
					<Input
						id={`persona-image-alt-${image.file_id}`}
						value={image.alt_text_override}
						disabled={disabled}
						aria-invalid={Array.from(image.alt_text_override).length > 300}
						placeholder={image.alt_text || "描述图片中的关键信息"}
						onChange={(event) =>
							onChange({
								caption: image.caption,
								alt_text_override: event.target.value,
							})
						}
					/>
					{image.alt_text ? (
						<p className="text-xs leading-relaxed text-muted-foreground">
							留空时沿用素材库描述：{image.alt_text}
						</p>
					) : null}
				</div>
			</div>
		</div>
	);
}
