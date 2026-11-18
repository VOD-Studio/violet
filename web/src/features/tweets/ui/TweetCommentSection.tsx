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
import { avatarUrl } from "@shared/lib/image-url";
import { CommentList, CommentSection as CommentSectionShell } from "@shared/ui/comment-section";
import { Avatar, Button, Card } from "@violet/ui";
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
	/** 整条推文的评论总数，包含回复；分页总数只计算顶层。 */
	commentCount: number;
}

export function TweetCommentSection({
	tweetId,
	tweetAuthorId,
	commentCount,
}: TweetCommentSectionProps) {
	const [sort, setSort] = useState<CommentSort>("latest");
	const me = useMe();
	const isLoggedIn = !!me.data;
	const canDeleteAny = useHasPermission("tweet:delete-any");
	const deleteComment = useDeleteTweetComment(tweetId);

	const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
		useTweetComments(tweetId, sort);

	const comments = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);

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
		<div className="flex min-w-0 flex-col gap-8">
			<Card id="comments" className="scroll-mt-24">
				<div className="flex items-start gap-3">
					{me.data && (
						<Avatar
							name={me.data.username}
							src={avatarUrl(me.data.avatar_url, me.data.username)}
							alt=""
							size={40}
						/>
					)}
					<div className="min-w-0 flex-1">
						<TweetCommentForm tweetId={tweetId} isLoggedIn={isLoggedIn} />
					</div>
				</div>
			</Card>
			<TweetCommentReactionProvider
				tweetId={tweetId}
				commentIds={comments.map((comment) => comment.id)}
			>
				<CommentSectionShell
					title="评论"
					count={commentCount}
					sort={sort}
					onSortChange={setSort}
					form={null}
					isLoggedIn={isLoggedIn}
				>
					{isError && !data ? (
						<Card className="items-start">
							<p role="status">评论暂时加载失败</p>
							<Button variant="outline" onClick={() => void refetch()}>
								重试加载评论
							</Button>
						</Card>
					) : (
						<CommentList
							comments={comments}
							config={config}
							isLoggedIn={isLoggedIn}
							isLoading={isLoading}
							onLoadMore={hasNextPage ? fetchNextPage : undefined}
							isLoadingMore={isFetchingNextPage}
						/>
					)}
				</CommentSectionShell>
			</TweetCommentReactionProvider>
		</div>
	);
}

export default TweetCommentSection;
