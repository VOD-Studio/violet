import {
    useAllComments,
    useApproveComment,
    useBatchUpdateComments,
    useDeleteComment,
    useMarkCommentSpam,
} from "@features/admin-comments/api/queries";
import type { AdminComment, CommentStatus } from "@features/admin-comments/model/types";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import { ConfirmDialog } from "@features/admin-shared/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@features/admin-shared/ui/data-table";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Segmented, type SegmentedItem } from "@shared/ui/segmented";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { useState } from "react";

/** 评论分页大小 */
const PAGE_SIZE = 20;

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

function AdminCommentsPage() {
    const [filter, setFilter] = useState<CommentFilter>("pending");
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // "all" -> 不传 status（查全部）；其余直接作为状态筛选
    const status: CommentStatus | undefined = filter === "all" ? undefined : filter;

    const { data, isLoading, error, refetch } = useAllComments({
        status,
        page,
        limit: PAGE_SIZE,
    });
    const approveMut = useApproveComment();
    const spamMut = useMarkCommentSpam();
    const deleteMut = useDeleteComment();
    const batchMut = useBatchUpdateComments();

    const switchFilter = (f: CommentFilter) => {
        setFilter(f);
        setPage(1);
        setSelected(new Set());
    };

    const columns: DataTableColumn<AdminComment>[] = [
        {
            key: "body",
            header: "评论内容",
            ellipsis: true,
            cell: (row) => <span className="line-clamp-2">{row.body}</span>,
        },
        {
            key: "author_name",
            header: "作者",
            cell: (row) => (
                <div className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                        {row.author_name?.[0] ?? "?"}
                    </span>
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
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => approveMut.mutate(row.id)}
                        disabled={approveMut.isPending}
                    >
                        通过
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => spamMut.mutate(row.id)}
                        disabled={spamMut.isPending}
                    >
                        垃圾
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingId(row.id)}
                        disabled={deleteMut.isPending}
                    >
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <PageShell title="评论审核" description="审核与管理文章评论">
            <div className="mb-4">
                <Segmented value={filter} onValueChange={switchFilter} segments={STATUS_SEGMENTS} />
            </div>

            {selected.size > 0 && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border bg-muted/50 p-2 text-sm">
                    <span>已选 {selected.size} 条</span>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            batchMut.mutate({
                                ids: [...selected],
                                status: "approved",
                            })
                        }
                        disabled={batchMut.isPending}
                    >
                        批量通过
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            batchMut.mutate({
                                ids: [...selected],
                                status: "spam",
                            })
                        }
                        disabled={batchMut.isPending}
                    >
                        批量标垃圾
                    </Button>
                </div>
            )}

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
