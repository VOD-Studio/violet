import { ConfirmDialog } from "@features/admin-shared/ui/ConfirmDialog";
import { DataTable } from "@features/admin-shared/ui/DataTable";
import { PageHeader } from "@features/admin-shared/ui/PageHeader";
import { Pagination } from "@features/admin-shared/ui/Pagination";
import { StatusBadge } from "@features/admin-shared/ui/StatusBadge";
import {
	useApproveComment,
	useBatchUpdateCommentStatus,
	useDeleteComment,
	useMarkCommentSpam,
} from "@features/comments/api/mutations";
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
	const { data, isLoading, refetch } = useAdminComments(listQuery);
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

	const columns = [
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
			className: "w-10",
		},
		{ key: "author", header: "作者", cell: (row: Comment) => row.author_name },
		{
			key: "content",
			header: "内容",
			cell: (row: Comment) => <p className="max-w-xs truncate text-sm">{row.body}</p>,
		},
		{
			key: "post",
			header: "文章",
			cell: (row: AdminComment) => <p className="max-w-xs truncate text-sm">{row.post_title}</p>,
		},
		{
			key: "status",
			header: "状态",
			cell: (row: Comment) => <StatusBadge status={row.status} kind="comment" />,
		},
		{
			key: "created",
			header: "时间",
			cell: (row: Comment) => new Date(row.created_at).toLocaleString("zh-CN"),
		},
		{
			key: "actions",
			header: "操作",
			cell: (row: Comment) => <CommentActionCell comment={row} onMutated={refetch} />,
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
				keyExtractor={(row) => row.id}
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

function CommentActionCell({ comment, onMutated }: { comment: Comment; onMutated: () => void }) {
	const approve = useApproveComment(comment.id);
	const markSpam = useMarkCommentSpam(comment.id);
	const deleteComment = useDeleteComment(comment.id);
	const [confirmOpen, setConfirmOpen] = useState(false);

	const handleApprove = () => {
		approve.mutate(undefined, {
			onSuccess: () => {
				toast.success("评论已通过");
				onMutated();
			},
			onError: (err) => toast.error(err.message),
		});
	};

	const handleSpam = () => {
		markSpam.mutate(undefined, {
			onSuccess: () => {
				toast.success("已标记为垃圾");
				onMutated();
			},
			onError: (err) => toast.error(err.message),
		});
	};

	const handleDelete = () => {
		deleteComment.mutate(undefined, {
			onSuccess: () => {
				toast.success("评论已删除");
				setConfirmOpen(false);
				onMutated();
			},
			onError: (err) => toast.error(err.message),
		});
	};

	return (
		<>
			<div className="flex items-center gap-2">
				{comment.status === "pending" && (
					<Button size="sm" onClick={handleApprove} disabled={approve.isPending}>
						通过
					</Button>
				)}
				{comment.status !== "spam" && (
					<Button variant="outline" size="sm" onClick={handleSpam} disabled={markSpam.isPending}>
						垃圾
					</Button>
				)}
				<Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
					删除
				</Button>
			</div>
			<ConfirmDialog
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				title="删除评论"
				description="确认删除这条评论？此操作不可撤销。"
				onConfirm={handleDelete}
			/>
		</>
	);
}
