import {
    useAdminAnnouncements,
    useDeleteAnnouncement,
} from "@features/admin-announcements/api/queries";
import type { AnnouncementDTO, AnnouncementType } from "@features/admin-announcements/model/types";
import { AnnouncementDialog } from "@features/admin-announcements/ui/AnnouncementDialog";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import { ConfirmDialog } from "@features/admin-shared/ui/confirm-dialog";
import type { DataTableColumn } from "@features/admin-shared/ui/data-table";
import { DataTable } from "@features/admin-shared/ui/data-table";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/announcements")({
    component: AdminAnnouncementsPage,
});

const TYPE_LABEL: Record<AnnouncementType, string> = {
    info: "信息",
    warning: "警告",
    success: "成功",
    error: "错误",
};

function formatTime(s?: string): string {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleString("zh-CN");
}

function AdminAnnouncementsPage() {
    const { data: announcements = [], isLoading, error, refetch } = useAdminAnnouncements();
    const deleteAnn = useDeleteAnnouncement();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<AnnouncementDTO | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState<AnnouncementDTO | null>(null);

    const handleEdit = (a: AnnouncementDTO) => {
        setEditing(a);
        setDialogOpen(true);
    };
    const handleCreate = () => {
        setEditing(null);
        setDialogOpen(true);
    };
    const handleDelete = (a: AnnouncementDTO) => {
        setDeleting(a);
        setDeleteOpen(true);
    };
    const confirmDelete = () => {
        if (!deleting?.id) return;
        deleteAnn.mutate(deleting.id, {
            onSuccess: () => {
                setDeleteOpen(false);
                setDeleting(null);
            },
        });
    };

    const columns: DataTableColumn<AnnouncementDTO>[] = [
        {
            key: "title",
            header: "标题",
            sortable: true,
            width: "40%",
            cell: (row) => <span className="font-medium">{row.title}</span>,
        },
        {
            key: "type",
            header: "类型",
            width: "80px",
            cell: (row) => <Badge variant="outline">{TYPE_LABEL[row.type]}</Badge>,
        },
        {
            key: "range",
            header: "生效区间",
            width: "220px",
            ellipsis: true,
            cell: (row) => (
                <span className="text-muted-foreground text-sm">
                    {formatTime(row.start_time)} ~ {formatTime(row.end_time)}
                </span>
            ),
        },
        {
            key: "is_active",
            header: "状态",
            width: "80px",
            cell: (row) => (
                <Badge variant={row.is_active ? "default" : "secondary"}>
                    {row.is_active ? "启用" : "停用"}
                </Badge>
            ),
        },
        {
            key: "actions_col",
            header: "操作",
            sticky: "right",
            width: "100px",
            cell: (row) => (
                <div className="flex items-center gap-2">
                    <PermissionGuard permission="announcement:manage">
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleEdit(row)}
                            title="编辑"
                        >
                            <Pencil className="size-3.5" />
                        </Button>
                    </PermissionGuard>
                    <PermissionGuard permission="announcement:manage">
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleDelete(row)}
                            title="删除"
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
                    </PermissionGuard>
                </div>
            ),
        },
    ];

    return (
        <PageShell
            title="公告管理"
            description="管理站点公告"
            action={
                <PermissionGuard permission="announcement:manage">
                    <Button size="sm" onClick={handleCreate}>
                        <Plus className="size-3.5" />
                        创建公告
                    </Button>
                </PermissionGuard>
            }
        >
            <DataTable<AnnouncementDTO>
                data={announcements}
                columns={columns}
                keyExtractor={(row) => String(row.id)}
                page={1}
                pageSize={announcements.length}
                total={announcements.length}
                onPageChange={() => {}}
                selectable={false}
                loading={isLoading}
                error={error ? new Error(error.message) : null}
                onRetry={() => refetch()}
                storageKey="admin-announcements-columns"
                resizable
                caption="公告列表"
                emptyTitle="暂无公告"
                emptyDescription="还没有创建任何公告"
            />
            <AnnouncementDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                onConfirm={confirmDelete}
                title="确认删除公告"
                description={`确定要删除公告 ${deleting?.title} 吗？`}
                confirmLabel="删除"
                loading={deleteAnn.isPending}
            />
        </PageShell>
    );
}
