import { PostActionCell } from "@features/admin-posts/ui/PostActionCell";
import { DataTable, type DataTableColumn } from "@features/admin-shared/ui/DataTable";
import { PageHeader } from "@features/admin-shared/ui/PageHeader";
import { Pagination } from "@features/admin-shared/ui/Pagination";
import { StatusBadge } from "@features/admin-shared/ui/StatusBadge";
import { useAdminPosts } from "@features/posts/api/queries";
import type { AdminPost } from "@features/posts/model/types";
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

	const { data, isLoading, error, refetch } = useAdminPosts(listQuery);
	const posts = data?.data ?? [];
	const pagination = data?.pagination;

	const columns: DataTableColumn<AdminPost>[] = [
		{ key: "title", header: "标题", accessorKey: "title" },
		{ key: "slug", header: "Slug", accessorKey: "slug" },
		{
			key: "status",
			header: "状态",
			cell: (row: AdminPost) => <StatusBadge status={row.status} kind="post" />,
			width: "100px",
			align: "center",
		},
		{
			key: "views",
			header: "浏览量",
			accessorKey: "view_count",
			width: "90px",
			align: "right",
		},
		{
			key: "published",
			header: "发布时间",
			accessorKey: "published_at",
			cell: (row: AdminPost) =>
				row.published_at ? new Date(row.published_at).toLocaleDateString("zh-CN") : "—",
			width: "120px",
		},
		{
			key: "actions",
			header: "操作",
			cell: (row: AdminPost) => <PostActionCell post={row} onMutated={refetch} />,
			width: "140px",
			sticky: "right",
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
				error={error}
				onRetry={refetch}
				keyExtractor={(row) => row.id}
				stickyHeader
				maxHeight="55vh"
				density="compact"
				caption="文章列表"
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
