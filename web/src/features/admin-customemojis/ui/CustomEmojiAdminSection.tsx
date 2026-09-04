import {
	useAdminCustomEmojis,
	useAdminDeleteCustomEmoji,
} from "@features/admin-customemojis/api/queries";
import type { AdminCustomEmoji } from "@features/admin-customemojis/model/types";
import type { DataTableColumn } from "@features/admin-shared/ui/data-table";
import { DataTable, usePagedQuery } from "@features/admin-shared/ui/data-table";
import { AvatarGroup } from "@shared/ui/avatar-group/AvatarGroup";
import { Button } from "@shared/ui/base/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@shared/ui/base/tooltip";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { SearchInput } from "@shared/ui/search-input";
import { Trash2 } from "lucide-react";
import { useState } from "react";

/**
 * 用户自定义表情管理表格（/admin/emojis「用户表情」tab）。
 *
 * 服务端分页 + 关键词搜索（表情名/上传者）；下架复用用户侧删除端点，
 * 应用层按 owner 或 customemoji:manage 双轨鉴权。
 */
export function CustomEmojiAdminSection() {
	const [keyword, setKeyword] = useState("");
	const { data, isLoading, error, refetch, pagination, setPage } = usePagedQuery(
		useAdminCustomEmojis,
		{ keyword: keyword || undefined },
	);
	const deleteMut = useAdminDeleteCustomEmoji();
	const [deleting, setDeleting] = useState<AdminCustomEmoji | null>(null);

	const columns: DataTableColumn<AdminCustomEmoji>[] = [
		{
			key: "emoji",
			header: "表情",
			hideable: false,
			ellipsis: true,
			cell: (row) => (
				<div className="flex min-w-0 items-center gap-2">
					<img
						src={row.url}
						alt={row.name}
						className="size-8 shrink-0 rounded object-contain"
					/>
					<span className="truncate font-medium">{row.name}</span>
				</div>
			),
		},
		{
			key: "owner",
			header: "上传者",
			width: "200px",
			ellipsis: true,
			cell: (row) => (
				<div className="flex min-w-0 items-center gap-2">
					<AvatarGroup
						users={[
							{
								username: row.owner.username,
								avatar_url: row.owner.avatar_url,
							},
						]}
						size="sm"
					/>
					<span className="truncate">{row.owner.display_name || row.owner.username}</span>
				</div>
			),
		},
		{
			key: "created_at",
			header: "上传时间",
			width: "160px",
			cell: (row) => new Date(row.created_at).toLocaleString("zh-CN"),
		},
		{
			key: "actions",
			header: "操作",
			hideable: false,
			sticky: "right",
			width: "72px",
			align: "center",
			cell: (row) => (
				<Tooltip>
					<TooltipTrigger asChild>
						<span>
							<Button
								variant="ghost"
								size="icon-sm"
								className="text-destructive hover:bg-destructive/10 hover:text-destructive"
								onClick={() => setDeleting(row)}
								aria-label={`下架表情 ${row.name}`}
							>
								<Trash2 className="size-3.5" />
							</Button>
						</span>
					</TooltipTrigger>
					<TooltipContent>下架表情</TooltipContent>
				</Tooltip>
			),
		},
	];

	return (
		<TooltipProvider>
			<DataTable
				columns={columns}
				data={data?.data ?? []}
				keyExtractor={(row) => row.id}
				pagination={pagination}
				loading={isLoading}
				error={error}
				onRetry={refetch}
				filtered={!!keyword}
				emptyTitle="NO CUSTOM EMOJIS"
				emptyDescription="还没有用户上传自定义表情"
				toolbar={
					<SearchInput
						className="min-w-50 max-w-100"
						placeholder="搜索表情名或上传者..."
						defaultValue=""
						onSearch={(v) => {
							setKeyword(v);
							setPage(1);
						}}
					/>
				}
			/>

			<ConfirmDialog
				open={!!deleting}
				onOpenChange={(open) => {
					if (!open) setDeleting(null);
				}}
				title="下架自定义表情"
				description={`确定下架表情「${deleting?.name ?? ""}」（上传者 ${deleting?.owner.display_name || deleting?.owner.username || ""}）？下架后所有引用该表情的消息与评论将降级为占位文本，收藏者同步失效。`}
				confirmLabel="下架"
				loading={deleteMut.isPending}
				onConfirm={() => {
					if (!deleting) return;
					deleteMut.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
				}}
			/>
		</TooltipProvider>
	);
}
