import {
	DataTable,
	type DataTableColumn,
	useClientPagination,
} from "@features/admin-shared/ui/data-table";
import { formatDate, formatDateTime } from "@shared/lib/date";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Switch } from "@shared/ui/base/switch";
import { Database, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useDatabaseSchema, useDatabaseStatus } from "../api/queries";
import type { DatabaseActivityDTO, DatabaseIndexDTO, DatabaseTableDTO } from "../model/types";
import { formatBytes } from "./format";
import { SchemaRelationshipGraph } from "./SchemaRelationshipGraph";

const numberFormat = new Intl.NumberFormat("zh-CN");

const tableColumns: DataTableColumn<DatabaseTableDTO>[] = [
	{
		key: "table",
		header: "数据表",
		hideable: false,
		width: "220px",
		cell: (row) => (
			<div className="min-w-0">
				<p className="truncate font-medium">{row.name}</p>
				<p className="text-muted-foreground truncate text-xs">{row.schema}</p>
			</div>
		),
	},
	{
		key: "estimated_rows",
		header: "估算行数",
		align: "right",
		width: "120px",
		cell: (row) => numberFormat.format(row.estimated_rows),
		exportValue: (row) => row.estimated_rows,
	},
	{
		key: "table_size",
		header: "表大小",
		align: "right",
		width: "110px",
		cell: (row) => formatBytes(row.table_size),
	},
	{
		key: "index_size",
		header: "索引大小",
		align: "right",
		width: "110px",
		cell: (row) => formatBytes(row.index_size),
	},
	{
		key: "total_size",
		header: "总大小",
		align: "right",
		width: "110px",
		cell: (row) => <span className="font-medium">{formatBytes(row.total_size)}</span>,
	},
	{
		key: "dead_tuples",
		header: "死元组",
		align: "right",
		width: "100px",
		cell: (row) => numberFormat.format(row.dead_tuples),
	},
	{
		key: "statistics",
		header: "统计信息",
		width: "180px",
		cell: (row) => (
			<div className="flex items-center gap-2">
				<Badge variant={row.statistics_fresh ? "secondary" : "outline"}>
					{row.statistics_fresh ? "7 日内已分析" : "待分析"}
				</Badge>
				{row.last_analyze && (
					<span className="text-muted-foreground text-xs">
						{formatDate(row.last_analyze)}
					</span>
				)}
			</div>
		),
	},
];

export interface DatabaseStatusTabProps {
	onUseQuery?: (sql: string) => void;
}

/** PostgreSQL 数据库状态页签。 */
export function DatabaseStatusTab({ onUseQuery }: DatabaseStatusTabProps) {
	const [polling, setPolling] = useState(true);
	const query = useDatabaseStatus({ polling });
	const tables = query.data?.tables ?? [];
	const { pagedData, pagination } = useClientPagination(tables, 20);

	if (query.isLoading) {
		return (
			<div className="text-muted-foreground flex flex-1 items-center justify-center gap-2 py-20">
				<Loader2 className="size-4 animate-spin" />
				正在读取 PostgreSQL 统计视图
			</div>
		);
	}

	if (query.error || !query.data) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
				<p className="text-sm font-medium">数据库状态读取失败</p>
				<p className="text-muted-foreground max-w-140 text-sm">
					{query.error?.message ?? "接口未返回状态数据"}
				</p>
				<Button variant="outline" size="sm" onClick={() => void query.refetch()}>
					<RefreshCw className="size-3.5" />
					重试
				</Button>
			</div>
		);
	}

	const status = query.data;
	return (
		<div className="space-y-6 pt-5">
			<div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
				<p className="text-muted-foreground text-xs">
					采集于 {formatDateTime(status.collected_at, "second")}
				</p>
				<div className="flex items-center gap-3">
					<div className="text-muted-foreground flex items-center gap-1.5 text-xs">
						<Switch
							aria-label="自动刷新数据库状态"
							checked={polling}
							onCheckedChange={setPolling}
							size="sm"
						/>
						15 秒刷新
					</div>
					<Button
						variant="outline"
						size="sm"
						disabled={query.isFetching}
						onClick={() => void query.refetch()}
					>
						<RefreshCw
							className={`size-3.5 ${query.isFetching ? "animate-spin" : ""}`}
						/>
						刷新
					</Button>
				</div>
			</div>

			<section className="overflow-hidden rounded-xl border bg-card">
				<div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-5">
					<Metric label="数据库体积" value={formatBytes(status.database_size)} />
					<Metric
						label="连接"
						value={`${status.total_connections} / ${status.max_connections}`}
					/>
					<Metric label="表" value={numberFormat.format(status.table_count)} />
					<Metric
						label="连接池"
						value={`${status.pool.inUse} 在用 · ${status.pool.idle} 空闲`}
					/>
					<div className="space-y-1.5 bg-card px-5 py-4 sm:col-span-2 lg:col-span-1">
						<p className="text-muted-foreground text-xs">迁移状态</p>
						<div className="flex items-center gap-2">
							<span className="font-mono text-lg font-semibold tabular-nums">
								v{status.migration.version}
							</span>
							<Badge variant={status.migration.dirty ? "destructive" : "secondary"}>
								{status.migration.dirty ? "DIRTY" : "CLEAN"}
							</Badge>
						</div>
					</div>
				</div>
			</section>

			<section className="space-y-3">
				<SectionHeading
					title="数据表"
					detail="行数来自 PostgreSQL 统计估算，不触发逐表 COUNT(*)"
				/>
				<DataTable
					columns={tableColumns}
					data={pagedData}
					keyExtractor={(row) => `${row.schema}.${row.name}`}
					pagination={pagination}
					storageKey="system-database-tables"
					caption="PostgreSQL 数据表统计"
					emptyTitle="暂无用户表"
					emptyDescription="public schema 中没有可展示的数据表"
					className="h-112"
				/>
			</section>

			{onUseQuery && <DatabaseRelationshipSection onUseQuery={onUseQuery} />}

			<div className="grid gap-6 xl:grid-cols-2">
				<IndexTable indexes={status.top_indexes} />
				<ActivityTable activities={status.active_queries} />
			</div>
		</div>
	);
}

function DatabaseRelationshipSection({ onUseQuery }: { onUseQuery: (sql: string) => void }) {
	const query = useDatabaseSchema();
	if (query.isLoading) {
		return (
			<div className="text-muted-foreground flex h-28 items-center justify-center gap-2 rounded-xl border border-primary/10 bg-primary/3 text-sm">
				<Loader2 className="size-4 animate-spin" />
				正在编排关系星图
			</div>
		);
	}
	if (query.error || !query.data) {
		return (
			<div className="rounded-xl border bg-card px-5 py-8 text-center">
				<p className="text-sm font-medium">关系图谱读取失败</p>
				<p className="text-muted-foreground mt-1 text-xs">
					{query.error?.message ?? "schema 接口未返回数据"}
				</p>
			</div>
		);
	}
	return <SchemaRelationshipGraph schema={query.data} onUseQuery={onUseQuery} />;
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="space-y-1.5 bg-card px-5 py-4">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="font-mono text-lg font-semibold tracking-tight tabular-nums">{value}</p>
		</div>
	);
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-2">
			<h2 className="flex items-center gap-2 text-sm font-semibold">
				<Database className="text-primary size-4" />
				{title}
			</h2>
			<p className="text-muted-foreground text-xs">{detail}</p>
		</div>
	);
}

function IndexTable({ indexes }: { indexes: DatabaseIndexDTO[] }) {
	return (
		<section className="overflow-hidden rounded-xl border bg-card">
			<div className="border-b px-5 py-4">
				<h2 className="text-sm font-semibold">大型索引</h2>
				<p className="text-muted-foreground mt-1 text-xs">按占用空间显示前 20 项</p>
			</div>
			<div className="max-h-80 overflow-auto">
				<table className="w-full text-left text-sm">
					<caption className="sr-only">PostgreSQL 索引统计</caption>
					<thead className="bg-muted/70 text-muted-foreground sticky top-0 text-xs">
						<tr>
							<th className="px-4 py-2.5 font-medium">索引</th>
							<th className="px-4 py-2.5 text-right font-medium">扫描</th>
							<th className="px-4 py-2.5 text-right font-medium">大小</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{indexes.map((index) => (
							<tr key={`${index.schema}.${index.name}`}>
								<td className="min-w-0 px-4 py-3">
									<p className="max-w-80 truncate font-mono text-xs">
										{index.name}
									</p>
									<p className="text-muted-foreground mt-0.5 text-xs">
										{index.table}
									</p>
								</td>
								<td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
									{numberFormat.format(index.scans)}
								</td>
								<td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
									{formatBytes(index.size)}
								</td>
							</tr>
						))}
						{indexes.length === 0 && (
							<tr>
								<td
									colSpan={3}
									className="text-muted-foreground px-4 py-10 text-center"
								>
									暂无索引统计
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</section>
	);
}

function ActivityTable({ activities }: { activities: DatabaseActivityDTO[] }) {
	return (
		<section className="overflow-hidden rounded-xl border bg-card">
			<div className="border-b px-5 py-4">
				<h2 className="text-sm font-semibold">活动查询</h2>
				<p className="text-muted-foreground mt-1 text-xs">
					仅显示采样瞬间仍在执行、等待锁或等待 I/O 的会话，排除当前诊断请求
				</p>
			</div>
			<div className="max-h-80 overflow-auto">
				<table className="w-full text-left text-sm">
					<caption className="sr-only">PostgreSQL 活动查询</caption>
					<thead className="bg-muted/70 text-muted-foreground sticky top-0 text-xs">
						<tr>
							<th className="px-4 py-2.5 font-medium">PID / 用户</th>
							<th className="px-4 py-2.5 font-medium">查询</th>
							<th className="px-4 py-2.5 text-right font-medium">持续</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{activities.map((activity) => (
							<tr key={activity.pid}>
								<td className="whitespace-nowrap px-4 py-3 align-top">
									<p className="font-mono text-xs">{activity.pid}</p>
									<p className="text-muted-foreground text-xs">{activity.user}</p>
								</td>
								<td className="max-w-96 px-4 py-3 align-top">
									<p className="line-clamp-2 font-mono text-xs">
										{activity.query}
									</p>
									<p className="text-muted-foreground mt-1 text-xs">
										{activity.state}
										{activity.wait_event ? ` · ${activity.wait_event}` : ""}
									</p>
								</td>
								<td className="px-4 py-3 text-right align-top font-mono text-xs tabular-nums">
									{activity.duration_seconds.toFixed(1)}s
								</td>
							</tr>
						))}
						{activities.length === 0 && (
							<tr>
								<td colSpan={3} className="px-4 py-9 text-center">
									<p className="text-sm font-medium">数据库当前空闲</p>
									<p className="text-muted-foreground mt-1 text-xs">
										普通查询通常在 15
										秒采样前已经结束，因此这里长期为空是正常状态。
									</p>
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</section>
	);
}
