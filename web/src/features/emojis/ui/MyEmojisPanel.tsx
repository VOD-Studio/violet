import type { Emoji } from "@entities/emoji/model/types";
import { useCreateCustomEmoji, useMyCustomEmojis } from "@features/customemoji/api/queries";
import { useUploadEmoji } from "@features/emojis/api/mutations";
import { EmojiTile } from "@features/emojis/ui/EmojiTile";
import { useFileSelection } from "@features/upload/hooks/use-file-selection";
import { Button, Input, UploadTile } from "@violet/ui";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const MAX_EMOJI_SIZE = 10 * 1024 * 1024;
// 占位符边界与 Markdown 标记不能出现在表情名称中。
const NAME_FORBIDDEN_RE = /[_*~`[\]\\]/;
const NAME_FORBIDDEN_RE_GLOBAL = /[_*~`[\]\\]/g;

interface PendingEmoji {
	file: File;
	preview: string;
	name: string;
}

/** 个人表情的文件选择、命名确认与网格。 */
export interface MyEmojisPanelProps {
	onSelect: (emoji: Emoji) => void;
}

export function MyEmojisPanel({ onSelect }: MyEmojisPanelProps) {
	const { data: mine, isLoading, isError, refetch } = useMyCustomEmojis(true);
	const uploadEmoji = useUploadEmoji();
	const createEmoji = useCreateCustomEmoji();
	const [pending, setPending] = useState<PendingEmoji | null>(null);
	const busy = uploadEmoji.isPending || createEmoji.isPending;
	const preview = pending?.preview;
	const owned = mine?.owned ?? [];
	const favorited = mine?.favorited ?? [];

	useEffect(
		() => () => {
			if (preview) URL.revokeObjectURL(preview);
		},
		[preview],
	);

	const { inputProps, open } = useFileSelection({
		accept: "image/png,image/jpeg,image/gif,image/webp",
		maxSize: MAX_EMOJI_SIZE,
		maxFiles: 1,
		disabled: !!pending,
		onSelect: ([file]) => {
			const name =
				file.name
					.replace(/\.[^./]+$/, "")
					.replace(NAME_FORBIDDEN_RE_GLOBAL, "")
					.trim()
					.slice(0, 50) || "表情";
			setPending({ file, name, preview: URL.createObjectURL(file) });
		},
	});

	const confirmUpload = async () => {
		if (!pending?.name.trim() || busy) return;
		if (NAME_FORBIDDEN_RE.test(pending.name)) {
			toast.error("表情名称不能包含 _ * ~ ` [ ] \\ 字符");
			return;
		}
		try {
			const uploaded = await uploadEmoji.mutateAsync(pending.file);
			await createEmoji.mutateAsync({ name: pending.name.trim(), url: uploaded.url });
			setPending(null);
			toast.success("已添加表情");
		} catch {
			// mutation 显示错误，命名输入保留供用户修正。
		}
	};

	return (
		<div className="flex flex-col gap-3 pt-2">
			<input {...inputProps} aria-label="选择表情图片" className="hidden" />
			<div className="grid grid-cols-5 gap-1">
				<UploadTile
					aria-label="上传表情"
					title="上传表情"
					onClick={open}
					disabled={!!pending}
					busy={busy}
					className="rounded-md"
				/>
				{owned.map((emoji) => (
					<EmojiTile key={emoji.custom_emoji_id} emoji={emoji} onSelect={onSelect} />
				))}
				{favorited.map((emoji) => (
					<EmojiTile key={emoji.custom_emoji_id} emoji={emoji} onSelect={onSelect} />
				))}
			</div>
			{pending && (
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-2">
						<img
							src={pending.preview}
							alt="待上传的表情"
							className="size-12 shrink-0 rounded-md object-contain"
						/>
						<Input
							aria-label="表情名称"
							value={pending.name}
							onChange={(event) =>
								setPending({ ...pending, name: event.target.value })
							}
							placeholder="给表情起个名字"
							maxLength={50}
							disabled={busy}
							autoFocus
						/>
					</div>
					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setPending(null)}
							disabled={busy}
						>
							取消
						</Button>
						<Button
							type="button"
							size="sm"
							onClick={() => void confirmUpload()}
							disabled={busy || !pending.name.trim()}
						>
							{busy ? (
								<>
									<Loader2
										aria-hidden="true"
										className="mr-1 size-3.5 animate-spin motion-reduce:animate-none"
									/>
									添加中…
								</>
							) : (
								"确认添加"
							)}
						</Button>
					</div>
				</div>
			)}
			{isLoading ? (
				<div
					role="status"
					className="flex items-center justify-center py-4 text-sm text-muted-foreground"
				>
					<Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none" />
					加载中…
				</div>
			) : isError && !mine ? (
				<div className="flex flex-col items-center gap-2 py-3 text-sm text-muted-foreground">
					<p>个人表情加载失败</p>
					<Button variant="outline" size="sm" onClick={() => void refetch()}>
						重新加载
					</Button>
				</div>
			) : (
				owned.length + favorited.length === 0 &&
				!pending && (
					<p className="py-2 text-center text-xs text-muted-foreground">
						上传图片或右键收藏表情
					</p>
				)
			)}
		</div>
	);
}
