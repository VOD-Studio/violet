import { formatDateTime } from "@shared/lib/date";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	iconProps,
} from "@violet/ui";
import { CheckCheck, Copy, Ellipsis, Pencil, Reply, Trash2 } from "lucide-react";
import { type RefObject, useRef } from "react";
import { toast } from "sonner";
import type { ChatMessage } from "../model/types";

/** 消息菜单的可用操作与受控开合状态。 */
export interface MessageActionsProps {
	message: ChatMessage;
	triggerRef: RefObject<HTMLButtonElement | null>;
	readLabel?: string;
	onShowReaders?: () => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	disabled?: boolean;
	onEdit?: () => void;
	onReply?: () => void;
	onDelete?: () => void;
}

/** 关闭菜单后再交接编辑、引用与删除的焦点。 */
export function MessageActions({
	message,
	triggerRef,
	readLabel,
	onShowReaders,
	open,
	onOpenChange,
	disabled = false,
	onEdit,
	onReply,
	onDelete,
}: MessageActionsProps) {
	const selectedAction = useRef<(() => void) | null>(null);
	const pointerInteraction = useRef(false);
	const copy = async () => {
		if (!message.content) {
			return;
		}
		try {
			await navigator.clipboard.writeText(message.content);
			toast.success("已复制到剪贴板");
		} catch {
			toast.error("复制失败");
		}
	};
	return (
		<DropdownMenu
			modal={false}
			open={!disabled && open}
			onOpenChange={(nextOpen) => {
				if (nextOpen) selectedAction.current = null;
				onOpenChange(nextOpen);
			}}
		>
			<DropdownMenuTrigger asChild>
				<Button
					ref={triggerRef}
					iconOnly
					size="sm"
					variant="ghost"
					aria-label="消息操作"
					aria-hidden={disabled || undefined}
					className={disabled ? "invisible" : "text-muted-foreground"}
					disabled={disabled}
					onPointerDownCapture={() => {
						pointerInteraction.current = true;
					}}
					onKeyDownCapture={() => {
						pointerInteraction.current = false;
					}}
				>
					<Ellipsis {...iconProps(16)} />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				side="top"
				onKeyDownCapture={() => {
					pointerInteraction.current = false;
				}}
				onPointerDownOutside={() => {
					pointerInteraction.current = true;
				}}
				onCloseAutoFocus={(event) => {
					const action = selectedAction.current;
					selectedAction.current = null;
					if (action) {
						event.preventDefault();
						triggerRef.current?.focus({ preventScroll: true });
						action();
					} else if (pointerInteraction.current) {
						event.preventDefault();
						triggerRef.current?.blur();
					}
				}}
			>
				<DropdownMenuLabel>
					<time dateTime={message.created_at}>
						{formatDateTime(message.created_at, "long-minute")}
					</time>
					{readLabel && !onShowReaders && <span className="ml-2">{readLabel}</span>}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{onShowReaders && (
					<DropdownMenuItem
						onSelect={() => {
							selectedAction.current = onShowReaders;
						}}
					>
						<CheckCheck {...iconProps(16)} />
						{readLabel}
					</DropdownMenuItem>
				)}
				{onReply && (
					<DropdownMenuItem
						onSelect={() => {
							selectedAction.current = onReply;
						}}
					>
						<Reply {...iconProps(16)} />
						回复消息
					</DropdownMenuItem>
				)}
				{onEdit && (
					<DropdownMenuItem
						onSelect={() => {
							selectedAction.current = onEdit;
						}}
					>
						<Pencil {...iconProps(16)} />
						编辑消息
					</DropdownMenuItem>
				)}
				{message.type === "text" && (
					<DropdownMenuItem onSelect={() => void copy()}>
						<Copy {...iconProps(16)} />
						复制消息
					</DropdownMenuItem>
				)}
				{onDelete && (
					<>
						{(onReply || onEdit || message.type === "text") && (
							<DropdownMenuSeparator />
						)}
						<DropdownMenuItem
							variant="destructive"
							onSelect={() => {
								selectedAction.current = onDelete;
							}}
						>
							<Trash2 {...iconProps(16)} />
							删除违规消息
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
