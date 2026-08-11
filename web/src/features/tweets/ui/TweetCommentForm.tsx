/**
 * TweetCommentForm - 推文评论 / 回复输入框（登录态）
 *
 * 与文章评论（features/comments）交互同构：复用 RichCommentInput
 * （contentEditable 输入 + emoji 选择器 + 图片分块上传，≤10 张），
 * 但更简单：仅登录可评论（无匿名两步流）、即发即出（无审核）。
 *
 * 两种形态：
 *   - 顶级评论（compact=false）：详情页评论区顶部，匿名态渲染「登录后评论」引导
 *   - 回复（compact=true）：TweetCommentItem 内联展开，仅登录态出现（回复按钮仅登录可见）
 */

import type { TweetComment } from "@entities/tweet/model/types";
import { type PictureInput, RichCommentInput } from "@features/comments/ui/RichCommentInput";
import { ApiError } from "@shared/api/error";
import { Button } from "@shared/ui/base/button";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, LogIn, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCreateTweetComment } from "../api/mutations";
import { type CreateTweetCommentInput, MAX_TWEET_COMMENT_LENGTH } from "../model/types";

export interface TweetCommentFormProps {
	/** 所属推文 id */
	tweetId: string;
	/** 父评论 id（回复模式）；顶级评论省略 */
	parentId?: string;
	/** 是否登录（决定渲染输入框还是登录引导） */
	isLoggedIn: boolean;
	/** 紧凑模式（回复框，无标题）；默认 false（顶级评论） */
	compact?: boolean;
	/** 提交成功回调，参数为后端返回的新评论对象 */
	onSuccess?: (comment: TweetComment) => void;
}

export function TweetCommentForm({
	tweetId,
	parentId,
	isLoggedIn,
	compact = false,
	onSuccess,
}: TweetCommentFormProps) {
	const navigate = useNavigate();
	const createComment = useCreateTweetComment(tweetId);
	const [body, setBody] = useState("");
	const [pictures, setPictures] = useState<PictureInput[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const [resetNonce, setResetNonce] = useState(0);

	// rune 计数（按 Unicode 码点，对齐后端 utf8.RuneCountInString）
	const overLimit = [...body].length > MAX_TWEET_COMMENT_LENGTH;

	// 匿名态：顶级评论显示登录引导，回复框（compact）理论上不会匿名出现
	if (!isLoggedIn) {
		if (compact) return null;
		return (
			<button
				type="button"
				onClick={() => navigate({ to: "/login" })}
				className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-edge-hairline py-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			>
				<LogIn className="size-4" />
				登录后发表评论
			</button>
		);
	}

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (overLimit) {
			toast.error(`评论不能超过 ${MAX_TWEET_COMMENT_LENGTH} 字`);
			return;
		}
		if (!body.trim() && pictures.length === 0) {
			toast.error("说点什么吧");
			return;
		}
		const payload: CreateTweetCommentInput = { body: body.trim(), parent_id: parentId };
		if (pictures.length > 0) {
			payload.pictures = pictures;
		}
		createComment.mutate(payload, {
			onSuccess: (comment) => {
				setBody("");
				setPictures([]);
				setResetNonce((n) => n + 1);
				onSuccess?.(comment);
			},
			onError: (err) => toastError(err, "评论失败"),
		});
	};

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-2">
			<RichCommentInput
				value={body}
				onChange={setBody}
				compact={compact}
				disabled={createComment.isPending}
				enableEmoji
				enableImage
				maxImages={10}
				resetNonce={resetNonce}
				onImagesChange={setPictures}
				onUploadingChange={setIsUploading}
				placeholder={compact ? "写下你的回复…" : "写下你的评论…"}
				toolbarEnd={
					<Button
						type="submit"
						size="sm"
						disabled={createComment.isPending || isUploading || overLimit}
					>
						{createComment.isPending ? (
							<Loader2 className="size-3.5 animate-spin" />
						) : (
							<Send className="size-3.5" />
						)}
						{compact ? "回复" : "评论"}
					</Button>
				}
			/>
		</form>
	);
}

export default TweetCommentForm;

/** 错误 → toast：把 ApiError 的 message 暴露给用户 */
function toastError(err: unknown, fallback: string) {
	toast.error(err instanceof ApiError ? err.message : fallback);
}
