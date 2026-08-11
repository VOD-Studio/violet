/**
 * CommentSection - 文章底部自由评论区容器
 *
 * PRD-0001 双轨制 + 黑洞模式：
 *   - 登录态：渲染 CommentForm（直发）+ CommentList（看到 approved ∪ 自己 pending）
 *   - 匿名态：渲染「登录后查看 N 条评论」引导 + CommentForm（两步流）；
 *     不渲染评论列表（后端黑洞模式返回空，前端不展示空 Empty）
 *
 * 展示层复用 shared/ui/comment-section（文章与推文评论共用），
 * 本文件只剩数据获取（useInfiniteQuery）+ 表单 + 适配配置。
 * 数据流：useInfiniteQuery 滚动加载顶层评论（type=free + top_level=true），
 * 每页 20 条。回复走 useReplies 按需拉（comment-config 内懒加载）。
 */
import { useMe } from "@features/auth/api/queries";
import { fetchComments } from "@features/comments/api/queries";
import { useLoginDialogStore } from "@shared/api/login-dialog-store";
import { Button } from "@shared/ui/base/button";
import { CommentList, CommentSection as CommentSectionShell } from "@shared/ui/comment-section";
import { useInfiniteQuery } from "@tanstack/react-query";
import { LogIn } from "lucide-react";
import { useMemo } from "react";
import { CommentForm } from "./CommentForm";
import { buildArticleCommentConfig } from "./comment-config";
import { ReactionProvider } from "./ReactionProvider";

/** 顶层评论每页条数（滚动加载） */
const TOP_LEVEL_PAGE_SIZE = 20;

export interface CommentSectionProps {
	/** 文章 id */
	postId: string;
}

export function CommentSection({ postId }: CommentSectionProps) {
	const me = useMe();
	const isLoggedIn = !!me.data;
	const openLogin = useLoginDialogStore((s) => s.open);

	// 滚动加载顶层评论：type=free（仅自由评论）+ top_level=true（仅 depth=0）。
	// 回复走 useReplies 按需拉，避免 1000×1000 量级一次性拉崩。
	const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
		queryKey: ["comments", "list", postId, { type: "free", top_level: true }],
		queryFn: ({ pageParam }) =>
			fetchComments(postId, {
				type: "free",
				top_level: true,
				page: pageParam,
				limit: TOP_LEVEL_PAGE_SIZE,
			}),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const totalPages = lastPage.pagination?.total_pages ?? 1;
			const currentPage = lastPage.pagination?.page ?? 1;
			return currentPage < totalPages ? currentPage + 1 : undefined;
		},
		enabled: !!postId && isLoggedIn,
	});

	// 把所有分页的 data 拼成扁平列表
	const comments = data?.pages.flatMap((p) => p.data) ?? [];
	const total = data?.pages[0]?.pagination?.total ?? 0;
	const config = useMemo(
		() => buildArticleCommentConfig({ postId, isLoggedIn }),
		[postId, isLoggedIn],
	);
	const commentIds = useMemo(() => comments.map((c) => c.id), [comments]);

	return (
		<CommentSectionShell
			title={`评论 (${total})`}
			form={<CommentForm postId={postId} isLoggedIn={isLoggedIn} />}
			isLoggedIn={isLoggedIn}
			blackhole
			banner={
				<div className="mb-6 flex items-center justify-between rounded-lg border border-edge-hairline bg-muted/30 px-4 py-3">
					<p className="text-sm text-muted-foreground">登录后查看评论并参与完整讨论</p>
					<Button variant="outline" size="sm" onClick={() => openLogin()}>
						<LogIn className="size-4" />
						登录
					</Button>
				</div>
			}
		>
			<ReactionProvider commentIds={commentIds}>
				<CommentList
					comments={comments}
					config={config}
					isLoggedIn={isLoggedIn}
					isLoading={isLoading}
					onLoadMore={hasNextPage ? fetchNextPage : undefined}
					isLoadingMore={isFetchingNextPage}
				/>
			</ReactionProvider>
		</CommentSectionShell>
	);
}

export default CommentSection;
