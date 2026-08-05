import { apiGet, apiGetPaged, apiPost } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type {
	BatchReactionResult,
	BatchReactionsQuery,
	BlockCount,
	Comment,
	CommentListQuery,
	Reaction,
	ReplyListQuery,
} from "../model/types";
import { commentKeys } from "./keys";

/**
 * fetchComments - 调后端 GET /posts/{postId}/comments 拉取文章评论
 *
 * 黑洞模式（PRD-0001）：后端按 cookie 里的 viewerUserID 判定——
 *   - 匿名 viewer（无会话）：返回空数组（看不到任何评论，含自己刚提交的）
 *   - 登录 viewer：返回 approved 联合自己的 pending（带「审批中」徽章）
 *
 * type query param 控制按 anchor 维度过滤（free / annotation / all），
 * 把自由评论与批注在接口层彻底分开：底部评论区用 free，批注角标层用 annotation。
 * 前端无需额外过滤，按返回结果直接渲染即可。
 */
export const fetchComments = async (
	postId: string,
	query: CommentListQuery = {},
): Promise<PagedResponse<Comment>> =>
	apiGetPaged<Comment>(`/posts/${postId}/comments`, { params: query });

/**
 * useComments - 文章评论列表 hook（支持 type 维度过滤）
 *
 * postId 为空时禁用查询（避免发 /posts//comments 这种空 id 请求）。
 * 文章详情页首帧 SSR/postId 尚未就绪时会被守卫拦下，postId 到位后自动启用。
 */
export const useComments = (postId: string, query: CommentListQuery = {}) =>
	useQuery({
		queryKey: commentKeys.list(postId, query),
		queryFn: () => fetchComments(postId, query),
		enabled: !!postId,
	});

/**
 * useAnnotationComments - 批注专用便捷 hook
 *
 * 固定 type='annotation'，调用方一眼看出意图是「拿批注，不是拿评论」。
 * 缓存键与 free/all 隔离（commentKeys.list 带 query 对象），互不污染。
 */
export const useAnnotationComments = (postId: string) =>
	useComments(postId, { type: "annotation" });

/**
 * fetchAnnotationSummary - 调 GET /posts/{postId}/annotations/summary 拉批注按块聚合计数
 *
 * summary 端点返回 { data: [{ block_id, count }] }，apiGet 解包 envelope 后直接拿 BlockCount[]。
 * 轻量数据（不含正文），用于角标渲染；点击角标后按 block_id 懒加载完整批注。
 */
export const fetchAnnotationSummary = async (postId: string): Promise<BlockCount[]> =>
	apiGet<BlockCount[]>(`/posts/${postId}/annotations/summary`);

/**
 * useAnnotationSummary - 批注按块聚合计数 hook
 *
 * postId 为空时禁用查询。
 */
export const useAnnotationSummary = (postId: string) =>
	useQuery({
		queryKey: commentKeys.annotationSummary(postId),
		queryFn: () => fetchAnnotationSummary(postId),
		enabled: !!postId,
	});

/**
 * useBlockAnnotations - 按 block_id 懒加载某块的完整批注
 *
 * 点击角标后调用，top_level + block_id 精确过滤（含 replies 预览 + replies_total）。
 * postId 或 blockId 为空时禁用查询。
 */
export const useBlockAnnotations = (postId: string, blockId: string) =>
	useQuery({
		queryKey: commentKeys.list(postId, {
			type: "annotation",
			block_id: blockId,
			top_level: true,
		}),
		queryFn: () =>
			fetchComments(postId, { type: "annotation", block_id: blockId, top_level: true }),
		enabled: !!postId && !!blockId,
	});

/**
 * fetchReplies - 调 GET /comments/{commentId}/replies 拉某顶层评论的回复
 *
 * 配合顶层评论列表的「按需拉回复」分页策略：列表首屏拿预览，
 * 点「查看全部 xx 条回复」走此接口翻页。黑洞模式同 useComments。
 */
export const fetchReplies = async (
	commentId: string,
	query: ReplyListQuery = {},
): Promise<PagedResponse<Comment>> =>
	apiGetPaged<Comment>(`/comments/${commentId}/replies`, { params: query });

/** useReplies - 某顶层评论的回复列表 hook（滚动加载 + sort 切换）。
 *  sort 变化时缓存键变化，自动重新查询。 */
export const useReplies = (commentId: string, query: ReplyListQuery = {}) =>
	useInfiniteQuery({
		queryKey: commentKeys.replyList(commentId, query),
		queryFn: ({ pageParam }) => fetchReplies(commentId, { ...query, page: pageParam }),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const totalPages = lastPage.pagination?.total_pages ?? 1;
			const currentPage = lastPage.pagination?.page ?? 1;
			return currentPage < totalPages ? currentPage + 1 : undefined;
		},
		enabled: !!commentId,
	});

/** fetchCommentReactions - GET /comments/{commentId}/reactions 评论反应列表 */
export const fetchCommentReactions = async (commentId: string): Promise<Reaction[]> =>
	apiGet<Reaction[]>(`/comments/${commentId}/reactions`);

/** useCommentReactions - 单条评论反应列表 hook */
export const useCommentReactions = (commentId: string, options: { enabled?: boolean } = {}) =>
	useQuery({
		queryKey: commentKeys.reactionList(commentId),
		queryFn: () => fetchCommentReactions(commentId),
		enabled: !!commentId && (options.enabled ?? true),
	});

/** fetchBatchReactions - POST /comments/reactions/batch 批量获取反应，避免 N+1 */
export const fetchBatchReactions = async (
	body: BatchReactionsQuery,
): Promise<BatchReactionResult[]> =>
	apiPost<BatchReactionResult[]>("/comments/reactions/batch", body);

/**
 * useBatchReactions - 批量获取多条评论的反应
 *
 * 列表场景下用 batch 端点一次拉取，避免每个 CommentItem 独立请求。
 * commentIds 为空时禁用查询。
 */
export const useBatchReactions = (commentIds: string[]) =>
	useQuery({
		queryKey: [...commentKeys.reactions(), "batch", commentIds],
		queryFn: () => fetchBatchReactions({ comment_ids: commentIds }),
		enabled: commentIds.length > 0,
		staleTime: 30 * 1000,
	});
