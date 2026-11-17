import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { type ReactNode, useId, useRef } from "react";
import type { DataTableProps } from "./data-table-types";

interface DataTableReorderProps<T> {
	data: T[];
	keyExtractor: (row: T) => string;
	config: NonNullable<DataTableProps<T>["rowReorder"]>;
	children: ReactNode;
}

/** 只在把手上启动拖动，落位时提交同组的新旧集合。 */
export function DataTableReorder<T>({
	data,
	keyExtractor,
	config,
	children,
}: DataTableReorderProps<T>) {
	const id = useId();
	const snapshot = useRef<T[] | null>(null);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	const groupOf = (row: T) => config.getGroup?.(row) ?? "";
	const label = (key: string | number) => {
		const row = data.find((item) => keyExtractor(item) === key);
		return row === undefined ? "行" : config.getLabel(row);
	};
	return (
		<DndContext
			id={id}
			sensors={sensors}
			collisionDetection={(args) => {
				const active = data.find((row) => keyExtractor(row) === args.active.id);
				if (active === undefined) return [];
				const allowed = new Set(
					data.filter((row) => groupOf(row) === groupOf(active)).map(keyExtractor),
				);
				return closestCenter({
					...args,
					droppableContainers: args.droppableContainers.filter((item) =>
						allowed.has(String(item.id)),
					),
				});
			}}
			modifiers={[
				({ transform, activeNodeRect, containerNodeRect }) => ({
					...transform,
					x: 0,
					y:
						activeNodeRect && containerNodeRect
							? Math.min(
									containerNodeRect.bottom - activeNodeRect.bottom,
									Math.max(
										containerNodeRect.top - activeNodeRect.top,
										transform.y,
									),
								)
							: transform.y,
				}),
			]}
			onDragStart={() => {
				snapshot.current = data;
			}}
			onDragCancel={() => {
				snapshot.current = null;
			}}
			onDragEnd={({ active, over }) => {
				const previous = snapshot.current;
				snapshot.current = null;
				if (config.disabled || !over || active.id === over.id || previous !== data) return;
				const row = data.find((item) => keyExtractor(item) === active.id);
				if (row === undefined) return;
				const group = data.filter((item) => groupOf(item) === groupOf(row));
				const from = group.findIndex((item) => keyExtractor(item) === active.id);
				const to = group.findIndex((item) => keyExtractor(item) === over.id);
				if (from < 0 || to < 0) return;
				config.onReorder(arrayMove(group, from, to), group);
			}}
			accessibility={{
				screenReaderInstructions: {
					draggable:
						"按空格或 Enter 拿起，用上下方向键在同组内移动，再按空格或 Enter 放下，Esc 取消。",
				},
				announcements: {
					onDragStart: ({ active }) => `已拿起 ${label(active.id)}`,
					onDragOver: ({ over }) => (over ? `移到 ${label(over.id)} 的位置` : undefined),
					onDragEnd: () => "已放下",
					onDragCancel: () => "已取消，回到原位",
				},
			}}
		>
			<SortableContext items={data.map(keyExtractor)} strategy={verticalListSortingStrategy}>
				{children}
			</SortableContext>
		</DndContext>
	);
}
