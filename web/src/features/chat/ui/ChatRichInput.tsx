import { toInlineEmoji, toInlineEmojis } from "@entities/emoji/lib/inline-emoji";
import { useAllEmojis } from "@features/emojis/api/queries";
import { EmojiPicker } from "@features/emojis/ui/EmojiPicker";
import { useChunkedUpload } from "@features/upload/hooks/use-chunked-upload";
import { RichTextInput, type RichTextInputProps } from "@shared/ui/rich-text-input/RichTextInput";
import { useMemo } from "react";

interface ChatRichInputProps
	extends Omit<RichTextInputProps, "emojis" | "active" | "uploadFile" | "renderEmojiPicker"> {
	uploadPurpose?: string;
}

/** 聊天输入的表情与上传适配，不依赖评论业务或批注上下文。 */
export function ChatRichInput({ uploadPurpose = "chat", ...props }: ChatRichInputProps) {
	const { data: emojiGroups } = useAllEmojis();
	const emojis = useMemo(() => toInlineEmojis(emojiGroups ?? []), [emojiGroups]);
	const { uploadFile } = useChunkedUpload({ purpose: uploadPurpose });
	return (
		<RichTextInput
			{...props}
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
