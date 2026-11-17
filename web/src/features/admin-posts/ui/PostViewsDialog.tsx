import { usePagedQuery } from "@features/admin-shared/ui/data-table";
import { formatDateTime } from "@shared/lib/date";
import {
	DataTable,
	type DataTableColumn,
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@violet/ui";
import { usePostViews } from "../api/queries";
import type { AdminPostListItem, PostViewRecord } from "../model/types";

const columns: DataTableColumn<PostViewRecord>[] = [
	{
		key: "created_at",
		header: "访问时间",
		width: "180px",
		cell: (row) => formatDateTime(row.created_at),
	},
	{
		key: "ip_address",
		header: "IP",
		width: "180px",
		cell: (row) => row.ip_address || "未记录",
	},
	{
		key: "user_agent",
		header: "User-Agent",
		cell: (row) =>
			row.user_agent ? (
				<details className="min-w-0 max-w-96">
					<summary className="cursor-pointer truncate" aria-label="查看完整 User-Agent">
						{row.user_agent}
					</summary>
					<p className="mt-2 whitespace-pre-wrap wrap-anywhere">{row.user_agent}</p>
				</details>
			) : (
				"未记录"
			),
	},
];

/** 浏览记录弹窗使用文章 ID 隔离分页状态与查询缓存。 */
export interface PostViewsDialogProps {
	post: Pick<AdminPostListItem, "id" | "title" | "view_count">;
	onClose: () => void;
}

/** 展示实际事件记录及独立的累计浏览量口径。 */
export function PostViewsDialog({ post, onClose }: PostViewsDialogProps) {
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent size="xl" className="h-[80dvh]">
				<DialogHeader>
					<DialogTitle>浏览记录 · {post.title}</DialogTitle>
					<DialogDescription>
						累计浏览 {post.view_count}{" "}
						次；下方仅展示已保存的访问记录，记录总量可能与累计浏览次数不同。
					</DialogDescription>
				</DialogHeader>
				<DialogBody className="flex min-h-0 flex-1 flex-col">
					<PostViewsTable key={post.id} postId={post.id} />
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
}

function PostViewsTable({ postId }: { postId: string }) {
	const { data, isLoading, error, refetch, pagination } = usePagedQuery(usePostViews, { postId });
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			{data && !error ? (
				<p className="text-sm text-muted-foreground">
					可查询记录 {data.pagination.total ?? 0} 条
				</p>
			) : null}
			<DataTable
				data={data?.data ?? []}
				columns={columns}
				keyExtractor={(row) => row.id}
				pagination={pagination}
				loading={isLoading}
				error={error}
				onRetry={() => void refetch()}
				caption="文章浏览记录"
				emptyTitle="暂无浏览记录"
				emptyDescription="这篇文章尚无可查询的访问记录，不会根据累计次数补造历史记录。"
				errorTitle="浏览记录加载失败"
			/>
		</div>
	);
}
