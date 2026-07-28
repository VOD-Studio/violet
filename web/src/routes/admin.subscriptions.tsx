import { PageShell } from "@features/admin-layout/ui/PageShell";
import { ConfirmDialog } from "@features/admin-shared/ui/confirm-dialog";
import type { DataTableColumn } from "@features/admin-shared/ui/data-table";
import { DataTable } from "@features/admin-shared/ui/data-table";
import {
    useCreateSubscription,
    useDeleteSubscription,
    usePauseSubscription,
    useResumeSubscription,
    useSubscriptions,
    useUpdateSubscription,
} from "@features/admin-subscriptions/api/queries";
import {
    type CreateSubscriptionRequest,
    intervalLabel,
    type SubscriptionDTO,
} from "@features/admin-subscriptions/model/types";
import { SubscriptionFormDialog } from "@features/admin-subscriptions/ui/SubscriptionFormDialog";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@shared/ui/base/select";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import * as React from "react";

export const Route = createFileRoute("/admin/subscriptions")({
    component: AdminSubscriptionsPage,
});

function AdminSubscriptionsPage() {
    const [statusFilter, setStatusFilter] = React.useState<string>("");
    const [page, setPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(20);

    const { data, isLoading, error, refetch } = useSubscriptions(statusFilter, page, pageSize);
    const createMut = useCreateSubscription();
    const updateMut = useUpdateSubscription();
    const pauseMut = usePauseSubscription();
    const resumeMut = useResumeSubscription();
    const deleteMut = useDeleteSubscription();

    const [createOpen, setCreateOpen] = React.useState(false);
    const [editing, setEditing] = React.useState<SubscriptionDTO | null>(null);
    const [deleting, setDeleting] = React.useState<SubscriptionDTO | null>(null);

    const columns: DataTableColumn<SubscriptionDTO>[] = [
        {
            key: "title",
            header: "标题",
            accessorKey: "title",
            ellipsis: true,
            cell: (row) => (
                <div className="min-w-0">
                    <div className="truncate font-medium">{row.title || row.feed_url}</div>
                    <div className="text-muted-foreground truncate font-mono text-xs">
                        {row.feed_url}
                    </div>
                </div>
            ),
        },
        {
            key: "status",
            header: "状态",
            width: "120px",
            cell: (row) => {
                const paused = row.status === "paused";
                return (
                    <div className="flex flex-wrap items-center gap-1">
                        <Badge variant={paused ? "destructive" : "default"}>
                            {paused ? "已暂停" : "活跃"}
                        </Badge>
                        {row.consecutive_failures > 0 && !paused && (
                            <Badge variant="outline" className="text-yellow-600">
                                <AlertTriangle className="mr-0.5 size-3" />
                                {row.consecutive_failures}
                            </Badge>
                        )}
                    </div>
                );
            },
        },
        {
            key: "interval",
            header: "频率",
            width: "100px",
            cell: (row) => intervalLabel(row.interval),
        },
        {
            key: "last_fetched_at",
            header: "最近抓取",
            width: "160px",
            cell: (row) =>
                row.last_fetched_at
                    ? new Date(row.last_fetched_at).toLocaleString("zh-CN")
                    : "从未",
        },
        {
            key: "last_error",
            header: "最近错误",
            ellipsis: true,
            tooltip: (row) => row.last_error ?? "",
            cell: (row) =>
                row.last_error ? (
                    <span className="text-red-600 text-xs dark:text-red-400">{row.last_error}</span>
                ) : (
                    <span className="text-muted-foreground">—</span>
                ),
        },
        {
            key: "actions",
            header: "操作",
            hideable: false,
            sticky: "right",
            width: "140px",
            align: "center",
            cell: (row) => {
                const paused = row.status === "paused";
                return (
                    <div className="flex justify-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            title={paused ? "恢复（清零失败计数）" : "暂停"}
                            onClick={() => (paused ? resumeMut : pauseMut).mutate(row.id)}
                        >
                            {paused ? (
                                <Play className="size-3.5" />
                            ) : (
                                <Pause className="size-3.5" />
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            title="编辑"
                            onClick={() => setEditing(row)}
                        >
                            <Pencil className="size-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            title="删除"
                            className="hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleting(row)}
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
                    </div>
                );
            },
        },
    ];

    return (
        <PageShell
            title="RSS 订阅管理"
            description="管理 RSS 订阅源"
            action={
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="size-3.5" />
                    新建订阅
                </Button>
            }
        >
            <PermissionGuard permission="subscription:manage">
                <DataTable
                    columns={columns}
                    data={data?.items ?? []}
                    keyExtractor={(row) => row.id}
                    page={page}
                    pageSize={pageSize}
                    total={data?.total ?? 0}
                    onPageChange={setPage}
                    onPageSizeChange={(s) => {
                        setPageSize(s);
                        setPage(1);
                    }}
                    loading={isLoading}
                    error={error}
                    onRetry={refetch}
                    toolbar={
                        <Select
                            value={statusFilter || "all"}
                            onValueChange={(v) => {
                                setStatusFilter(v === "all" ? "" : v);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="h-9 w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部状态</SelectItem>
                                <SelectItem value="active">活跃</SelectItem>
                                <SelectItem value="paused">已暂停</SelectItem>
                            </SelectContent>
                        </Select>
                    }
                />
            </PermissionGuard>

            <SubscriptionFormDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                title="新建订阅"
                loading={createMut.isPending}
                onSubmit={(body) => {
                    createMut.mutate(body, { onSuccess: () => setCreateOpen(false) });
                }}
            />

            <SubscriptionFormDialog
                open={!!editing}
                onOpenChange={(open) => {
                    if (!open) setEditing(null);
                }}
                title="编辑订阅"
                initial={editing ?? undefined}
                loading={updateMut.isPending}
                onSubmit={(body: CreateSubscriptionRequest) => {
                    if (!editing) return;
                    updateMut.mutate(
                        { id: editing.id, body },
                        { onSuccess: () => setEditing(null) },
                    );
                }}
            />

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(open) => {
                    if (!open) setDeleting(null);
                }}
                title="删除订阅"
                description={`确定删除订阅「${deleting?.title || deleting?.feed_url}」？其抓取记录将一并删除。`}
                confirmLabel="删除"
                loading={deleteMut.isPending}
                onConfirm={() => {
                    if (!deleting) return;
                    deleteMut.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
                }}
            />
        </PageShell>
    );
}
