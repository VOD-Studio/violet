import { ConfirmDialog } from "@features/admin-shared/ui/ConfirmDialog";
import { useDeleteEmoji } from "@features/emojis/api/mutations";
import type { Emoji } from "@features/emojis/model/types";
import { Button } from "@shared/ui/button";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface EmojiGridProps {
	emojis: Emoji[];
	groupId: number;
	onMutated: () => void;
}

/**
 * EmojiGrid - 右栏表情网格
 *
 * 每格缩略图（<img>），hover 显示删除按钮。
 * 支持纯文字表情（text_content 兜底显示文字）。
 * 删除走 useDeleteEmoji + ConfirmDialog。
 */
export function EmojiGrid({ emojis, groupId, onMutated }: EmojiGridProps) {
	const [pendingDelete, setPendingDelete] = useState<Emoji | null>(null);
	const deleteEmoji = useDeleteEmoji(pendingDelete?.id ?? 0, groupId);

	const handleDelete = () => {
		if (!pendingDelete) return;
		deleteEmoji.mutate(undefined, {
			onSuccess: () => {
				toast.success("表情已删除");
				setPendingDelete(null);
				onMutated();
			},
			onError: (err) => toast.error(err.message),
		});
	};

	if (emojis.length === 0) {
		return (
			<p className="py-12 text-center text-sm text-muted-foreground">
				该分组暂无表情，点右上角添加
			</p>
		);
	}

	return (
		<>
			<div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
				{emojis.map((emoji) => (
					<div
						key={emoji.id}
						className="group relative aspect-square overflow-hidden rounded-md border border-border bg-card"
						title={emoji.name}
					>
						<div className="flex h-full w-full items-center justify-center p-1">
							{emoji.url ? (
								<img
									src={emoji.url}
									alt={emoji.name}
									loading="lazy"
									className="max-h-full max-w-full object-contain"
								/>
							) : emoji.text_content ? (
								<span className="text-center text-sm">{emoji.text_content}</span>
							) : (
								<span className="text-xs text-muted-foreground">无图</span>
							)}
						</div>
						<Button
							variant="destructive"
							size="icon-sm"
							className="absolute right-0.5 top-0.5 h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
							onClick={(e) => {
								e.stopPropagation();
								setPendingDelete(emoji);
							}}
						>
							<Trash2 className="size-3" />
						</Button>
					</div>
				))}
			</div>

			<ConfirmDialog
				open={Boolean(pendingDelete)}
				onOpenChange={(v) => !v && setPendingDelete(null)}
				title="删除表情"
				description={`确认删除表情「${pendingDelete?.name ?? ""}」？`}
				loading={deleteEmoji.isPending}
				onConfirm={handleDelete}
			/>
		</>
	);
}
