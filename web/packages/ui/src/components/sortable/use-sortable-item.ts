import type {
	DraggableAttributes,
	DraggableSyntheticListeners,
	UniqueIdentifier,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import type { CSSProperties } from "react";
import { useSortableScope } from "./sortable-scope";

type SortableStyle = CSSProperties & {
	"--v-sortable-transition": CSSProperties["transition"];
};

export interface SortableItemState {
	setNodeRef: (node: HTMLElement | null) => void;
	setActivatorNodeRef: (node: HTMLElement | null) => void;
	attributes: DraggableAttributes;
	listeners: DraggableSyntheticListeners;
	style: SortableStyle;
	locked: boolean;
	lifted: boolean;
}

/** 列表项与原生表格行共用把手接线、位移与落位样式。 */
export function useSortableItem(id: UniqueIdentifier, disabled = false): SortableItemState {
	const scope = useSortableScope();
	if (!scope) throw new Error("Sortable item requires a SortableScope");
	const activeId = scope.activeId ?? scope.settling?.id;
	const inActiveGroup =
		activeId == null || !scope.groups || scope.groups.get(id) === scope.groups.get(activeId);
	const locked = disabled || scope.disabled || scope.busy || !inActiveGroup;
	const drag = useSortable({
		id,
		disabled: locked,
		transition: { duration: 200, easing: "cubic-bezier(.32,.72,0,1)" },
	});
	const { settling, gap } = scope;
	let y = inActiveGroup ? (drag.transform?.y ?? 0) : 0;
	if (settling && inActiveGroup) {
		if (settling.id === id) {
			y = settling.distance;
		} else if (
			settling.from < settling.to &&
			drag.index > settling.from &&
			drag.index <= settling.to
		) {
			y = -settling.height - gap;
		} else if (
			settling.from > settling.to &&
			drag.index >= settling.to &&
			drag.index < settling.from
		) {
			y = settling.height + gap;
		} else {
			y = 0;
		}
	}
	const style: SortableStyle = {
		transform: y === 0 ? undefined : `translate3d(0,${y}px,0)`,
		"--v-sortable-transition": settling
			? "transform 160ms cubic-bezier(.32,.72,0,1)"
			: drag.transition,
	};
	return {
		setNodeRef: drag.setNodeRef,
		setActivatorNodeRef: drag.setActivatorNodeRef,
		attributes: drag.attributes,
		listeners: drag.listeners,
		style,
		locked,
		lifted: scope.activeId === id || settling?.id === id,
	};
}
