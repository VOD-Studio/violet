/**
 * buildTweetCommentConfig - 推文评论的 shared 展示层适配配置
 *
 * 归一化 TweetComment → CommentDisplayItem，注入推文专属插槽：
 *   - renderBody：EmojiText 表情 + 图片网格（ImageGrid，与文章评论同款）
 *   - renderActions：统一多表情回应与删除按钮（作者本人 / tweet:delete-any）
 *   - renderReplyForm：TweetCommentForm（登录专用，富文本 + 图片在表单内部）
 *   - renderExpandedReplies：包装 useTweetReplies（展开时才挂载 → 懒加载，
 *     修复旧实现顶层评论挂载即拉回复的 N+1）
 *   - 作者徽章：comment.author.id === tweetAuthorId（后端无 is_author，前端推导）
 */

import type { TweetComment, TweetCommentPicture } from "@entities/tweet/model/types";
import { contentImageUrl, imageUrl } from "@shared/lib/image-url";
import {
	type CommentDisplayItem,
	type CommentSectionConfig,
	ExpandedReplies,
} from "@shared/ui/comment-section";
import { EmojiText } from "@shared/ui/emoji-text";
import { ImageGrid } from "@shared/ui/image-grid";
import { iconProps } from "@violet/ui";
import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTweetReplies } from "../api/queries";
import { TweetCommentForm } from "./TweetCommentForm";
import { TweetCommentReactionProvider, TweetCommentReactions } from "./TweetCommentReactions";

export interface BuildTweetCommentConfigArgs {
	/** 所属推文 id（回复 / 删除写操作 URL 需要） */
	tweetId: string;
	/** 推文作者 id（作者徽章判定：comment.author.id === tweetAuthorId） */
	tweetAuthorId?: string;
	/** 是否登录 */
	isLoggedIn: boolean;
	/** 当前登录用户 id（删除按钮「作者本人」判定） */
	currentUserId?: string;
	/** 是否持 tweet:delete-any 权限（可删任意评论） */
	canDeleteAny: boolean;
	/** 删除回调（乐观更新与回滚在 mutations 层） */
	onDelete: (commentId: string) => void;
	/** 删除请求进行中判定（禁用对应按钮） */
	isDeleting: (commentId: string) => boolean;
}

/**
 * 评论图片 → ImageGrid 入参：与文章评论同款缩略图策略
 * （单图 w=800 保比例，多图 w=400 保比例，点开预览才加载原图）。
 */
function toGridImages(pictures: TweetCommentPicture[]) {
	return pictures.map((p) => ({
		url: p.url,
		width: p.width > 0 ? p.width : undefined,
		height: p.height > 0 ? p.height : undefined,
		thumbnail:
			pictures.length === 1
				? contentImageUrl(p.url, { width: 800 })
				: imageUrl(p.url, { w: 400, format: "webp" }),
	}));
}

export function buildTweetCommentConfig({
	tweetId,
	tweetAuthorId,
	isLoggedIn,
	currentUserId,
	canDeleteAny,
	onDelete,
	isDeleting,
}: BuildTweetCommentConfigArgs): CommentSectionConfig<TweetComment> {
	const config: CommentSectionConfig<TweetComment> = {
		map: (c) => ({
			id: c.id,
			depth: c.depth,
			parentId: c.parent_id,
			authorName: c.author.username,
			authorAvatarUrl: c.author.avatar_url,
			authorProvider: c.author.provider,
			authorProfileUrl: c.author.profile_url,
			authorHref: `/users/${c.author.username}`,
			isAuthor: !!tweetAuthorId && c.author.id === tweetAuthorId,
			isPending: false,
			body: c.body,
			createdAt: c.created_at,
			// 回复数驱动「查看回复」toggle 显隐（0 回复不显示）
			repliesTotal: c.replies_count,
			raw: c,
		}),
		repliesMode: "toggle",
		renderBody: (item) => (
			<>
				<p className="whitespace-pre-wrap wrap-break-word text-sm text-foreground">
					<EmojiText text={item.body} emote={item.raw.emote} />
				</p>
				{item.raw.pictures && item.raw.pictures.length > 0 && (
					<div className="mt-2">
						<ImageGrid images={toGridImages(item.raw.pictures)} />
					</div>
				)}
			</>
		),
		renderActions: (item) => {
			const comment = item.raw;
			// 作者本人 或 持 tweet:delete-any 权限者可删（鉴权双重判定在后端应用层）
			const isAuthor = !!currentUserId && currentUserId === comment.author.id;
			const canDelete = !!currentUserId && (isAuthor || canDeleteAny);
			return (
				<>
					<TweetCommentReactions
						tweetId={tweetId}
						commentId={comment.id}
						isLoggedIn={isLoggedIn}
					/>
					{canDelete && (
						<button
							type="button"
							aria-label="删除评论"
							onClick={() => onDelete(comment.id)}
							disabled={isDeleting(comment.id)}
							className="inline-flex h-7 items-center text-xs text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						>
							<Trash2 {...iconProps(14)} />
						</button>
					)}
				</>
			);
		},
		renderReplyForm: (item, { onSuccess }) => (
			<TweetCommentForm
				tweetId={tweetId}
				parentId={item.id}
				compact
				isLoggedIn={isLoggedIn}
				onSuccess={(c) => onSuccess(c)}
			/>
		),
		renderExpandedReplies: ({
			topLevelId,
			excludeIds,
			knownReplies,
			isLoggedIn: li,
			onReplyAdded,
		}) => (
			<TweetExpandedReplies
				config={config}
				tweetId={tweetId}
				topLevelId={topLevelId}
				excludeIds={excludeIds}
				knownReplies={knownReplies}
				isLoggedIn={li}
				onReplyAdded={onReplyAdded}
			/>
		),
	};
	return config;
}

interface TweetExpandedRepliesProps {
	/** 所属推文 id(取回复列表的 URL 需要) */
	tweetId: string;
	/** 顶层评论 id(取其下的回复) */
	topLevelId: string;
	/** shared 层已渲染过的回复 id,拉回后过滤去重 */
	excludeIds: Set<string>;
	/** 本地已有的回复(无网络时兜底渲染) */
	knownReplies: CommentDisplayItem<TweetComment>[];
	/** 是否登录(透传 shared,控制回复表单显隐) */
	isLoggedIn: boolean;
	/** 新回复落地回调(写入 knownReplies 所在缓存) */
	onReplyAdded: (reply: CommentDisplayItem<TweetComment>) => void;
	/** shared 展示层配置 */
	config: CommentSectionConfig<TweetComment>;
}

/** 展开后的推文回复加载器:仅展开时挂载(懒加载),拍平 useTweetReplies 交 shared 渲染。 */
function TweetExpandedReplies({
	config,
	tweetId,
	topLevelId,
	excludeIds,
	knownReplies,
	isLoggedIn,
	onReplyAdded,
}: TweetExpandedRepliesProps) {
	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useTweetReplies(
		tweetId,
		topLevelId,
	);
	const replies = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);
	const commentIds = useMemo(
		() => [...replies.map((reply) => reply.id), ...knownReplies.map((reply) => reply.id)],
		[replies, knownReplies],
	);
	const newBatchStart = replies.length - (data?.pages.at(-1)?.data.length ?? 0);
	return (
		<TweetCommentReactionProvider tweetId={tweetId} commentIds={commentIds}>
			<ExpandedReplies
				topLevelId={topLevelId}
				replies={replies}
				newBatchStart={newBatchStart}
				hasNextPage={!!hasNextPage}
				fetchNextPage={fetchNextPage}
				isFetchingNextPage={isFetchingNextPage}
				isLoading={isLoading}
				excludeIds={excludeIds}
				knownReplies={knownReplies}
				config={config}
				isLoggedIn={isLoggedIn}
				onReplyAdded={onReplyAdded}
			/>
		</TweetCommentReactionProvider>
	);
}
