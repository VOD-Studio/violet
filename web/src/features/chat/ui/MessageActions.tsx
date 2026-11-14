import { Button, iconProps } from "@violet/ui";
import { Check, Copy, Pencil, Reply, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface MessageActionsProps {
	content?: string;
	canCopy: boolean;
	onEdit?: () => void;
	onReply?: () => void;
	onDelete?: () => void;
}

/** 消息操作使用独立按钮，键盘聚焦与触屏长按均由消息行显露。 */
export function MessageActions({
	content,
	canCopy,
	onEdit,
	onReply,
	onDelete,
}: MessageActionsProps) {
	const [copied, setCopied] = useState(false);
	const timer = useRef<number | undefined>(undefined);
	useEffect(() => () => window.clearTimeout(timer.current), []);
	const copy = async () => {
		if (!content) {
			return;
		}
		try {
			await navigator.clipboard.writeText(content);
			setCopied(true);
			toast.success("已复制到剪贴板");
			window.clearTimeout(timer.current);
			timer.current = window.setTimeout(() => setCopied(false), 1500);
		} catch {
			toast.error("复制失败");
		}
	};
	return (
		<div className="flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5 shadow-soft">
			{onEdit && (
				<Button
					iconOnly
					size="sm"
					variant="ghost"
					className="size-7 rounded-full"
					aria-label="编辑消息"
					onClick={onEdit}
				>
					<Pencil {...iconProps(14)} />
				</Button>
			)}
			{onReply && (
				<Button
					iconOnly
					size="sm"
					variant="ghost"
					className="size-7 rounded-full"
					aria-label="回复消息"
					onClick={onReply}
				>
					<Reply {...iconProps(14)} />
				</Button>
			)}
			{canCopy && (
				<Button
					iconOnly
					size="sm"
					variant="ghost"
					className="size-7 rounded-full"
					aria-label="复制消息"
					onClick={() => void copy()}
				>
					{copied ? <Check {...iconProps(14)} /> : <Copy {...iconProps(14)} />}
				</Button>
			)}
			{onDelete && (
				<Button
					iconOnly
					size="sm"
					variant="ghost"
					className="size-7 rounded-full text-destructive"
					aria-label="删除违规消息"
					onClick={onDelete}
				>
					<Trash2 {...iconProps(14)} />
				</Button>
			)}
		</div>
	);
}
