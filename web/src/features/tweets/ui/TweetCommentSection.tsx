/**
 * TweetCommentSection - 推文详情页评论区容器
 *
 * 与文章评论共用 shared/ui/comment-section 展示层（SpotlightCard / 头像兜底 / 作者徽章），
 * 差异经适配配置注入（tweet-comment-config）：
 *   - 匿名可读评论（无黑洞），登录可发评论 / 回复
 *   - 回复区 toggle 模式（后端无 replies_total/预览，展开才懒加载）
 *   - 删除按钮（作者本人 / tweet:delete-any）经 renderActions 注入
 *
 * 数据流：useTweetComments 滚动加载顶层评论（page/limit，最新在前），每页 10 条。
 */
import { useMe } from "@features/auth/api/queries";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { CommentList, CommentSection as CommentSectionShell } from "@shared/ui/comment-section";
import { useMemo } from "react";
import { useDeleteTweetComment } from "../api/mutations";
import { useTweetComments } from "../api/queries";
import { TweetCommentForm } from "./TweetCommentForm";
import { buildTweetCommentConfig } from "./tweet-comment-config";

export interface TweetCommentSectionProps {
	/** 所属推文 id */
	tweetId: string;
	/** 推文作者 id（作者徽章判定：comment.author.id === tweetAuthorId） */
	tweetAuthorId?: string;
}

export function TweetCommentSection({ tweetId, tweetAuthorId }: TweetCommentSectionProps) {
	const me = useMe();
	const isLoggedIn = !!me.data;
	const canDeleteAny = useHasPermission("tweet:delete-any");
	const deleteComment = useDeleteTweetComment(tweetId);

	const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
		useTweetComments(tweetId);

	const comments = data?.pages.flatMap((p) => p.data) ?? [];
	const total = data?.pages[0]?.pagination?.total ?? 0;

	const config = useMemo(
		() =>
			buildTweetCommentConfig({
				tweetId,
				tweetAuthorId,
				isLoggedIn,
				currentUserId: me.data?.id,
				canDeleteAny,
				onDelete: (commentId) => deleteComment.mutate(commentId),
				isDeleting: (commentId) =>
					deleteComment.isPending && deleteComment.variables === commentId,
			}),
		[tweetId, tweetAuthorId, isLoggedIn, me.data?.id, canDeleteAny, deleteComment],
	);

	return (
		<CommentSectionShell
			title={`评论 ${total > 0 ? total : ""}`}
			form={<TweetCommentForm tweetId={tweetId} isLoggedIn={isLoggedIn} />}
			isLoggedIn={isLoggedIn}
		>
			<CommentList
				comments={comments}
				config={config}
				isLoggedIn={isLoggedIn}
				isLoading={isLoading}
				onLoadMore={hasNextPage ? fetchNextPage : undefined}
				isLoadingMore={isFetchingNextPage}
			/>
		</CommentSectionShell>
	);
}

export default TweetCommentSection;
