import { Button } from "@shared/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@shared/ui/dialog";

export interface ConfirmDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	confirmLabel?: string;
	cancelLabel?: string;
	onConfirm: () => void;
	loading?: boolean;
}

/**
 * ConfirmDialog - 通用确认弹窗
 *
 * 用于删除、禁用等需要二次确认的操作。
 */
export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel = "确认",
	cancelLabel = "取消",
	onConfirm,
	loading,
}: ConfirmDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
						{cancelLabel}
					</Button>
					<Button variant="destructive" onClick={onConfirm} disabled={loading}>
						{confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
