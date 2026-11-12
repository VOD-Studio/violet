import { toInlineEmoji, toInlineEmojis } from "@entities/emoji/lib/inline-emoji";
import { useAllEmojis } from "@features/emojis/api/queries";
import { EmojiPicker } from "@features/emojis/ui/EmojiPicker";
import { useChunkedUpload } from "@features/upload/hooks/use-chunked-upload";
import { RichTextInput, type RichTextInputProps } from "@shared/ui/rich-text-input/RichTextInput";
import { useContext, useMemo } from "react";
import { AnnotationOverlayContext } from "./annotation-overlay-context";

/** 评论输入沿用批注可交互状态，上传用途可由推文评论等宿主指定。 */
export interface RichCommentInputProps
	extends Omit<RichTextInputProps, "emojis" | "active" | "uploadFile" | "renderEmojiPicker"> {
	/** 评论和推文各自声明上传用途。 */
	uploadPurpose?: string;
}

/** 评论业务适配：沿用批注可交互状态，注入表情查询与上传服务。 */
export function RichCommentInput({ uploadPurpose = "comment", ...props }: RichCommentInputProps) {
	const active = useContext(AnnotationOverlayContext);
	const { data: emojiGroups } = useAllEmojis();
	const emojis = useMemo(() => toInlineEmojis(emojiGroups ?? []), [emojiGroups]);
	const { uploadFile } = useChunkedUpload({ purpose: uploadPurpose });
	return (
		<RichTextInput
			{...props}
			active={active}
			emojis={emojis}
			uploadFile={uploadFile}
			renderEmojiPicker={({ onSelect, ...pickerProps }) => (
				<EmojiPicker
					{...pickerProps}
					onSelect={(emoji) => onSelect(toInlineEmoji(emoji))}
				/>
			)}
		/>
	);
}
