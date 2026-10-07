import type { Emoji } from "@entities/emoji/model/types";
import { EmojiPicker } from "@features/emojis/ui/EmojiPicker";
import { ImagePlus, Smile } from "lucide-react";
import { useRef } from "react";
import { MAX_TWEET_IMAGES, MAX_TWEET_LENGTH } from "../model/types";
import styles from "./TweetComposer.module.css";

/** 发布器的媒体选择、字数与提交状态。 */
export interface TweetComposerToolbarProps {
	images: {
		count: number;
		uploading: boolean;
		onFiles: (files: FileList | File[] | null) => Promise<void>;
	};
	publishing: { pending: boolean; canSubmit: boolean };
	charCount: number;
	countId: string;
	onEmojiSelect: (emoji: Emoji) => void;
}

export function TweetComposerToolbar({
	images,
	publishing,
	charCount,
	countId,
	onEmojiSelect,
}: TweetComposerToolbarProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	return (
		<>
			<div className="flex flex-wrap items-center justify-between gap-2">
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
				</div>
				<div className="flex items-center gap-3">
					<span
						id={countId}
						className={`text-xs tabular-nums ${charCount > MAX_TWEET_LENGTH ? "font-medium text-destructive" : "text-muted-foreground"}`}
					>
						{charCount}/{MAX_TWEET_LENGTH}
					</span>
					<button
						type="submit"
						className={`${styles.action} ${styles.submit}`}
						disabled={!publishing.canSubmit}
						aria-busy={publishing.pending}
					>
						<span className={styles.submitLabel}>
							{publishing.pending ? "发布中…" : "发布"}
						</span>
					</button>
				</div>
			</div>
			{images.uploading && (
				<p role="status" className="text-xs text-muted-foreground">
					图片上传中，完成后即可发布。
				</p>
			)}
		</>
	);
}
