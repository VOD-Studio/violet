import { stripPlaceholdersForPreview } from "@shared/ui/rich-text-input/use-rich-text-input";
import { Button, iconProps } from "@violet/ui";
import { MessageSquareQuote, Reply, Send, X } from "lucide-react";
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
	const placeholder = pendingShare
		? "为分享写点什么…"
		: conversationKind === "room"
			? `在 #${conversationTitle || "群聊"} 说点什么，输入 / 召唤角色`
			: conversationTitle
				? `发消息给 ${conversationTitle}`
				: "输入消息…";

	return (
		<div
			ref={composer.composerRef}
			onKeyDown={composer.onKeyDown}
			className="flex max-h-[50%] min-h-0 shrink-0 flex-col px-3 pb-3 pt-2 md:px-4 md:pb-4"
		>
			<div className="relative mx-auto flex min-h-0 w-full max-w-4xl flex-col">
				<div className="-m-1 min-h-0 overflow-y-auto p-1">
					<ChatRichInput
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
						commandTrigger={
							<Button
								aria-label="召唤角色"
								aria-controls={
									commands.isCommandMenuOpen ? commands.listboxId : undefined
								}
								aria-expanded={commands.isCommandMenuOpen}
								aria-haspopup="listbox"
								iconOnly
								onClick={commands.toggleMenu}
								onMouseDown={(event) => event.preventDefault()}
								size="sm"
								title="召唤角色"
								variant="ghost"
							>
								<span className="font-mono text-[15px]">/</span>
							</Button>
						}
						toolbarEnd={
							<Button
								aria-label="发送消息"
								title="发送（Enter），Shift+Enter 换行"
								disabled={!composer.canSend}
								onClick={composer.sendMessage}
								iconOnly
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
