import type { Emoji } from "@entities/emoji/model/types";
import { EmojiPicker } from "@features/emojis/ui/EmojiPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@violet/ui";
import { ImagePlus, Link2, Send, Smile } from "lucide-react";
import { useRef } from "react";
import type { ExternalTweetPreviewState } from "../hooks/useExternalTweetPreview";
import { MAX_TWEET_IMAGES, MAX_TWEET_LENGTH } from "../model/types";
import { ExternalTweetPreviewPanel } from "./ExternalTweetPreviewPanel";
import styles from "./TweetComposer.module.css";

/** 发布器的媒体选择、字数与提交状态。 */
export interface TweetComposerToolbarProps {
	images: {
		count: number;
		uploading: boolean;
		onFiles: (files: FileList | File[] | null) => Promise<void>;
	};
	publishing: { pending: boolean; canSubmit: boolean };
	external?: {
		active: boolean;
		state: ExternalTweetPreviewState;
		onToggle: () => void;
	};
	charCount: number;
	countId: string;
	onEmojiSelect: (emoji: Emoji) => void;
}

export function TweetComposerToolbar({
	images,
	publishing,
	external,
	charCount,
	countId,
	onEmojiSelect,
}: TweetComposerToolbarProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	return (
		<>
			<div className={styles.toolbar}>
				<div className="flex items-center gap-1">
					<input
						ref={inputRef}
						type="file"
						accept="image/*"
						multiple
						className="hidden"
						aria-label="上传推文图片"
						onChange={async (event) => {
							await images.onFiles(event.target.files);
							if (inputRef.current) inputRef.current.value = "";
						}}
					/>
					<button
						type="button"
						className={styles.action}
						aria-label="添加图片"
						title={`添加图片（最多 ${MAX_TWEET_IMAGES} 张）`}
						onClick={() => inputRef.current?.click()}
						disabled={
							publishing.pending ||
							images.count >= MAX_TWEET_IMAGES ||
							images.uploading
						}
					>
						<ImagePlus className="size-4" />
						{images.count > 0 && (
							<span className="text-xs text-muted-foreground">
								{images.count}/{MAX_TWEET_IMAGES}
							</span>
						)}
					</button>
					{external && (
						<Popover
							open={external.active && !external.state.preview}
							onOpenChange={(open) => {
								if (open !== external.active) external.onToggle();
							}}
						>
							<PopoverTrigger asChild>
								<button
									type="button"
									className={styles.action}
									aria-label={external.active ? "取消 X 转发" : "转发 X 推文"}
									aria-pressed={external.active}
									title={external.state.preview ? "移除 X 原文" : "转发 X 推文"}
									disabled={publishing.pending}
									onClick={(event) => {
										if (external.state.preview) {
											event.preventDefault();
											external.onToggle();
										}
									}}
								>
									<Link2 className="size-4" />
								</button>
							</PopoverTrigger>
							<PopoverContent
								align="start"
								sideOffset={6}
								collisionPadding={16}
								className={styles.sourcePopover}
								aria-label="添加 X 原文"
							>
								<ExternalTweetPreviewPanel
									state={external.state}
									disabled={publishing.pending}
								/>
							</PopoverContent>
						</Popover>
					)}
					<EmojiPicker
						onSelect={onEmojiSelect}
						align="start"
						closeOnSelect={false}
						trigger={
							<button
								type="button"
								className={styles.action}
								aria-label="添加表情"
								title="添加表情"
								disabled={publishing.pending}
							>
								<Smile className="size-4" />
							</button>
						}
					/>
					<span
						id={countId}
						className={`${styles.counter} ${charCount > MAX_TWEET_LENGTH ? "text-destructive" : "text-muted-foreground"}`}
					>
						{MAX_TWEET_LENGTH - charCount}
						<span className="sr-only"> 字剩余</span>
					</span>
				</div>
				<button
					type="submit"
					className={`${styles.action} ${styles.submit}`}
					disabled={!publishing.canSubmit}
					aria-busy={publishing.pending}
				>
					<span className={styles.submitLabel}>
						<Send className="size-3.5" />
						{publishing.pending ? "发布中…" : "发布"}
					</span>
				</button>
			</div>
			{images.uploading && (
				<p role="status" className={`${styles.status} text-xs text-muted-foreground`}>
					图片上传中，完成后即可发布。
				</p>
			)}
		</>
	);
}
