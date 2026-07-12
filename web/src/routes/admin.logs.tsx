import { useAdminAuditLogs } from "@features/admin-audit-logs/api/queries";
import type { AuditLogDTO } from "@features/admin-audit-logs/model/types";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import { DataTable, type DataTableColumn } from "@features/admin-shared/ui/data-table";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Modal } from "@shared/ui/modal";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useState } from "react";

/** 操作日志分页大小 */
const PAGE_SIZE = 20;

// TODO: 操作日志当前仅支持按 created_at 默认倒序，无显式排序参数。
// 后端 /admin/logs 需支持 sort_by + order 查询参数，以及按时间/动作/资源类型筛选。

function AdminLogsPage() {
    const [page, setPage] = useState(1);
    const { data, isLoading, error, refetch } = useAdminAuditLogs({
        page,
        limit: PAGE_SIZE,
    });
    const [detailLog, setDetailLog] = useState<AuditLogDTO | null>(null);

    const columns: DataTableColumn<AuditLogDTO>[] = [
        {
            key: "created_at",
            header: "时间",
            hideable: false,
            sortable: true,
            cell: (row) =>
                format(new Date(row.created_at), "MM-dd HH:mm", {
                    locale: zhCN,
                }),
        },
        {
            key: "user_name",
            header: "操作人",
            cell: (row) => row.user_name || row.user_id || "匿名",
        },
        {
            key: "action",
            header: "动作",
            cell: (row) => <Badge variant="secondary">{row.action}</Badge>,
        },
        {
            key: "resource",
            header: "资源",
            ellipsis: true,
            cell: (row) => `${row.resource}${row.resource_name ? ` · ${row.resource_name}` : ""}`,
        },
        {
            key: "ip_address",
            header: "IP",
            cell: (row) => row.ip_address || "-",
        },
        {
            key: "_detail",
            header: "操作",
            sticky: "right",
            width: "80px",
            cell: (row) => (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDetailLog(row)}
                    disabled={!row.detail}
                >
                    详情
                </Button>
            ),
        },
    ];

    return (
        <PageShell title="操作日志" description="用户操作审计记录">
            <DataTable<AuditLogDTO>
                data={data?.data ?? []}
                columns={columns}
                keyExtractor={(row) => String(row.id)}
                page={page}
                pageSize={PAGE_SIZE}
                total={data?.pagination?.total ?? 0}
                onPageChange={setPage}
                selectable={false}
                loading={isLoading}
                error={error ? new Error(error.message) : null}
                onRetry={() => refetch()}
                storageKey="admin-audit-logs-columns"
                caption="操作日志列表"
                emptyTitle="暂无操作日志"
                emptyDescription="还没有任何用户操作记录"
            />

            <Modal
                open={!!detailLog}
                onOpenChange={(open) => !open && setDetailLog(null)}
                title="操作详情"
                size="md"
            >
                <pre className="max-h-96 overflow-auto rounded bg-muted p-3 font-mono text-xs">
                    {JSON.stringify(detailLog?.detail ?? {}, null, 2)}
                </pre>
            </Modal>
        </PageShell>
    );
}

export const Route = createFileRoute("/admin/logs")({
    component: AdminLogsPage,
});
