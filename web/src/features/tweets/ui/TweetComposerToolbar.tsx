import type { Emoji } from "@entities/emoji/model/types";
import { EmojiPicker } from "@features/emojis/ui/EmojiPicker";
import { urlErrorMessage, validateUrl } from "@shared/lib/url";
import { Button, Input, Label, Popover, PopoverContent, PopoverTrigger } from "@violet/ui";
import { Hash, ImagePlus, Link2, Smile } from "lucide-react";
import { useId, useRef, useState } from "react";
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
	onInsert: (text: string) => void;
	onEmojiSelect: (emoji: Emoji) => void;
}

export function TweetComposerToolbar({
	images,
	publishing,
	external,
	charCount,
	countId,
	onInsert,
	onEmojiSelect,
}: TweetComposerToolbarProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [linkOpen, setLinkOpen] = useState(false);
	const [topicOpen, setTopicOpen] = useState(false);
	const inserted = useRef(false);
	const editingExternal = !!(external?.active && !external.state.preview);
	const insert = (text: string) => {
		inserted.current = true;
		setLinkOpen(false);
		setTopicOpen(false);
		onInsert(text);
	};
	const restoreFocus = (event: Event) => {
		if (!inserted.current) return;
		inserted.current = false;
		event.preventDefault();
	};
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
					<Button
						variant="ghost"
						size="sm"
						iconOnly
						aria-label="添加图片"
						title={`添加图片（${images.count}/${MAX_TWEET_IMAGES}）`}
						onClick={() => inputRef.current?.click()}
						disabled={
							publishing.pending ||
							images.count >= MAX_TWEET_IMAGES ||
							images.uploading
						}
					>
						<ImagePlus />
					</Button>
					<Popover
						open={linkOpen || editingExternal}
						onOpenChange={(open) => {
							if (!open && editingExternal) external?.onToggle();
							setLinkOpen(open);
						}}
					>
						<PopoverTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								iconOnly
								aria-label="添加链接"
								disabled={publishing.pending}
							>
								<Link2 />
							</Button>
						</PopoverTrigger>
						<PopoverContent
							align="start"
							className={styles.sourcePopover}
							aria-label="添加链接"
							onCloseAutoFocus={restoreFocus}
						>
							{!editingExternal && <InsertField kind="link" onInsert={insert} />}
							{external && (!external.active || editingExternal) && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										setLinkOpen(editingExternal);
										external.onToggle();
									}}
								>
									{editingExternal ? "取消 X 转发" : "转发 X 推文"}
								</Button>
							)}
							{editingExternal && external && (
								<ExternalTweetPreviewPanel
									state={external.state}
									disabled={publishing.pending}
								/>
							)}
						</PopoverContent>
					</Popover>
					<Popover open={topicOpen} onOpenChange={setTopicOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								iconOnly
								aria-label="添加话题"
								disabled={publishing.pending}
							>
								<Hash />
							</Button>
						</PopoverTrigger>
						<PopoverContent
							align="start"
							className={styles.sourcePopover}
							aria-label="添加话题"
							onCloseAutoFocus={restoreFocus}
						>
							<InsertField kind="topic" onInsert={insert} />
						</PopoverContent>
					</Popover>
					<EmojiPicker
						onSelect={onEmojiSelect}
						align="start"
						closeOnSelect={false}
						trigger={
							<Button
								variant="ghost"
								size="sm"
								iconOnly
								aria-label="添加表情"
								title="添加表情"
								disabled={publishing.pending}
							>
								<Smile />
							</Button>
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
				<Button
					type="submit"
					variant="primary"
					size="sm"
					disabled={!publishing.canSubmit && !publishing.pending}
					loading={publishing.pending}
					loadingText="发布中…"
				>
					发布
				</Button>
			</div>
			{images.uploading && (
				<p role="status" className={`${styles.status} text-xs text-muted-foreground`}>
					图片上传中，完成后即可发布。
				</p>
			)}
		</>
	);
}

function InsertField({
	kind,
	onInsert,
}: {
	kind: "link" | "topic";
	onInsert: (text: string) => void;
}) {
	const id = useId();
	const [value, setValue] = useState("");
	const [error, setError] = useState<string | null>(null);
	const isLink = kind === "link";
	const submit = () => {
		const text = value.trim();
		const invalid = isLink
			? urlErrorMessage(validateUrl(text))
			: /^[^#\r\n]{1,50}$/u.test(text)
				? null
				: "请输入 1 到 50 字的话题名，不含 # 或换行。";
		setError(invalid);
		if (!invalid) onInsert(isLink ? new URL(text).href : `#${text}#`);
	};
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{isLink ? "网页链接" : "话题名"}</Label>
			<div className="flex items-center gap-2">
				<Input
					id={id}
					type={isLink ? "url" : "text"}
					placeholder={isLink ? "https://…" : "例如：街角摄影"}
					value={value}
					aria-invalid={!!error}
					aria-describedby={error ? `${id}-error` : undefined}
					onChange={(event) => {
						setValue(event.target.value);
						setError(null);
					}}
					onKeyDown={(event) => {
						if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
						event.preventDefault();
						submit();
					}}
				/>
				<Button variant="secondary" size="sm" onClick={submit}>
					插入
				</Button>
			</div>
			{error && (
				<p id={`${id}-error`} role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}
		</div>
	);
}
