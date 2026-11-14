import { toInlineEmoji, toInlineEmojis } from "@entities/emoji/lib/inline-emoji";
import { useAllEmojis } from "@features/emojis/api/queries";
import { EmojiPicker } from "@features/emojis/ui/EmojiPicker";
import { useChunkedUpload } from "@features/upload/hooks/use-chunked-upload";
import { RichTextInput, type RichTextInputProps } from "@shared/ui/rich-text-input/RichTextInput";
import { Button } from "@violet/ui";
import { AtSign, Plus } from "lucide-react";
import { type ReactNode, useMemo } from "react";

interface ChatRichInputProps
	extends Omit<RichTextInputProps, "emojis" | "active" | "uploadFile" | "renderEmojiPicker"> {
	uploadPurpose?: string;
	/** 传入后按聊天页布局排列附件、角色、提及与表情入口。 */
	commandTrigger?: ReactNode;
}

/** 聊天输入的表情与上传适配，不依赖评论业务或批注上下文。 */
export function ChatRichInput({
	uploadPurpose = "chat",
	commandTrigger,
	...props
}: ChatRichInputProps) {
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
			renderInlineActions={
				commandTrigger
					? ({ attachImage, canAttachImage, startMention, emojiPicker }) => ({
							start: (
								<>
									{attachImage && (
										<Button
											aria-label="添加附件"
											disabled={!canAttachImage}
											iconOnly
											onClick={attachImage}
											onMouseDown={(event) => event.preventDefault()}
											size="sm"
											title="添加图片附件"
											variant="ghost"
										>
											<Plus className="size-4" />
										</Button>
									)}
									{commandTrigger}
								</>
							),
							end: (
								<>
									<Button
										aria-label="提及"
										disabled={!startMention}
										iconOnly
										onClick={startMention ?? undefined}
										onMouseDown={(event) => event.preventDefault()}
										size="sm"
										title={startMention ? "提及会话成员" : "暂无可提及的成员"}
										variant="ghost"
									>
										<AtSign className="size-4" />
									</Button>
									{emojiPicker}
								</>
							),
						})
					: props.renderInlineActions
			}
		/>
	);
}
