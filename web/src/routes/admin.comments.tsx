import {
    useAllComments,
    useApproveComment,
    useBatchUpdateComments,
    useDeleteComment,
    useMarkCommentSpam,
} from "@features/admin-comments/api/queries";
import type {
    AdminComment,
    CommentStatus,
    CommentType,
} from "@features/admin-comments/model/types";
import { CommentCell } from "@features/admin-comments/ui/CommentCell";
import { CommentDetail } from "@features/admin-comments/ui/CommentDetail";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import { ConfirmDialog } from "@features/admin-shared/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@features/admin-shared/ui/data-table";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { avatarUrl } from "@shared/lib/image-url";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Segmented, type SegmentedItem } from "@shared/ui/segmented";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Check, Trash2 } from "lucide-react";
import { useState } from "react";

/** 评论分页大小 */
const PAGE_SIZE = 20;

// TODO: 评论列表当前无排序能力；后端 /admin/comments 需支持 sort_by + order 查询参数。
// TODO: 评论管理缺少批量删除后端接口（当前仅有批量更新状态）。

/** 筛选值："all" 表示全部，其余为具体状态 */
type CommentFilter = "all" | CommentStatus;

/** 状态分段配置（"全部" + 四种状态） */
const STATUS_SEGMENTS: SegmentedItem<CommentFilter>[] = [
    { value: "all", label: "全部" },
    { value: "pending", label: "待审核" },
    { value: "approved", label: "已通过" },
    { value: "spam", label: "垃圾" },
    { value: "deleted", label: "已删除" },
];

/** 状态 -> 徽标文案与样式 */
const STATUS_BADGE: Record<
    CommentStatus,
    {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
    }
> = {
    pending: { label: "待审核", variant: "secondary" },
    approved: { label: "已通过", variant: "default" },
    spam: { label: "垃圾", variant: "destructive" },
    deleted: { label: "已删除", variant: "outline" },
};

/**
 * 类型筛选值（与状态维度正交）：
 *   - all：全部（默认，与后端 mapAdminCommentType 默认值一致）
 *   - annotation：仅批注（带锚定原文摘录）
 *   - free：仅自由评论（普通评论）
 */
type CommentTypeFilter = "all" | CommentType;

/** 类型分段配置（"全部" + 批注 + 自由评论） */
const TYPE_SEGMENTS: SegmentedItem<CommentTypeFilter>[] = [
    { value: "all", label: "全部" },
    { value: "annotation", label: "批注" },
    { value: "free", label: "自由评论" },
];

function AdminCommentsPage() {
    const [filter, setFilter] = useState<CommentFilter>("pending");
    // 类型筛选与状态筛选正交：切换任一维度都重置分页与勾选。
    const [typeFilter, setTypeFilter] = useState<CommentTypeFilter>("all");
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // "all" -> 不传 status/type（查全部）；其余直接作为筛选值透传后端。
    const status: CommentStatus | undefined = filter === "all" ? undefined : filter;
    const type: CommentType | undefined = typeFilter === "all" ? undefined : typeFilter;

    const { data, isLoading, error, refetch } = useAllComments({
        status,
        type,
        page,
        limit: PAGE_SIZE,
    });
    const approveMut = useApproveComment();
    const spamMut = useMarkCommentSpam();
    const deleteMut = useDeleteComment();
    const batchMut = useBatchUpdateComments();

    const canApprove = useHasPermission("comment:approve");
    const canDelete = useHasPermission("comment:delete");

    const handleBatchApprove = () => {
        if (selected.size === 0) return;
        batchMut.mutate(
            { ids: [...selected], status: "approved" },
            { onSuccess: () => setSelected(new Set()) },
        );
    };

    const handleBatchSpam = () => {
        if (selected.size === 0) return;
        batchMut.mutate(
            { ids: [...selected], status: "spam" },
            { onSuccess: () => setSelected(new Set()) },
        );
    };

    const switchFilter = (f: CommentFilter) => {
        setFilter(f);
        setPage(1);
        setSelected(new Set());
    };

    const switchTypeFilter = (t: CommentTypeFilter) => {
        setTypeFilter(t);
        setPage(1);
        setSelected(new Set());
    };

    const columns: DataTableColumn<AdminComment>[] = [
        {
            key: "body",
            header: "评论内容",
            hideable: false,
            className: "whitespace-normal",
            cell: (row) => <CommentCell row={row} />,
        },
        {
            key: "author_name",
            header: "作者",
            cell: (row) => (
                <div className="flex items-center gap-2">
                    <img
                        src={avatarUrl(row.avatar_url, row.author_name)}
                        alt={row.author_name}
                        className="size-6 shrink-0 rounded-full object-cover"
                        loading="lazy"
                    />
                    <span className="text-sm">{row.author_name}</span>
                </div>
            ),
        },
        {
            key: "post_title",
            header: "文章",
            ellipsis: true,
            cell: (row) => (
                <Link
                    to="/blog/$slug"
                    params={{ slug: row.post_slug }}
                    className="text-sm text-primary hover:underline"
                >
                    {row.post_title}
                </Link>
            ),
        },
        {
            key: "status",
            header: "状态",
            cell: (row) => (
                <Badge variant={STATUS_BADGE[row.status].variant}>
                    {STATUS_BADGE[row.status].label}
                </Badge>
            ),
        },
        {
            key: "created_at",
            header: "时间",
            cell: (row) =>
                format(new Date(row.created_at), "MM-dd HH:mm", {
                    locale: zhCN,
                }),
        },
        {
            key: "_actions",
            header: "操作",
            sticky: "right",
            width: "200px",
            cell: (row) => (
                <div className="flex items-center gap-1">
                    {canApprove ? (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => approveMut.mutate(row.id)}
                            disabled={approveMut.isPending}
                        >
                            通过
                        </Button>
                    ) : null}
                    {canApprove ? (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => spamMut.mutate(row.id)}
                            disabled={spamMut.isPending}
                        >
                            垃圾
                        </Button>
                    ) : null}
                    {canDelete ? (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingId(row.id)}
                            disabled={deleteMut.isPending}
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    ) : null}
                </div>
            ),
        },
    ];

    return (
        <PageShell
            title="评论审核"
            description="审核与管理文章评论"
            sticky={
                <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Segmented
                        value={filter}
                        onValueChange={switchFilter}
                        segments={STATUS_SEGMENTS}
                    />
                    <Segmented
                        value={typeFilter}
                        onValueChange={switchTypeFilter}
                        segments={TYPE_SEGMENTS}
                    />
                </div>
            }
        >
            <DataTable<AdminComment>
                data={data?.data ?? []}
                columns={columns}
                keyExtractor={(row) => row.id}
                page={page}
                pageSize={PAGE_SIZE}
                total={data?.pagination?.total ?? 0}
                onPageChange={setPage}
                selectable
                selectedIds={selected}
                onSelectionChange={setSelected}
                expandable
                expandedRowFixed
                renderExpandedRow={(row) => <CommentDetail row={row} />}
                bulkActions={
                    canApprove ? (
                        <>
                            <Button
                                variant="outline"
                                className="h-9"
                                onClick={handleBatchApprove}
                                disabled={batchMut.isPending}
                            >
                                <Check className="size-3.5" />
                                批量通过
                            </Button>
                            <Button
                                variant="outline"
                                className="h-9"
                                onClick={handleBatchSpam}
                                disabled={batchMut.isPending}
                            >
                                批量标垃圾
                            </Button>
                        </>
                    ) : null
                }
                loading={isLoading}
                error={error ? new Error(error.message) : null}
                onRetry={() => refetch()}
                storageKey="admin-comments-columns"
                caption="评论列表"
                emptyTitle="暂无评论"
                emptyDescription="当前状态下没有评论"
            />

            <ConfirmDialog
                open={!!deletingId}
                onOpenChange={(open) => !open && setDeletingId(null)}
                onConfirm={() => {
                    if (deletingId) deleteMut.mutate(deletingId);
                    setDeletingId(null);
                }}
                title="确认删除评论"
                description="确定要删除这条评论吗？此操作不可恢复。"
                confirmLabel="删除"
                loading={deleteMut.isPending}
            />
        </PageShell>
    );
}

export const Route = createFileRoute("/admin/comments")({
    component: AdminCommentsPage,
});
