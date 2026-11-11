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
import { cn } from "cn";
import { useComposedRefs } from "radix-ui/internal";
import { type ComponentProps, type ReactNode, useId } from "react";
import { SortableRow } from "./sortable-row";
import { useSortableList } from "./use-sortable-list";

/** 按稳定标识排序；调用方持有数据与持久化，表单内容更新不会被落位时的快照覆盖。 */
export interface SortableProps<T> extends Omit<ComponentProps<"ol">, "children" | "onChange"> {
	items: readonly T[];
	getId: (item: T) => string | number;
	getLabel: (item: T) => string;
	/** 返回 Promise 时等待保存完成；拒绝后保留原顺序并播报失败。 */
	onReorder: (items: T[]) => unknown;
	renderItem: (item: T, index: number) => ReactNode;
	/** 菜单的 Portal 容器；未提供时使用 document.body。 */
	menuContainer?: HTMLElement | null;
	disabled?: boolean;
	"aria-label": string;
}

/** 纵向手动排序列表；拖动与键盘共用落位时序，顺序由宿主持有。 */
export function Sortable<T>({
	items,
	getId,
	getLabel,
	onReorder,
	renderItem,
	disabled = false,
	className,
	menuContainer,
	ref,
	...props
}: SortableProps<T>) {
	const drag = useSortableList({ items, getId, getLabel, onReorder });
	const composedRef = useComposedRefs(ref, drag.root);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	const id = useId();
	const position = (key: UniqueIdentifier) => items.findIndex((item) => getId(item) === key);
	const label = (key: UniqueIdentifier) => {
		const item = items.find((item) => getId(item) === key);
		return item === undefined ? "项目" : getLabel(item);
	};
	return (
		<DndContext
			id={id}
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragStart={drag.start}
			onDragCancel={drag.cancel}
			onDragEnd={drag.end}
			accessibility={{
				screenReaderInstructions: {
					draggable:
						"在把手上按空格或 Enter 拿起，用上下方向键移动，再按空格或 Enter 放下，Esc 取消。",
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
			<SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy}>
				<ol
					{...props}
					ref={composedRef}
					className={cn("v-sortable", className)}
					aria-busy={drag.settling ? true : undefined}
				>
					{items.map((item, index) => (
						<SortableRow
							key={getId(item)}
							id={getId(item)}
							label={getLabel(item)}
							index={index}
							total={items.length}
							disabled={disabled}
							settling={drag.settling}
							active={drag.activeId === getId(item)}
							menuContainer={menuContainer}
							onMove={(direction) => void drag.move(index, direction)}
						>
							{renderItem(item, index)}
						</SortableRow>
					))}
				</ol>
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
	);
}
