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
import { InlineLogin } from "@features/auth/ui/InlineLogin";
import { fetchComments } from "@features/comments/api/queries";
import { CommentList, CommentSection as CommentSectionShell } from "@shared/ui/comment-section";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Button, GithubIcon, GoogleIcon } from "@violet/ui";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
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
			title="评论"
			count={isLoggedIn ? total : undefined}
			form={
				isLoggedIn ? (
					<CommentForm postId={postId} isLoggedIn />
				) : (
					<AnonymousComposer postId={postId} />
				)
			}
			isLoggedIn={isLoggedIn}
			blackhole
			banner={<JoinDiscussionCard />}
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

/** 未登录引导：登录区就地展开，不弹窗；登录成功后 me 查询刷新，评论区自动切换为已登录视图 */
function JoinDiscussionCard() {
	const [open, setOpen] = useState(false);
	return (
		<div className="mb-4 rounded-2xl bg-primary/6 px-5 py-4">
			<div className="flex items-center gap-4">
				<div className="flex shrink-0 -space-x-2" aria-hidden>
					<span className="flex size-9 items-center justify-center rounded-full bg-background ring-2 ring-primary/6">
						<GithubIcon className="size-4" />
					</span>
					<span className="flex size-9 items-center justify-center rounded-full bg-background ring-2 ring-primary/6">
						<GoogleIcon className="size-4" />
					</span>
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-sm font-medium text-foreground">加入讨论</p>
					<p className="text-xs text-muted-foreground">
						登录后可查看全部评论，并参与完整讨论
					</p>
				</div>
				{!open && (
					<Button size="sm" onClick={() => setOpen(true)}>
						登录
					</Button>
				)}
			</div>
			{open && (
				<InlineLogin
					className="annotation-pop mt-4 bg-background/60"
					onSuccess={() => setOpen(false)}
				/>
			)}
		</div>
	);
}

/** 匿名留言：默认收起，展开后才出现昵称、邮箱与验证码，避免登录引导旁堆一屏表单 */
function AnonymousComposer({ postId }: { postId: string }) {
	const [open, setOpen] = useState(false);
	return (
		<div>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				不想登录？匿名留言
				<ChevronDown
					className={`size-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
				/>
			</button>
			<div
				className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
			>
				{/* -m-1 p-1：折叠需要 overflow-hidden，给聚焦环留 4px 外扩空间，否则输入框的光环会被裁掉 */}
				<div className="-m-1 overflow-hidden p-1">
					<div className="pt-3">
						<CommentForm postId={postId} isLoggedIn={false} />
					</div>
				</div>
			</div>
		</div>
	);
}

export default CommentSection;
