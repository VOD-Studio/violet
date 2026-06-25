import { ConfirmDialog } from "@features/admin-shared/ui/ConfirmDialog";
import { useDeletePost, useUpdatePostStatus } from "@features/posts/api/mutations";
import type { AdminPost } from "@features/posts/model/types";
import { Button } from "@shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { useState } from "react";
import { toast } from "sonner";

interface PostActionCellProps {
	post: AdminPost;
	onMutated: () => void;
}

/**
 * PostActionCell - 文章操作单元格
 *
 * 提供状态切换与删除操作。
 */
export function PostActionCell({ post, onMutated }: PostActionCellProps) {
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
