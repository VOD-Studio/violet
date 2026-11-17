import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	type UniqueIdentifier,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { createContext, type ReactNode, type RefObject, useContext, useId, useMemo } from "react";
import { restrictToList } from "./restrict-to-list";
import {
	type SortableListOptions,
	type SortableListState,
	useSortableList,
} from "./use-sortable-list";

interface SortableScopeState extends SortableListState {
	gap: number;
	disabled: boolean;
	groups: ReadonlyMap<UniqueIdentifier, string> | null;
}

const SortableScopeContext = createContext<SortableScopeState | null>(null);

interface SortableScopeProps<T> extends SortableListOptions<T> {
	children: ReactNode | ((state: SortableListState) => ReactNode);
	root?: RefObject<HTMLElement | null>;
	gap?: number;
	inset?: number;
	disabled?: boolean;
}

/** 共享拖拽事务与交互，不添加列表或表格的 DOM 外壳。 */
export function SortableScope<T>({
	children,
	root,
	gap = 0,
	inset = 0,
	disabled = false,
	...options
}: SortableScopeProps<T>) {
	const { items, getId, getLabel, getGroup } = options;
	const drag = useSortableList({ ...options, root });
	const ids = useMemo(() => items.map(getId), [items, getId]);
	const groups = useMemo(
		() => (getGroup ? new Map(items.map((item) => [getId(item), getGroup(item)])) : null),
		[items, getId, getGroup],
	);
	const modifiers = useMemo(() => [restrictToList(drag.root, inset)], [drag.root, inset]);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	const id = useId();
	const position = (key: UniqueIdentifier) => ids.indexOf(key);
	const label = (key: UniqueIdentifier) => {
		const item = items.find((item) => getId(item) === key);
		return item === undefined ? "项目" : getLabel(item);
	};
	return (
		<SortableScopeContext value={{ ...drag, gap, disabled, groups }}>
			<DndContext
				id={id}
				sensors={sensors}
				collisionDetection={(args) => {
					if (!groups) return closestCenter(args);
					const group = groups.get(args.active.id);
					if (group === undefined) return [];
					return closestCenter({
						...args,
						droppableContainers: args.droppableContainers.filter(
							(item) => groups.get(item.id) === group,
						),
					});
				}}
				modifiers={modifiers}
				onDragStart={drag.start}
				onDragOver={drag.over}
				onDragCancel={drag.cancel}
				onDragEnd={(event) => {
					if (disabled) {
						drag.cancel();
					} else {
						drag.end(event);
					}
				}}
				accessibility={{
					screenReaderInstructions: {
						draggable:
							"在把手上按空格或 Enter 拿起，用上下方向键在同组内移动，再按空格或 Enter 放下，Esc 取消。",
					},
					announcements: {
						onDragStart: ({ active }) =>
							`已拿起 ${label(active.id)}，在第 ${position(active.id) + 1} 位`,
						onDragOver: ({ over }) =>
							over ? `移到第 ${position(over.id) + 1} 位` : undefined,
						onDragEnd: () => undefined,
						onDragCancel: () => "已取消，回到原位",
					},
				}}
			>
				<SortableContext items={ids} strategy={verticalListSortingStrategy}>
					{typeof children === "function" ? children(drag) : children}
				</SortableContext>
				<span
					className="v-sortable__announcement"
					role="status"
					aria-live="polite"
					aria-atomic="true"
				>
					{drag.message}
				</span>
			</DndContext>
		</SortableScopeContext>
	);
}

/** 非排序表体允许没有排序上下文。 */
export function useSortableScope() {
	return useContext(SortableScopeContext);
}
