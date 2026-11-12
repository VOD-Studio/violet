/**
 * TweetCommentSection - 推文详情页评论区容器
 *
 * 与文章评论共用 shared/ui/comment-section 展示层，
 * 差异经适配配置注入（tweet-comment-config）：
 *   - 匿名可读评论（无黑洞），登录可发评论 / 回复
 *   - 回复区 toggle 模式（后端无 replies_total/预览，展开才懒加载）
 *   - 多表情回应与删除按钮（作者本人 / tweet:delete-any）经 renderActions 注入
 *
 * 顶层排序由后端处理，每页 10 条；每批已加载评论共用回应查询。
 */
import type { CommentSort } from "@entities/comment/model/types";
import { useMe } from "@features/auth/api/queries";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { CommentList, CommentSection as CommentSectionShell } from "@shared/ui/comment-section";
import { useMemo, useState } from "react";
import { useDeleteTweetComment } from "../api/mutations";
import { useTweetComments } from "../api/queries";
import { TweetCommentForm } from "./TweetCommentForm";
import { TweetCommentReactionProvider } from "./TweetCommentReactions";
import { buildTweetCommentConfig } from "./tweet-comment-config";

export interface TweetCommentSectionProps {
	/** 所属推文 id */
	tweetId: string;
	/** 推文作者 id（作者徽章判定：comment.author.id === tweetAuthorId） */
	tweetAuthorId?: string;
}

export function TweetCommentSection({ tweetId, tweetAuthorId }: TweetCommentSectionProps) {
	const [sort, setSort] = useState<CommentSort>("latest");
	const me = useMe();
	const isLoggedIn = !!me.data;
	const canDeleteAny = useHasPermission("tweet:delete-any");
	const deleteComment = useDeleteTweetComment(tweetId);

	const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useTweetComments(
		tweetId,
		sort,
	);

	const comments = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);
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
		<TweetCommentReactionProvider
			tweetId={tweetId}
			commentIds={comments.map((comment) => comment.id)}
		>
			<CommentSectionShell
				title="评论"
				count={total}
				sort={sort}
				onSortChange={setSort}
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
		</TweetCommentReactionProvider>
	);
}

export default TweetCommentSection;
