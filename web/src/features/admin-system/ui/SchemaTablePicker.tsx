import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/ui/base/popover";
import { SearchInput } from "@shared/ui/search-input";
import { Check, ChevronsUpDown, TableProperties } from "lucide-react";
import { useMemo, useState } from "react";
import type { DatabaseSchemaTableDTO } from "../model/types";
import { schemaTableKey } from "./schema-graph-layout";

export interface SchemaTablePickerProps {
	tables: DatabaseSchemaTableDTO[];
	value: string | null;
	relationCounts: ReadonlyMap<string, number>;
	onValueChange: (value: string) => void;
}

/** 以可搜索命令浮层选择关系图的中心表。 */
export function SchemaTablePicker({
	tables,
	value,
	relationCounts,
	onValueChange,
}: SchemaTablePickerProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const selected = tables.find((table) => schemaTableKey(table) === value) ?? null;
	const filtered = useMemo(() => {
		const normalized = query.trim().toLocaleLowerCase();
		return tables
			.filter((table) => {
				if (!normalized) return true;
				return schemaTableKey(table).toLocaleLowerCase().includes(normalized);
			})
			.sort((left, right) => {
				const relationDelta =
					(relationCounts.get(schemaTableKey(right)) ?? 0) -
					(relationCounts.get(schemaTableKey(left)) ?? 0);
				return relationDelta || left.name.localeCompare(right.name);
			});
	}, [query, relationCounts, tables]);

	return (
		<Popover
			modal
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
				if (!nextOpen) setQuery("");
			}}
		>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					role="combobox"
					aria-expanded={open}
					aria-label="选择关系中心表"
					className="h-8 min-w-60 justify-between"
				>
					<TableProperties data-icon="inline-start" />
					<span className="min-w-0 flex-1 truncate text-left font-mono font-normal">
						{selected ? schemaTableKey(selected) : "选择中心表"}
					</span>
					<ChevronsUpDown data-icon="inline-end" className="opacity-55" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				sideOffset={6}
				className="w-(--radix-popover-trigger-width) min-w-72 p-0 data-[state=closed]:animate-none! data-[state=open]:animate-none!"
			>
				<div className="border-b p-2">
					<SearchInput
						autoFocus
						value={query}
						onValueChange={setQuery}
						placeholder="搜索 schema 或表名"
						size="sm"
					/>
				</div>
				<div
					role="listbox"
					aria-label="数据表"
					className="max-h-72 overflow-y-auto overscroll-contain p-1.5"
					onWheel={(event) => {
						event.preventDefault();
						event.stopPropagation();
						event.currentTarget.scrollTop += event.deltaY;
					}}
				>
					{filtered.length === 0 ? (
						<p className="text-muted-foreground px-3 py-8 text-center text-xs">
							没有匹配的数据表
						</p>
					) : (
						filtered.map((table) => {
							const key = schemaTableKey(table);
							const selectedTable = key === value;
							return (
								<button
									key={key}
									type="button"
									role="option"
									aria-selected={selectedTable}
									className={cn(
										"flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors",
										selectedTable
											? "bg-primary/8 text-primary"
											: "hover:bg-muted/70",
									)}
									onClick={() => {
										onValueChange(key);
										setOpen(false);
										setQuery("");
									}}
								>
									<Check
										aria-hidden
										className={cn(
											"size-3.5",
											selectedTable ? "opacity-100" : "opacity-0",
										)}
									/>
									<span className="min-w-0 flex-1">
										<span className="block truncate font-mono text-xs font-medium">
											{table.name}
										</span>
										<span className="text-muted-foreground mt-0.5 block text-[10px]">
											{table.schema} · {table.columns.length} 列
										</span>
									</span>
									<span className="text-muted-foreground text-[10px] tabular-nums">
										{relationCounts.get(key) ?? 0} 关系
									</span>
								</button>
							);
						})
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
