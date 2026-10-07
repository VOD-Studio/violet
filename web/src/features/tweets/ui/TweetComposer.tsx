import { toEmojiToken } from "@entities/emoji/model/token";
import type { Emoji } from "@entities/emoji/model/types";
import type { QuotedTweet, Tweet } from "@entities/tweet/model/types";
import { useMe } from "@features/auth/api/queries";
import { avatarUrl } from "@shared/lib/image-url";
import { isImageURL } from "@shared/lib/url";
import { Label, Textarea } from "@violet/ui";
import { useId, useRef, useState } from "react";
import { useExternalTweetPreview } from "../hooks/useExternalTweetPreview";
import { useTweetComposerImages } from "../hooks/useTweetComposerImages";
import { useTweetComposerSubmit } from "../hooks/useTweetComposerSubmit";
import { MAX_TWEET_LENGTH } from "../model/types";
import { ExternalTweetPreviewPanel } from "./ExternalTweetPreviewPanel";
import styles from "./TweetComposer.module.css";
import { TweetComposerAttachments } from "./TweetComposerAttachments";
import { TweetComposerToolbar } from "./TweetComposerToolbar";

/** 推文发布框的引用目标与完成回调。 */
export interface TweetComposerProps {
	quotedTweet?: Tweet | QuotedTweet;
	onSuccess?: () => void;
	onCancelQuote?: () => void;
}

/** 添加或移除 X 原文保留正文与附图，链接浮层仅管理来源凭证。 */
export function TweetComposer({ quotedTweet, onSuccess, onCancelQuote }: TweetComposerProps = {}) {
	const me = useMe();
	const [content, setContent] = useState("");
	const [mode, setMode] = useState<"write" | "external">("write");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const contentId = useId();
	const countId = useId();
	const errorId = useId();
	const external = useExternalTweetPreview();
	const media = useTweetComposerImages();
	const externalMode = mode === "external" && !quotedTweet;
	const submission = useTweetComposerSubmit({
		content,
		images: media.doneUrls,
		quoteId: quotedTweet?.id,
		externalMode,
		external,
		uploading: media.uploading,
		onSuccess: () => {
			setMode("write");
			setContent("");
			media.clearImages();
			onSuccess?.();
		},
	});
	const charCount = [...content].length;
	const overLimit = charCount > MAX_TWEET_LENGTH;
	const changeMode = (next: "write" | "external") => {
		if (submission.isPending || next === mode) return;
		external.reset();
		setMode(next);
	};
	const handleFiles = async (files: FileList | File[] | null) => {
		if (submission.isPending) return;
		await media.addFiles(files);
	};
	const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
		const files = Array.from(event.clipboardData.files).filter((file) =>
			file.type.startsWith("image/"),
		);
		if (!files.length) return;
		if (!event.clipboardData.getData("text/plain")) event.preventDefault();
		void handleFiles(files);
	};
	const handleEmojiSelect = (emoji: Emoji) => {
		if (submission.isPending) return;
		const imageUrl = emoji.gif_url || emoji.url;
		const text =
			imageUrl && isImageURL(imageUrl)
				? toEmojiToken(emoji)
				: emoji.text_content || emoji.name;
		const textarea = textareaRef.current;
		const start = textarea?.selectionStart ?? content.length;
		const end = textarea?.selectionEnd ?? content.length;
		setContent(content.slice(0, start) + text + content.slice(end));
		requestAnimationFrame(() => {
			textarea?.focus();
			textarea?.setSelectionRange(start + text.length, start + text.length);
		});
	};

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				submission.submit();
			}}
			aria-label="发布推文"
			aria-busy={submission.isPending}
			className={
				quotedTweet ? `${styles.composer} ${styles.quotedComposer}` : styles.composer
			}
		>
			{me.data && (
				<img
					src={avatarUrl(me.data.avatar_url, me.data.username)}
					alt={me.data.username}
					className={styles.avatar}
				/>
			)}
			<div className={styles.editor}>
				<Label htmlFor={contentId} className="sr-only">
					推文正文
				</Label>
				<Textarea
					id={contentId}
					ref={textareaRef}
					value={content}
					onChange={(event) => setContent(event.target.value)}
					onPaste={handlePaste}
					placeholder="有什么新鲜事？"
					disabled={submission.isPending}
					rows={2}
					aria-invalid={overLimit || !!submission.error}
					aria-describedby={`${countId}${overLimit || submission.error ? ` ${errorId}` : ""}`}
					className={styles.field}
					onKeyDown={(event) => {
						if (
							event.key === "Enter" &&
							(event.metaKey || event.ctrlKey) &&
							!event.nativeEvent.isComposing
						) {
							event.preventDefault();
							submission.submit();
						}
					}}
				/>
			</div>
			{externalMode && external.preview && (
				<div className={styles.references}>
					<ExternalTweetPreviewPanel state={external} disabled={submission.isPending} />
				</div>
			)}
			{(media.images.length > 0 || quotedTweet) && (
				<div className={styles.references}>
					<TweetComposerAttachments
						images={media.images}
						quotedTweet={quotedTweet}
						disabled={submission.isPending}
						onRemoveImage={media.removeImage}
						onCancelQuote={onCancelQuote}
					/>
				</div>
			)}
			{(overLimit || submission.error) && (
				<p
					id={errorId}
					role="alert"
					className={`${styles.status} text-sm text-destructive`}
				>
					{overLimit
						? `正文不能超过 ${MAX_TWEET_LENGTH} 字，请精简后发布。`
						: submission.error}
				</p>
			)}
			<TweetComposerToolbar
				images={{
					count: media.images.length,
					uploading: media.uploading,
					onFiles: handleFiles,
				}}
				publishing={{ pending: submission.isPending, canSubmit: submission.canSubmit }}
				external={
					quotedTweet
						? undefined
						: {
								active: externalMode,
								state: external,
								onToggle: () => changeMode(externalMode ? "write" : "external"),
							}
				}
				charCount={charCount}
				countId={countId}
				onEmojiSelect={handleEmojiSelect}
			/>
		</form>
	);
}

export default TweetComposer;
