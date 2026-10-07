import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@violet/ui";
import { MoreHorizontal, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

/** 将来源管理和本站删除放在同一菜单中，危险动作单独分组。 */
export interface TweetMoreMenuProps {
	children?: ReactNode;
	dangerSlot?: ReactNode;
	disabled?: boolean;
	onDelete?: () => void;
}

export function TweetMoreMenu({ children, dangerSlot, disabled, onDelete }: TweetMoreMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label="更多推文操作"
					className="size-11 shrink-0 text-muted-foreground"
					onClick={(event) => event.stopPropagation()}
				>
					<MoreHorizontal className="size-5" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="min-w-48 rounded-xl shadow-none animate-none!"
				onClick={(event) => event.stopPropagation()}
				onKeyDown={(event) => event.stopPropagation()}
			>
				{children}
				{children && (dangerSlot || onDelete) && <DropdownMenuSeparator />}
				{dangerSlot}
				{onDelete && (
					<DropdownMenuItem
						variant="destructive"
						disabled={disabled}
						onSelect={onDelete}
						className="min-h-11"
					>
						<Trash2 className="size-4" />
						删除推文
					</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
