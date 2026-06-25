import { ConfirmDialog } from "@features/admin-shared/ui/ConfirmDialog";
import {
	useApproveComment,
	useDeleteComment,
	useMarkCommentSpam,
} from "@features/comments/api/mutations";
import type { Comment } from "@features/comments/model/types";
import { Button } from "@shared/ui/button";
import { useState } from "react";
import { toast } from "sonner";

interface CommentActionCellProps {
	comment: Comment;
	onMutated: () => void;
}

/**
 * CommentActionCell - 评论操作单元格
 *
 * 提供通过、标记垃圾、删除操作。
 */
export function CommentActionCell({ comment, onMutated }: CommentActionCellProps) {
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
