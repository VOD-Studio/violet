import { ConfirmDialog } from "@features/admin-shared/ui/ConfirmDialog";
import { useDeleteEmojiGroup, useUpdateEmojiGroup } from "@features/emojis/api/mutations";
import type { EmojiGroup } from "@features/emojis/model/types";
import { cn } from "@shared/lib/utils";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface EmojiGroupItemProps {
	group: EmojiGroup;
	selected: boolean;
	onSelect: () => void;
	onMutated: () => void;
}

const SOURCE_LABEL: Record<string, string> = {
	system: "系统",
	bilibili: "B站",
	custom: "自定义",
};

/**
 * EmojiGroupItem - 左栏单个分组项
 *
 * 显示名称/数量/来源/状态徽章，点击选中（高亮）。
 * 含启用/禁用切换（useUpdateEmojiGroup）+ 删除（useDeleteEmojiGroup + ConfirmDialog，
 * 删除会级联删组内表情，文案提示）。
 */
export function EmojiGroupItem({ group, selected, onSelect, onMutated }: EmojiGroupItemProps) {
	const updateGroup = useUpdateEmojiGroup(group.id, group.name);
	const deleteGroup = useDeleteEmojiGroup(group.id);
	const [confirmOpen, setConfirmOpen] = useState(false);

	const handleToggle = () => {
		updateGroup.mutate(
			{ is_enabled: !group.is_enabled },
			{
				onSuccess: () => {
					toast.success(group.is_enabled ? "已禁用" : "已启用");
					onMutated();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	const handleDelete = () => {
		deleteGroup.mutate(undefined, {
			onSuccess: () => {
				toast.success("分组已删除");
				setConfirmOpen(false);
				onMutated();
			},
			onError: (err) => toast.error(err.message),
		});
	};

	return (
		<>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: ignore */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: ignore */}
			<div
				className={cn(
					"group flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition-colors",
					selected ? "border-foreground/30 bg-accent" : "border-border bg-card hover:bg-accent/50",
				)}
				onClick={onSelect}
			>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span className="truncate text-sm font-medium">{group.name}</span>
						<Badge variant="secondary" className="shrink-0 text-[10px]">
							{group.emojis.length}
						</Badge>
					</div>
					<div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
						<span>{SOURCE_LABEL[group.source] ?? group.source}</span>
						<span>·</span>
						<span>{group.is_enabled ? "启用" : "禁用"}</span>
					</div>
				</div>
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: ignore */}
				{/* biome-ignore lint/a11y/noStaticElementInteractions: ignore */}
				<div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
					<Button
						variant="ghost"
						size="sm"
						className="h-7 px-2 text-xs"
						disabled={updateGroup.isPending}
						onClick={handleToggle}
					>
						{group.is_enabled ? "禁用" : "启用"}
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						className="h-7 w-7 text-muted-foreground hover:text-destructive"
						onClick={() => setConfirmOpen(true)}
					>
						<Trash2 className="size-3.5" />
					</Button>
				</div>
			</div>

			<ConfirmDialog
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				title="删除分组"
				description={`确认删除分组「${group.name}」？组内 ${group.emojis.length} 个表情将被一并删除，此操作不可撤销。`}
				loading={deleteGroup.isPending}
				onConfirm={handleDelete}
			/>
		</>
	);
}
