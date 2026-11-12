"use client";

import { Columns3 } from "lucide-react";
import type { ReactNode } from "react";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../dropdown-menu";
import type { DataTableColumn } from "./data-table-types";

interface ColumnMenuProps<T> {
	/** 允许隐藏的列 */
	columns: DataTableColumn<T>[];
	hiddenKeys: Set<string>;
	onToggle: (key: string) => void;
	/** 有隐藏列或调整过列宽时才出现「重置列」 */
	canReset: boolean;
	onReset: () => void;
	container?: HTMLElement | null;
}

function labelOf(header: ReactNode, key: string): string {
	return typeof header === "string" || typeof header === "number" ? String(header) : key;
}

/** 表头左上角的「显示列」按钮与菜单；显隐与列宽记在这台设备上。 */
export function ColumnMenu<T>({
	columns,
	hiddenKeys,
	onToggle,
	canReset,
	onReset,
	container,
}: ColumnMenuProps<T>) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="v-table__icon-button"
					aria-label="显示列"
					title="显示列"
				>
					<Columns3 size={15} aria-hidden="true" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				container={container}
				collisionBoundary={container ?? undefined}
			>
				<DropdownMenuLabel>显示列</DropdownMenuLabel>
				{columns.map((column) => (
					<DropdownMenuCheckboxItem
						key={column.key}
						checked={!hiddenKeys.has(column.key)}
						onCheckedChange={() => onToggle(column.key)}
					>
						{labelOf(column.header, column.key)}
					</DropdownMenuCheckboxItem>
				))}
				{canReset ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={onReset}>重置列</DropdownMenuItem>
					</>
				) : null}
				<DropdownMenuLabel>记在这台设备上</DropdownMenuLabel>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
