import type { UniqueIdentifier } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, Ellipsis, GripVertical } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "../button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../dropdown-menu";
import { iconProps } from "../icons";
import type { SettlingItem } from "./use-sortable-list";

interface SortableRowProps {
	id: UniqueIdentifier;
	label: string;
	index: number;
	total: number;
	disabled: boolean;
	active: boolean;
	settling: SettlingItem | null;
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
	active,
	settling,
	menuContainer,
	onMove,
	children,
}: SortableRowProps) {
	const locked = disabled || Boolean(settling);
	const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition } =
		useSortable({
			id,
			disabled: locked,
			transition: { duration: 200, easing: "cubic-bezier(.32,.72,0,1)" },
		});
	let y = transform?.y ?? 0;
	if (settling) {
		if (settling.id === id) {
			y = settling.distance;
		} else if (settling.from < settling.to && index > settling.from && index <= settling.to) {
			y = -settling.height - 4;
		} else if (settling.from > settling.to && index >= settling.to && index < settling.from) {
			y = settling.height + 4;
		} else {
			y = 0;
		}
	}

	const lifted = active || settling?.id === id;
	const style: CSSProperties & { "--v-sortable-transition": string | undefined } = {
		transform: `translate3d(0,${y}px,0)`,
		"--v-sortable-transition": settling
			? "transform 160ms cubic-bezier(.32,.72,0,1)"
			: transition,
	};

	return (
		<li ref={setNodeRef} className="v-sortable__slot" data-lifted={lifted || undefined}>
			<div className="v-sortable__row" style={style}>
				<Button
					{...attributes}
					{...listeners}
					ref={setActivatorNodeRef}
					iconOnly
					size="sm"
					variant="ghost"
					disabled={disabled}
					aria-disabled={locked || undefined}
					aria-label={`移动 ${label}，在第 ${index + 1} 位，共 ${total} 项`}
					className="v-sortable__handle"
				>
					<GripVertical {...iconProps()} />
				</Button>
				<div className="v-sortable__content">{children}</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
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
						<DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)}>
							<ArrowUp {...iconProps()} />
							上移
						</DropdownMenuItem>
						<DropdownMenuItem disabled={index === total - 1} onSelect={() => onMove(1)}>
							<ArrowDown {...iconProps()} />
							下移
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</li>
	);
}
