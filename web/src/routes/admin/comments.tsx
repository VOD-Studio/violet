import { CommentActionCell } from "@features/admin-comments/ui/CommentActionCell";
import { DataTable, type DataTableColumn } from "@features/admin-shared/ui/DataTable";
import { PageHeader } from "@features/admin-shared/ui/PageHeader";
import { Pagination } from "@features/admin-shared/ui/Pagination";
import { StatusBadge } from "@features/admin-shared/ui/StatusBadge";
import { useBatchUpdateCommentStatus } from "@features/comments/api/mutations";
import { useAdminComments } from "@features/comments/api/queries";
import type { AdminComment, Comment } from "@features/comments/model/types";
import { Button } from "@shared/ui/button";
import { Checkbox } from "@shared/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@shared/ui/tabs";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

/**
 * /admin/comments - 评论管理
 */
export const Route = createFileRoute("/admin/comments")({
	component: CommentsPage,
});

type TabValue = "pending" | "all";

function CommentsPage() {
	const [tab, setTab] = useState<TabValue>("pending");
	const [query, setQuery] = useState({ page: 1, limit: 10 });
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	const listQuery =
		tab === "pending" ? { ...query, status: "pending" as const } : { ...query, status: undefined };
	const { data, isLoading, error, refetch } = useAdminComments(listQuery);
	const comments = data?.data ?? [];
	const pagination = data?.pagination;

	const batchUpdate = useBatchUpdateCommentStatus();

	const toggleSelect = (id: string) => {
		const next = new Set(selectedIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		setSelectedIds(next);
	};

	const toggleSelectAll = () => {
		if (selectedIds.size === comments.length && comments.length > 0) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(comments.map((c) => c.id)));
		}
	};

	const handleBatchStatus = (status: "pending" | "approved" | "spam" | "deleted") => {
		if (selectedIds.size === 0) return;
		batchUpdate.mutate(
			{ ids: Array.from(selectedIds), status },
			{
				onSuccess: () => {
					toast.success("批量更新状态成功");
					setSelectedIds(new Set());
					void refetch();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	const columns: DataTableColumn<AdminComment>[] = [
		{
			key: "select",
			header: (
				<Checkbox
					checked={comments.length > 0 && selectedIds.size === comments.length}
					data-indeterminate={selectedIds.size > 0 && selectedIds.size < comments.length}
					onCheckedChange={toggleSelectAll}
					aria-label="全选"
				/>
			),
			cell: (row: Comment) => (
				<Checkbox
					checked={selectedIds.has(row.id)}
					onCheckedChange={() => toggleSelect(row.id)}
					aria-label={`选择 ${row.author_name}`}
				/>
			),
			width: "48px",
			sticky: "left",
			className: "text-center",
		},
		{ key: "author", header: "作者", accessorKey: "author_name", width: "120px" },
		{
			key: "content",
			header: "内容",
			accessorKey: "body",
			cell: (row: Comment) => <p className="max-w-xs truncate text-sm">{row.body}</p>,
		},
		{
			key: "post",
			header: "文章",
			accessorKey: "post_title",
			cell: (row: AdminComment) => <p className="max-w-xs truncate text-sm">{row.post_title}</p>,
			width: "180px",
		},
		{
			key: "status",
			header: "状态",
			cell: (row: Comment) => <StatusBadge status={row.status} kind="comment" />,
			width: "96px",
			align: "center",
		},
		{
			key: "created",
			header: "时间",
			accessorKey: "created_at",
			cell: (row: Comment) => new Date(row.created_at).toLocaleString("zh-CN"),
			width: "150px",
		},
		{
			key: "actions",
			header: "操作",
			cell: (row: Comment) => <CommentActionCell comment={row} onMutated={refetch} />,
			width: "200px",
			sticky: "right",
		},
	];

	return (
		<div>
			<PageHeader title="评论管理" description="审核评论、标记垃圾信息与管理评论状态" />

			<Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="mb-4">
				<TabsList>
					<TabsTrigger value="pending">待审核</TabsTrigger>
					<TabsTrigger value="all">全部</TabsTrigger>
				</TabsList>
			</Tabs>

			{selectedIds.size > 0 && (
				<div className="mb-3 flex flex-wrap items-center gap-2">
					<span className="text-sm text-muted-foreground">已选择 {selectedIds.size} 项</span>
					<Button variant="outline" size="sm" onClick={() => handleBatchStatus("approved")}>
						批量通过
					</Button>
					<Button variant="outline" size="sm" onClick={() => handleBatchStatus("spam")}>
						批量标垃圾
					</Button>
					<Button variant="destructive" size="sm" onClick={() => handleBatchStatus("deleted")}>
						批量删除
					</Button>
				</div>
			)}

			<DataTable
				columns={columns}
				data={comments}
				loading={isLoading}
				error={error}
				onRetry={refetch}
				keyExtractor={(row) => row.id}
				stickyHeader
				maxHeight="55vh"
				density="compact"
				caption="评论列表"
				emptyTitle="NO_COMMENTS"
				emptyDescription="没有找到评论"
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
