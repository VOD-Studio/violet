import { Button } from "@shared/ui/base/button";
import { Modal } from "@shared/ui/modal";
import { Loader2 } from "lucide-react";

interface ConfirmDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	confirmLabel?: string;
	cancelLabel?: string;
	loading?: boolean;
	onConfirm: () => void;
}

/**
 * ConfirmDialog - 通用确认弹窗
 *
 * 危险操作（删除等）的二次确认。确认按钮支持 loading 态防止重复提交。
 */
export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel = "确认",
	cancelLabel = "取消",
	loading = false,
	onConfirm,
}: ConfirmDialogProps) {
	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			description={description}
			size="sm"
			showCloseButton={false}
			footer={
				<>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={loading}
					>
						{cancelLabel}
					</Button>
					<Button variant="destructive" onClick={onConfirm} disabled={loading}>
						{loading && <Loader2 className="mr-1 size-4 animate-spin" />}
						{confirmLabel}
					</Button>
				</>
			}
		/>
	);
}
