import type { UniqueIdentifier } from "@dnd-kit/core";
import { ArrowDown, ArrowUp, Ellipsis, GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../dropdown-menu";
import { iconProps } from "../icons";
import { useSortableItem } from "./use-sortable-item";

interface SortableRowProps {
	id: UniqueIdentifier;
	label: string;
	index: number;
	total: number;
	disabled: boolean;
	menuContainer?: HTMLElement | null;
	onMove: (direction: number) => void;
	children: ReactNode;
}

/** 把手、移动菜单和纸片共用同一行，业务内容不接管拖拽事件。 */
export function SortableRow({
	id,
	label,
	index,
	total,
	disabled,
	menuContainer,
	onMove,
	children,
}: SortableRowProps) {
	const { setNodeRef, setActivatorNodeRef, attributes, listeners, style, lifted, locked } =
		useSortableItem(id, disabled);

	return (
		<li
			ref={setNodeRef}
			className="v-sortable__slot"
			data-sortable-item=""
			data-lifted={lifted || undefined}
		>
			<div className="v-sortable__row" style={style}>
				<Button
					{...attributes}
					{...listeners}
					ref={setActivatorNodeRef}
					iconOnly
					size="sm"
					variant="ghost"
					disabled={disabled}
					aria-disabled={disabled || undefined}
					aria-label={`移动 ${label}，在第 ${index + 1} 位，共 ${total} 项`}
					className="v-sortable__handle"
				>
					<GripVertical {...iconProps()} />
				</Button>
				<div className="v-sortable__content">{children}</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild disabled={locked}>
						<Button
							iconOnly
							size="sm"
							variant="ghost"
							disabled={locked}
							className="v-sortable__menu"
							aria-label={`调整 ${label} 的顺序`}
						>
							<Ellipsis {...iconProps()} />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" container={menuContainer}>
						<DropdownMenuItem
							disabled={locked || index === 0}
							onSelect={() => onMove(-1)}
						>
							<ArrowUp {...iconProps()} />
							上移
						</DropdownMenuItem>
						<DropdownMenuItem
							disabled={locked || index === total - 1}
							onSelect={() => onMove(1)}
						>
							<ArrowDown {...iconProps()} />
							下移
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</li>
	);
}
