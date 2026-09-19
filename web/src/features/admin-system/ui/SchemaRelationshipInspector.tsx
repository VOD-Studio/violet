import { Button } from "@shared/ui/base/button";
import { ArrowDownLeft, ArrowUpRight, DatabaseZap, SquareTerminal, X } from "lucide-react";
import type { ReactNode } from "react";
import type { DatabaseSchemaRelationshipDTO, DatabaseSchemaTableDTO } from "../model/types";
import { buildRelationshipJoinSQL, buildTableSelectSQL } from "./relationship-query";
import {
	relationshipSourceKey,
	relationshipTargetKey,
	schemaTableKey,
} from "./schema-graph-layout";

export interface SchemaRelationshipInspectorProps {
	table: DatabaseSchemaTableDTO | null;
	relationships: DatabaseSchemaRelationshipDTO[];
	onSelectTable: (key: string) => void;
	onUseQuery: (sql: string) => void;
	onClose?: () => void;
}

/** 展示所选表的一跳外键关系，并生成可执行 JOIN 模板。 */
export function SchemaRelationshipInspector({
	table,
	relationships,
	onSelectTable,
	onUseQuery,
	onClose,
}: SchemaRelationshipInspectorProps) {
	if (!table) {
		return (
			<aside className="text-muted-foreground flex min-h-0 items-center justify-center border-t px-5 py-8 text-center text-sm lg:border-t-0 lg:border-l">
				选择一张表查看外键方向与列映射
			</aside>
		);
	}

	const selectedKey = schemaTableKey(table);
	const outgoing = relationships.filter(
		(relationship) => relationshipSourceKey(relationship) === selectedKey,
	);
	const incoming = relationships.filter(
		(relationship) => relationshipTargetKey(relationship) === selectedKey,
	);

	return (
		<aside className="flex h-full min-h-0 flex-col bg-background">
			<div className="border-b border-primary/10 bg-primary/4 px-4 py-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="text-primary/70 font-mono text-[10px] uppercase tracking-wider">
							{table.schema}
						</p>
						<h3 className="mt-0.5 truncate font-mono text-sm font-semibold">
							{table.name}
						</h3>
						<p className="text-muted-foreground mt-2 text-xs">
							{table.columns.length} 列 · {outgoing.length} 条引用 · {incoming.length}{" "}
							条被引用
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-1">
						<Button
							variant="outline"
							size="xs"
							onClick={() => onUseQuery(buildTableSelectSQL(table))}
						>
							<DatabaseZap className="size-3" />
							查询
						</Button>
						{onClose && (
							<Button
								variant="ghost"
								size="icon-xs"
								aria-label="关闭关系详情"
								onClick={onClose}
							>
								<X className="size-3.5" />
							</Button>
						)}
					</div>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-auto px-3 py-3">
				{outgoing.length === 0 && incoming.length === 0 ? (
					<div className="text-muted-foreground px-2 py-8 text-center text-xs leading-5">
						这张表没有声明外键约束。名称相似的 <code>*_id</code> 列不会被臆测为关系。
					</div>
				) : (
					<div className="space-y-4">
						<RelationshipGroup
							title="引用出去"
							icon={<ArrowUpRight className="size-3.5" />}
							relationships={outgoing}
							selectedKey={selectedKey}
							onSelectTable={onSelectTable}
							onUseQuery={onUseQuery}
						/>
						<RelationshipGroup
							title="被其他表引用"
							icon={<ArrowDownLeft className="size-3.5" />}
							relationships={incoming}
							selectedKey={selectedKey}
							onSelectTable={onSelectTable}
							onUseQuery={onUseQuery}
						/>
					</div>
				)}
			</div>
		</aside>
	);
}

interface RelationshipGroupProps {
	title: string;
	icon: ReactNode;
	relationships: DatabaseSchemaRelationshipDTO[];
	selectedKey: string;
	onSelectTable: (key: string) => void;
	onUseQuery: (sql: string) => void;
}

function RelationshipGroup({
	title,
	icon,
	relationships,
	selectedKey,
	onSelectTable,
	onUseQuery,
}: RelationshipGroupProps) {
	if (relationships.length === 0) return null;
	return (
		<section>
			<h4 className="text-muted-foreground flex items-center gap-1.5 px-2 text-xs font-medium">
				{icon}
				{title}
			</h4>
			<div className="mt-2 space-y-1.5">
				{relationships.map((relationship) => {
					const sourceKey = relationshipSourceKey(relationship);
					const targetKey = relationshipTargetKey(relationship);
					const peerKey = sourceKey === selectedKey ? targetKey : sourceKey;
					return (
						<div
							key={`${sourceKey}:${relationship.name}:${targetKey}`}
							className="bg-muted/35 rounded-lg px-3 py-2.5"
						>
							<button
								type="button"
								className="hover:text-primary focus-visible:ring-ring w-full truncate text-left font-mono text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
								onClick={() => onSelectTable(peerKey)}
							>
								{peerKey}
							</button>
							<p className="text-muted-foreground mt-1 truncate font-mono text-[11px]">
								{relationship.source_columns.join(", ")} →{" "}
								{relationship.target_columns.join(", ")}
							</p>
							<div className="mt-2 flex items-center justify-between gap-2">
								<span className="text-muted-foreground text-[10px]">
									DELETE {relationship.on_delete}
								</span>
								<Button
									variant="ghost"
									size="xs"
									onClick={() =>
										onUseQuery(buildRelationshipJoinSQL(relationship))
									}
								>
									<SquareTerminal className="size-3" />
									生成 JOIN
								</Button>
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
