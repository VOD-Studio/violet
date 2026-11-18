import { toEmojiToken } from "@entities/emoji/model/token";
import type { Emoji } from "@entities/emoji/model/types";
import type { QuotedTweet, Tweet } from "@entities/tweet/model/types";
import { useMe } from "@features/auth/api/queries";
import { avatarUrl } from "@shared/lib/image-url";
import { isImageURL } from "@shared/lib/url";
import { Avatar, Button, Label, Modal, Textarea } from "@violet/ui";
import { SquarePen } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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
	/** 内联发布器滚出上沿后，显示继续编辑同一份草稿的入口。 */
	quickAccess?: boolean;
}

/** 添加或移除 X 原文保留正文与附图，链接浮层仅管理来源凭证。 */
export function TweetComposer({
	quotedTweet,
	onSuccess,
	onCancelQuote,
	quickAccess = false,
}: TweetComposerProps = {}) {
	const me = useMe();
	const [content, setContent] = useState("");
	const [mode, setMode] = useState<"write" | "external">("write");
	const inlineRef = useRef<HTMLDivElement>(null);
	const [hasScrolledPast, setHasScrolledPast] = useState(false);
	const [inlineHeight, setInlineHeight] = useState<number | null>(null);
	const quickOpen = inlineHeight !== null;
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const contentId = useId();
	const countId = useId();
	const errorId = useId();
	const external = useExternalTweetPreview();
	const media = useTweetComposerImages();
	const externalMode = mode === "external" && !quotedTweet;

	useEffect(() => {
		const inline = inlineRef.current;
		if (!quickAccess || !inline || typeof IntersectionObserver === "undefined") return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry) return;
				const top = entry.rootBounds?.top ?? 0;
				setHasScrolledPast(entry.boundingClientRect.bottom <= top);
			},
			{ rootMargin: "-96px 0px 0px" },
		);
		observer.observe(inline);
		return () => observer.disconnect();
	}, [quickAccess]);
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
			setInlineHeight(null);
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
	const insertText = (text: string, separate = false) => {
		if (submission.isPending) return;
		const textarea = textareaRef.current;
		const start = textarea?.selectionStart ?? content.length;
		const end = textarea?.selectionEnd ?? content.length;
		const before = content.slice(0, start);
		const after = content.slice(end);
		const leadingSpace = separate && before && !/\s$/.test(before) ? " " : "";
		const trailingSpace = separate && after && !/^\s/.test(after) ? " " : "";
		const next = before + leadingSpace + text + trailingSpace;
		setContent(next + after);
		requestAnimationFrame(() => {
			textarea?.focus();
			textarea?.setSelectionRange(next.length, next.length);
		});
	};
	const handleEmojiSelect = (emoji: Emoji) => {
		const imageUrl = emoji.gif_url || emoji.url;
		insertText(
			imageUrl && isImageURL(imageUrl)
				? toEmojiToken(emoji)
				: emoji.text_content || emoji.name,
		);
	};

	const form = (
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
				<Avatar
					src={avatarUrl(me.data.avatar_url, me.data.username)}
					name={me.data.username}
					alt=""
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
					variant="outline"
					autoSize={{ minRows: 2, maxRows: 10 }}
					value={content}
					onChange={(event) => setContent(event.target.value)}
					onPaste={handlePaste}
					placeholder="有什么新鲜事？"
					disabled={submission.isPending}
					aria-invalid={overLimit || !!submission.error}
					aria-describedby={`${countId}${overLimit || submission.error ? ` ${errorId}` : ""}`}
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
					<Button
						variant="ghost"
						size="sm"
						className="mt-2"
						disabled={submission.isPending}
						onClick={() => changeMode("write")}
					>
						取消 X 转发
					</Button>
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
				onInsert={(text) => insertText(text, true)}
				onEmojiSelect={handleEmojiSelect}
			/>
		</form>
	);

	if (!quickAccess) return form;

	return (
		<>
			<div ref={inlineRef} style={{ blockSize: inlineHeight ?? undefined }}>
				{!quickOpen && form}
			</div>
			{(hasScrolledPast || quickOpen) && (
				<Button
					variant="primary"
					aria-haspopup="dialog"
					className="fixed right-4 bottom-24 z-30 lg:right-8 lg:bottom-8"
					leftIcon={<SquarePen />}
					onClick={() => {
						const height = inlineRef.current?.getBoundingClientRect().height;
						if (height !== undefined) setInlineHeight(height);
					}}
				>
					写推文
				</Button>
			)}
			<Modal
				open={quickOpen}
				onOpenChange={(open) => {
					if (!open) setInlineHeight(null);
				}}
				title="写推文"
				size="lg"
			>
				{quickOpen && form}
			</Modal>
		</>
	);
}

export default TweetComposer;
