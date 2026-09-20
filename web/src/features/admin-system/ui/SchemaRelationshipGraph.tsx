import { Button } from "@shared/ui/base/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@shared/ui/base/dialog";
import { Switch } from "@shared/ui/base/switch";
import { Segmented, type SegmentedItem } from "@shared/ui/segmented";
import { Maximize2, Waypoints } from "lucide-react";
import { useMemo, useState } from "react";
import type { DatabaseSchemaDTO } from "../model/types";
import { buildTableSelectSQL } from "./relationship-query";
import { SchemaRelationshipCanvas } from "./SchemaRelationshipCanvas";
import { SchemaRelationshipInspector } from "./SchemaRelationshipInspector";
import { SchemaTablePicker } from "./SchemaTablePicker";
import { buildSchemaGraphLayout, schemaTableKey } from "./schema-graph-layout";

type GraphMode = "focus" | "overview";

const GRAPH_MODE_SEGMENTS: SegmentedItem<GraphMode>[] = [
	{ value: "focus", label: "聚焦" },
	{ value: "overview", label: "全景" },
];

export interface SchemaRelationshipGraphProps {
	schema: DatabaseSchemaDTO;
	onUseQuery: (sql: string) => void;
}

/** 以全屏工作台展示可追踪、可检索且可生成查询的 PostgreSQL 外键图谱。 */
export function SchemaRelationshipGraph({ schema, onUseQuery }: SchemaRelationshipGraphProps) {
	const [open, setOpen] = useState(false);
	const [mode, setMode] = useState<GraphMode>("focus");
	const [includeIsolated, setIncludeIsolated] = useState(false);
	const [focusKey, setFocusKey] = useState<string | null>(null);
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const tableByKey = useMemo(
		() => new Map(schema.tables.map((table) => [schemaTableKey(table), table])),
		[schema.tables],
	);
	const relationCounts = useMemo(() => buildRelationCounts(schema), [schema]);
	const suggestedFocus = useMemo(
		() => suggestFocusTable(schema, relationCounts),
		[schema, relationCounts],
	);
	const effectiveFocus = tableByKey.has(focusKey ?? "") ? focusKey : suggestedFocus;
	const effectiveSelected = tableByKey.has(selectedKey ?? "") ? selectedKey : null;
	const layout = useMemo(
		() =>
			buildSchemaGraphLayout({
				tables: schema.tables,
				relationships: schema.relationships,
				includeIsolated,
				focusKey: mode === "focus" ? effectiveFocus : null,
			}),
		[effectiveFocus, includeIsolated, mode, schema],
	);
	const selectTable = (key: string) => {
		if (mode === "focus") setFocusKey(key);
		setSelectedKey(key);
	};
	const selectFocus = (key: string) => {
		setMode("focus");
		setFocusKey(key);
		setSelectedKey(null);
	};
	const openQuery = (sql: string) => {
		setOpen(false);
		onUseQuery(sql);
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<section className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-xl border border-primary/15 bg-primary/4 px-5 py-4">
				<div
					aria-hidden
					className="pointer-events-none absolute -top-14 right-16 size-32 rounded-full bg-primary/12 blur-3xl"
				/>
				<div className="relative">
					<p className="font-mono text-[10px] tracking-[0.18em] text-primary/75 uppercase">
						Schema relations
					</p>
					<h2 className="mt-1 flex items-center gap-2 text-sm font-semibold">
						<Waypoints className="text-primary size-4" />
						数据库关系图谱
					</h2>
					<p className="text-muted-foreground mt-1 text-xs">
						{schema.tables.length} 张表 · {schema.relationships.length} 条真实外键
					</p>
				</div>
				<DialogTrigger asChild>
					<Button size="sm">
						<Waypoints data-icon="inline-start" />
						打开关系图
						<Maximize2 data-icon="inline-end" className="opacity-70" />
					</Button>
				</DialogTrigger>
			</section>

			<DialogContent
				className="flex h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] grid-rows-none flex-col gap-0 overflow-hidden border-primary/15 p-0 sm:max-w-[calc(100vw-2rem)]"
				style={{ animation: "none" }}
			>
				<DialogHeader className="relative shrink-0 overflow-hidden border-b border-primary/15 bg-primary/5 px-5 py-4 pr-14 text-left">
					<div
						aria-hidden
						className="pointer-events-none absolute -top-16 right-20 size-40 rounded-full bg-primary/15 blur-3xl"
					/>
					<DialogTitle className="relative flex items-center gap-2 text-base">
						<Waypoints className="text-primary size-4" />
						数据库关系图
					</DialogTitle>
					<DialogDescription className="relative text-xs">
						聚焦一张表查看直接依赖；悬停沿线追踪，双击生成查询，关系详情可生成 JOIN。
					</DialogDescription>
				</DialogHeader>

				<div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-primary/10 bg-muted/20 px-4 py-3">
					<Segmented
						value={mode}
						onValueChange={(nextMode) => {
							setMode(nextMode);
							setSelectedKey(null);
						}}
						segments={GRAPH_MODE_SEGMENTS}
					/>
					{mode === "focus" ? (
						<SchemaTablePicker
							tables={schema.tables}
							value={effectiveFocus}
							relationCounts={relationCounts}
							onValueChange={selectFocus}
						/>
					) : (
						<div className="text-muted-foreground flex items-center gap-2 text-xs">
							<Switch
								aria-label="显示孤立表"
								checked={includeIsolated}
								onCheckedChange={setIncludeIsolated}
								size="sm"
							/>
							显示孤立表
						</div>
					)}
					<div className="text-muted-foreground ml-auto flex items-center gap-2 text-xs tabular-nums">
						<span>
							{mode === "focus"
								? `${Math.max(0, layout.nodes.length - 1)} 张关联表`
								: `${layout.nodes.length} 个节点`}
						</span>
						<span aria-hidden>·</span>
						<span>{layout.relationships.length} 条外键</span>
					</div>
				</div>

				<div className="relative min-h-0 flex-1">
					<SchemaRelationshipCanvas
						layout={layout}
						selectedKey={
							effectiveSelected ?? (mode === "focus" ? effectiveFocus : null)
						}
						onSelectTable={selectTable}
						onClearSelection={() => setSelectedKey(null)}
						onOpenTableQuery={(table) => openQuery(buildTableSelectSQL(table))}
					/>
					{effectiveSelected && (
						<div className="absolute inset-x-0 bottom-0 z-10 h-72 overflow-hidden border-t border-primary/15 bg-background shadow-2xl lg:inset-y-0 lg:right-0 lg:left-auto lg:h-auto lg:w-80 lg:border-t-0 lg:border-l">
							<SchemaRelationshipInspector
								table={tableByKey.get(effectiveSelected) ?? null}
								relationships={schema.relationships}
								onSelectTable={selectTable}
								onUseQuery={openQuery}
								onClose={() => setSelectedKey(null)}
							/>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

function buildRelationCounts(schema: DatabaseSchemaDTO): Map<string, number> {
	const counts = new Map<string, number>();
	for (const relationship of schema.relationships) {
		const source = `${relationship.source_schema}.${relationship.source_table}`;
		const target = `${relationship.target_schema}.${relationship.target_table}`;
		counts.set(source, (counts.get(source) ?? 0) + 1);
		counts.set(target, (counts.get(target) ?? 0) + 1);
	}
	return counts;
}

function suggestFocusTable(
	schema: DatabaseSchemaDTO,
	relationCounts: ReadonlyMap<string, number>,
): string | null {
	const connected = schema.tables.filter(
		(table) => (relationCounts.get(schemaTableKey(table)) ?? 0) > 0,
	);
	const comfortable = connected.filter(
		(table) => (relationCounts.get(schemaTableKey(table)) ?? 0) <= 12,
	);
	const candidates = comfortable.length > 0 ? comfortable : connected;
	candidates.sort((left, right) => {
		const countDelta =
			(relationCounts.get(schemaTableKey(right)) ?? 0) -
			(relationCounts.get(schemaTableKey(left)) ?? 0);
		return countDelta || left.name.localeCompare(right.name);
	});
	return candidates[0]
		? schemaTableKey(candidates[0])
		: schema.tables[0]
			? schemaTableKey(schema.tables[0])
			: null;
}
