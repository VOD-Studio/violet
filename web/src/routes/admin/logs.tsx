import { useAuditLogs } from "@features/admin-logs/api/queries";
import type { AuditLog } from "@features/admin-logs/model/types";
import { DataTable } from "@features/admin-shared/ui/DataTable";
import { PageHeader } from "@features/admin-shared/ui/PageHeader";
import { Pagination } from "@features/admin-shared/ui/Pagination";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

/**
 * /admin/logs - 操作日志
 */
export const Route = createFileRoute("/admin/logs")({
	component: LogsPage,
});

function LogsPage() {
	const [query, setQuery] = useState({ page: 1, limit: 20 });
	const { data, isLoading } = useAuditLogs(query);
	const logs = data?.data ?? [];
	const pagination = data?.pagination;

	const columns = [
		{ key: "action", header: "操作", cell: (row: AuditLog) => row.Action },
		{
			key: "resource",
			header: "资源",
			cell: (row: AuditLog) => `${row.Resource}/${row.ResourceID}`,
		},
		{ key: "user", header: "用户", cell: (row: AuditLog) => row.UserID ?? "匿名" },
		{ key: "ip", header: "IP", cell: (row: AuditLog) => row.IPAddress },
		{
			key: "detail",
			header: "详情",
			cell: (row: AuditLog) => (
				<details className="text-xs">
					<summary className="cursor-pointer text-muted-foreground">查看</summary>
					<pre className="mt-1 max-w-xs overflow-auto rounded bg-muted p-1 text-[10px]">
						{JSON.stringify(row.Detail, null, 2)}
					</pre>
				</details>
			),
		},
		{
			key: "created",
			header: "时间",
			cell: (row: AuditLog) => new Date(row.CreatedAt).toLocaleString("zh-CN"),
		},
	];

	return (
		<div>
			<PageHeader title="操作日志" description="查看后台管理操作审计记录" />

			<DataTable
				columns={columns}
				data={logs}
				loading={isLoading}
				keyExtractor={(row) => row.ID.toString()}
				emptyTitle="NO_LOGS"
				emptyDescription="没有找到操作日志"
			/>

			{pagination?.total_pages && pagination.total_pages > 1 ? (
				<Pagination
					className="mt-4"
					page={query.page}
					totalPages={pagination.total_pages}
					onChange={(page) => setQuery({ ...query, page })}
				/>
			) : null}
		</div>
	);
}
