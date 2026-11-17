import type { ReactNode } from "react";
import { SortableScope } from "../sortable/sortable-scope";
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
	const groupOf = (row: T) => config.getGroup?.(row) ?? "";
	return (
		<SortableScope
			items={data}
			getId={keyExtractor}
			getLabel={config.getLabel}
			getGroup={config.getGroup}
			disabled={config.disabled}
			cancelOnItemsChange
			onReorder={(next) => {
				const moved = next.find(
					(row, index) => keyExtractor(row) !== keyExtractor(data[index]),
				);
				if (moved === undefined) return;
				const group = groupOf(moved);
				return config.onReorder(
					next.filter((row) => groupOf(row) === group),
					data.filter((row) => groupOf(row) === group),
				);
			}}
		>
			{children}
		</SortableScope>
	);
}
