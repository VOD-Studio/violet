import { stripPlaceholdersForPreview } from "@shared/ui/rich-text-input/use-rich-text-input";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	iconProps,
} from "@violet/ui";
import { MessageSquareQuote, Plus, Reply, Send, X } from "lucide-react";
import { useRef } from "react";
import { type UseMessageComposerOptions, useMessageComposer } from "../hooks/use-message-composer";
import { ChatRichInput } from "./ChatRichInput";
import { TweetSharingPreview } from "./TweetSharingPreview";

/** 回复和分享预览与输入栏共用一张纸面。 */
export interface MessageComposerProps extends UseMessageComposerOptions {
	/** 当前会话的展示名，用于群聊和私信输入提示。 */
	conversationTitle?: string;
}

export function MessageComposer({
	inputRef,
	conversationID,
	conversationKind = "direct",
	conversationTitle,
	currentUserID,
	currentUser,
	pendingShare,
	replyTarget,
	onCancelReply,
	onMessageSent,
}: MessageComposerProps) {
	const composer = useMessageComposer({
		inputRef,
		conversationID,
		conversationKind,
		currentUserID,
		currentUser,
		pendingShare,
		replyTarget,
		onCancelReply,
		onMessageSent,
	});
	const { commands } = composer;
	const inputAction = useRef<(() => void) | null>(null);
	const placeholder = pendingShare
		? "为分享写点什么…"
		: conversationTitle
			? `发给 ${conversationTitle}…`
			: "发送消息…";

	return (
		<div
			ref={composer.composerRef}
			onKeyDown={composer.onKeyDown}
			className="flex max-h-[50%] min-h-0 shrink-0 flex-col border-t border-border bg-card px-(--chat-gutter) pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:pb-5"
		>
			<div className="relative flex min-h-0 w-full flex-col">
				<div className="-m-1 min-h-0 overflow-y-auto p-1">
					<ChatRichInput
						inputClassName="min-h-10 py-2 text-[15px] leading-6"
						inlineHeader={
							<>
								{pendingShare ? (
									<div className="flex items-center gap-2 border-b border-border px-3 py-2">
										<MessageSquareQuote className="size-4 shrink-0 text-muted-foreground" />
										<div className="min-w-0 flex-1">
											<p className="text-xs font-medium text-foreground">
												分享推文 @{pendingShare.tweet.authorUsername}
											</p>
											<p className="truncate text-xs text-muted-foreground">
												{pendingShare.tweet.content ||
													(pendingShare.tweet.externalTweet
														? "X 推文转发"
														: pendingShare.tweet.quotedTweet
															? "本站引用"
															: "（图片推文）")}
											</p>
										</div>
										<Button
											aria-label="取消分享"
											iconOnly
											onClick={composer.clearPendingShare}
											size="sm"
											variant="ghost"
										>
											<X {...iconProps(14)} />
										</Button>
									</div>
								) : (
									replyTarget && (
										<div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
											<Reply className="size-3.5 shrink-0 text-muted-foreground" />
											<div className="flex min-w-0 flex-1 items-baseline gap-2 text-xs">
												<span className="max-w-1/2 shrink-0 truncate font-semibold text-primary">
													回复{" "}
													{replyTarget.sender.display_name ||
														replyTarget.sender.username}
												</span>
												<span className="truncate text-muted-foreground">
													{stripPlaceholdersForPreview(
														replyTarget.content ?? "",
													).trim() ||
														(replyTarget.type === "image"
															? "图片消息"
															: "文本消息")}
												</span>
											</div>
											<Button
												aria-label="取消回复"
												iconOnly
												onClick={onCancelReply}
												size="sm"
												variant="ghost"
											>
												<X {...iconProps(14)} />
											</Button>
										</div>
									)
								)}
								{pendingShare && (
									<div className="px-3 pt-3">
										<TweetSharingPreview id={pendingShare.tweet.id} />
									</div>
								)}
							</>
						}
						ref={composer.editorRef}
						value={composer.content}
						initialImageUploads={composer.images}
						onChange={composer.onContentChange}
						onSubmit={composer.sendMessage}
						onSlashQueryChange={commands.onQueryChange}
						onSlashKeyDown={commands.onKeyDown}
						slashSuggestions={commands.suggestions}
						slashListboxId={commands.listboxId}
						slashActiveOptionId={commands.activeOptionId}
						editorLabel="消息内容"
						enableEmoji
						enableImage={!pendingShare}
						inlineImages={!pendingShare}
						uploadPurpose="chat"
						submitOnEnter
						compact
						layout="inline"
						placeholder={placeholder}
						resetNonce={composer.resetNonce}
						onImageUploadsChange={composer.onImagesChange}
						mentionCandidates={composer.mentionCandidates}
						renderInlineActions={({
							attachImage,
							canAttachImage,
							startMention,
							emojiPicker,
						}) => ({
							start: (
								<DropdownMenu
									modal={false}
									onOpenChange={(open) => {
										if (open) inputAction.current = null;
									}}
								>
									<DropdownMenuTrigger asChild>
										<Button
											aria-label="添加内容"
											iconOnly
											size="sm"
											title="添加图片、提及成员或召唤角色"
											variant="ghost"
										>
											<Plus className="size-5" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent
										align="start"
										side="top"
										onCloseAutoFocus={(event) => {
											const action = inputAction.current;
											inputAction.current = null;
											if (action) {
												event.preventDefault();
												action();
											}
										}}
									>
										{attachImage && (
											<DropdownMenuItem
												disabled={!canAttachImage}
												onSelect={attachImage}
											>
												添加图片
											</DropdownMenuItem>
										)}
										<DropdownMenuItem
											disabled={!startMention}
											onSelect={() => {
												inputAction.current = startMention;
											}}
										>
											提及成员
										</DropdownMenuItem>
										<DropdownMenuItem
											onSelect={() => {
												inputAction.current = commands.toggleMenu;
											}}
										>
											召唤角色
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							),
							end: emojiPicker,
						})}
						toolbarEnd={
							<Button
								aria-label="发送消息"
								title="发送（Enter），Shift+Enter 换行"
								disabled={!composer.canSend}
								onClick={composer.sendMessage}
								iconOnly
								size="sm"
								variant="primary"
							>
								<Send className="size-4" />
							</Button>
						}
					/>
				</div>
			</div>
		</div>
	);
}
