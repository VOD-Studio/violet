import { ConfirmDialog } from "@features/admin-shared/ui/ConfirmDialog";
import { DataTable } from "@features/admin-shared/ui/DataTable";
import { PageHeader } from "@features/admin-shared/ui/PageHeader";
import { Pagination } from "@features/admin-shared/ui/Pagination";
import { StatusBadge } from "@features/admin-shared/ui/StatusBadge";
import { useDeletePost, useUpdatePostStatus } from "@features/posts/api/mutations";
import { useAdminPosts } from "@features/posts/api/queries";
import type { AdminPost } from "@features/posts/model/types";
import { Button } from "@shared/ui/button";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * /admin/posts - 文章管理
 */
export const Route = createFileRoute("/admin/posts")({
	component: PostsPage,
});

const STATUSES = [
	{ value: "all", label: "全部状态" },
	{ value: "draft", label: "草稿" },
	{ value: "published", label: "已发布" },
	{ value: "archived", label: "已归档" },
];

function PostsPage() {
	const [query, setQuery] = useState({ page: 1, limit: 10 });
	const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published" | "archived">(
		"all",
	);

	const listQuery = useMemo(
		() => ({
			...query,
			status: statusFilter === "all" ? undefined : statusFilter,
		}),
		[query, statusFilter],
	);

	const { data, isLoading, refetch } = useAdminPosts(listQuery);
	const posts = data?.data ?? [];
	const pagination = data?.pagination;

	const columns = [
		{ key: "title", header: "标题", cell: (row: AdminPost) => row.title },
		{ key: "slug", header: "Slug", cell: (row: AdminPost) => row.slug },
		{
			key: "status",
			header: "状态",
			cell: (row: AdminPost) => <StatusBadge status={row.status} kind="post" />,
		},
		{
			key: "views",
			header: "浏览量",
			cell: (row: AdminPost) => row.view_count,
		},
		{
			key: "published",
			header: "发布时间",
			cell: (row: AdminPost) =>
				row.published_at ? new Date(row.published_at).toLocaleDateString("zh-CN") : "—",
		},
		{
			key: "actions",
			header: "操作",
			cell: (row: AdminPost) => <PostActionCell post={row} onMutated={refetch} />,
		},
	];

	return (
		<div>
			<PageHeader
				title="文章管理"
				description="管理博客文章状态与生命周期"
				action={{ label: "新建文章", onClick: () => toast.info("文章编辑器即将上线") }}
			/>

			<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
				<div className="w-full space-y-1 sm:w-48">
					<Label className="text-xs">状态</Label>
					<Select
						value={statusFilter}
						onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{STATUSES.map((s) => (
								<SelectItem key={s.value} value={s.value}>
									{s.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			<DataTable
				columns={columns}
				data={posts}
				loading={isLoading}
				keyExtractor={(row) => row.id}
				emptyTitle="NO_POSTS"
				emptyDescription="没有找到文章"
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

function PostActionCell({ post, onMutated }: { post: AdminPost; onMutated: () => void }) {
	const updateStatus = useUpdatePostStatus(post.id);
	const deletePost = useDeletePost(post.id);
	const [confirmOpen, setConfirmOpen] = useState(false);

	const handleStatus = (status: "draft" | "published" | "archived") => {
		updateStatus.mutate(
			{ status },
			{
				onSuccess: () => {
					toast.success("文章状态已更新");
					onMutated();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	const handleDelete = () => {
		deletePost.mutate(undefined, {
			onSuccess: () => {
				toast.success("文章已删除");
				setConfirmOpen(false);
				onMutated();
			},
			onError: (err) => toast.error(err.message),
		});
	};

	return (
		<>
			<div className="flex items-center gap-2">
				<Select
					value={post.status}
					onValueChange={(v) => handleStatus(v as "draft" | "published" | "archived")}
				>
					<SelectTrigger className="h-8 w-28">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="draft">草稿</SelectItem>
						<SelectItem value="published">发布</SelectItem>
						<SelectItem value="archived">归档</SelectItem>
					</SelectContent>
				</Select>
				<Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
					删除
				</Button>
			</div>
			<ConfirmDialog
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				title="删除文章"
				description={`确认删除文章 "${post.title}"？此操作不可撤销。`}
				onConfirm={handleDelete}
			/>
		</>
	);
}
