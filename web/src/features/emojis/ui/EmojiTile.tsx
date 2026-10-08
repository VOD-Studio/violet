import type { Emoji } from "@entities/emoji/model/types";
import styles from "@features/emojis/ui/EmojiPicker.module.css";
import { isImageURL } from "@shared/lib/url";
import { Tooltip, TooltipContent, TooltipTrigger } from "@violet/ui";
import { cn } from "cn";

/** 图片表情支持悬停与聚焦预览；自定义条目保留右键菜单标识。 */
export interface EmojiTileProps {
	emoji: Emoji;
	selected?: boolean;
	onSelect: (emoji: Emoji) => void;
}

export function EmojiTile({ emoji, selected = false, onSelect }: EmojiTileProps) {
	const imageUrl = emoji.gif_url || emoji.url;
	const hasImage = !!imageUrl && isImageURL(imageUrl);
	const label = selected ? `${emoji.name}（已选择）` : emoji.name;
	const button = (
		<button
			type="button"
			aria-label={label}
			disabled={selected}
			onClick={() => onSelect(emoji)}
			className={cn(
				"flex items-center justify-center overflow-hidden rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-ring",
				hasImage ? "aspect-square w-full p-0.5" : "h-9 w-full px-1",
				selected ? "cursor-not-allowed opacity-40" : "hover:bg-accent",
			)}
		>
			{hasImage ? (
				<img
					src={imageUrl}
					alt={emoji.name}
					data-custom-emoji-id={emoji.custom_emoji_id}
					data-relation={emoji.relation}
					className="h-full w-full object-contain"
					loading="lazy"
				/>
			) : (
				<span className="block overflow-hidden whitespace-nowrap text-sm leading-none">
					{emoji.text_content ?? emoji.name}
				</span>
			)}
		</button>
	);

	if (!hasImage) return button;

	return (
		<Tooltip>
			<TooltipTrigger asChild>{button}</TooltipTrigger>
			<TooltipContent
				aria-label={`${emoji.name}预览`}
				side="top"
				sideOffset={8}
				collisionPadding={12}
				className={styles.preview}
			>
				<img src={imageUrl} alt={`${emoji.name}预览`} className="size-36 object-contain" />
				<p className="mt-2 max-w-36 wrap-break-word text-center text-xs">{emoji.name}</p>
			</TooltipContent>
		</Tooltip>
	);
}
