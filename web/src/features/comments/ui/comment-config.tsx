/**
 * buildArticleCommentConfig - 文章评论的 shared 展示层适配配置
 *
 * 把后端 Comment 归一化为 CommentDisplayItem，注入文章专属插槽：
 *   - renderBody：EmojiText 表情 + 图片网格（ImageGrid）
 *   - renderActions：ReactionBar（评论反应）
 *   - renderReplyForm：CommentForm（匿名两步流 / 富文本在表单内部）
 *   - renderExpandedReplies：包装 useReplies（展开时才挂载 → 懒加载）
 */
import type { Comment } from "@entities/comment/model/types";
import { useReplies } from "@features/comments/api/queries";
import { contentImageUrl, imageUrl } from "@shared/lib/image-url";
import {
	type CommentDisplayItem,
	type CommentSectionConfig,
	ExpandedReplies,
} from "@shared/ui/comment-section";
import { EmojiText } from "@shared/ui/emoji-text";
import { ImageGrid } from "@shared/ui/image-grid";
import { CommentForm } from "./CommentForm";
import { ReactionBar } from "./ReactionBar";

type CommentPictures = NonNullable<Comment["pictures"]>;

/**
 * 评论图片 → ImageGrid 入参:格子用缩略图(点开预览才加载原图)。
 * 单图 w=800 保比例(GIF 由 contentImageUrl 剥参数保动画);
 * 多图 w=400 保比例——格子 bg-cover 裁方显示,且预览占位/比例探测
 * 要求缩略图与原图同比例(旧 thumb=400x400 裁方会导致占位拉伸)。
 */
export function toGridImages(pictures: CommentPictures) {
	return pictures.map((p) => ({
		url: p.url,
		thumbnail:
			pictures.length === 1
				? contentImageUrl(p.url, { width: 800 })
				: imageUrl(p.url, { w: 400, format: "webp" }),
	}));
}

export interface BuildArticleCommentConfigArgs {
	/** 文章 id（回复表单提交用） */
	postId: string;
	/** 是否登录（决定反应条可用性与回复表单形态） */
	isLoggedIn: boolean;
}

export function buildArticleCommentConfig({
	postId,
	isLoggedIn,
}: BuildArticleCommentConfigArgs): CommentSectionConfig<Comment> {
	const config: CommentSectionConfig<Comment> = {
		map: (c) => ({
			id: c.id,
			depth: c.depth,
			parentId: c.parent_id,
			replyToName: c.reply_to_name,
			authorName: c.author_name,
			authorAvatarUrl: c.avatar_url,
			isAuthor: c.is_author,
			isPending: c.status === "pending",
			body: c.body,
			createdAt: c.created_at,
			repliesTotal: c.replies_total,
			repliesPreview: c.replies,
			tone: c.is_author
				? "author"
				: c.replies && c.replies.length > 0
					? "discussion"
					: "default",
			raw: c,
		}),
		repliesMode: "preview",
		renderBody: (item) => (
			<>
				<p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground">
					<EmojiText text={item.body} emote={item.raw.emote} />
				</p>
				{item.raw.pictures && item.raw.pictures.length > 0 && (
					<div className="mt-2">
						<ImageGrid images={toGridImages(item.raw.pictures)} />
					</div>
				)}
			</>
		),
		renderActions: (item) => <ReactionBar commentId={item.id} isLoggedIn={isLoggedIn} />,
		renderReplyForm: (item, { onSuccess }) => (
			<CommentForm
				postId={postId}
				parentId={item.id}
				compact
				isLoggedIn={isLoggedIn}
				onSuccess={onSuccess}
			/>
		),
		renderExpandedReplies: ({
			topLevelId,
			excludeIds,
			knownReplies,
			isLoggedIn: li,
			onReplyAdded,
		}) => (
			<ArticleExpandedReplies
				config={config}
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

/**
 * ArticleExpandedReplies - 展开后的回复加载器（文章：GET /comments/{id}/replies）
 *
 * 仅展开时挂载（懒加载），把 useReplies 结果拍平传给 shared ExpandedReplies 渲染。
 */
function ArticleExpandedReplies({
	config,
	topLevelId,
	excludeIds,
	knownReplies,
	isLoggedIn,
	onReplyAdded,
}: {
	config: CommentSectionConfig<Comment>;
	topLevelId: string;
	excludeIds: Set<string>;
	knownReplies: CommentDisplayItem<Comment>[];
	isLoggedIn: boolean;
	onReplyAdded: (reply: CommentDisplayItem<Comment>) => void;
}) {
	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useReplies(
		topLevelId,
		{ limit: 10 },
	);
	return (
		<ExpandedReplies
			topLevelId={topLevelId}
			replies={data?.pages.flatMap((p) => p.data) ?? []}
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
	);
}
