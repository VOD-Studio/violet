/**
 * 站点回复会话编排；视觉、原生语义和表单焦点由 SDK 承担。
 * 正文、身份与请求通过 feature 插槽注入，内联提交的回复留在当前会话中。
 */
import { type CommentStatus, CommentItem as CommentView } from "@violet/ui";
import { useState } from "react";
import { CommentAuthor, CommentAvatar, formatCommentTime } from "./CommentPresentation";
import { CommentRepliesBlock } from "./CommentRepliesBlock";
import type {
	CommentDisplayItem,
	CommentRaw,
	CommentRepliesMode,
	CommentSectionConfig,
} from "./types";

export interface CommentItemProps<T extends CommentRaw> {
	/** 当前评论（顶层 depth=0 或回复 depth=1） */
	item: CommentDisplayItem<T>;
	/** 缩进层级：顶级为 0，回复为 1（两层扁平，不深嵌套） */
	level: number;
	/** 是否登录（决定是否显示回复按钮） */
	isLoggedIn: boolean;
	/** feature 适配配置 */
	config: CommentSectionConfig<T>;
	/** 回复提交回调（level=1 时由父级传入，将新回复冒泡到顶层 pendingReplies） */
	onReplyAdded?: (reply: CommentDisplayItem<T>) => void;
	/**
	 * 展开列表的错峰等待，单位毫秒；减弱动态下由 SDK 忽略。
	 *
	 * @default 0
	 */
	enterDelay?: number;
}

/**
 * 回复区是否需要渲染。
 *
 * @remarks toggle（推文）下 `repliesTotal` 未知也渲染（「查看回复」展开才拉取）；
 * preview（文章）需总数或预览任一非空。`repliesTotal` 为 0 且无 pending 时
 * 不渲染，避免空回复的「查看回复」误导。
 *
 * @param item - 顶层评论（读 `repliesTotal` / `repliesPreview`）
 * @param mode - 回复区模式
 * @param pendingCount - 刚内联提交、尚未进预览的回复条数；>0 时强制渲染
 * @returns 是否渲染 {@link CommentRepliesBlock}
 */
export function shouldRenderRepliesBlock(
	item: Pick<CommentDisplayItem, "repliesTotal" | "repliesPreview">,
	mode: CommentRepliesMode,
	pendingCount: number,
): boolean {
	if (pendingCount > 0) return true;
	if (mode === "toggle") {
		return item.repliesTotal === undefined || item.repliesTotal > 0;
	}
	return (item.repliesTotal ?? 0) > 0 || (item.repliesPreview?.length ?? 0) > 0;
}

export function CommentItem<T extends CommentRaw>({
	item,
	level,
	isLoggedIn,
	config,
	onReplyAdded,
	enterDelay,
}: CommentItemProps<T>) {
	const [replying, setReplying] = useState(false);
	/** 顶层评论下内联提交的回复（立即显示，无需展开拉取） */
	const [pendingReplies, setPendingReplies] = useState<CommentDisplayItem<T>[]>([]);

	const handleReplySuccess = (raw: T) => {
		const reply = config.map(raw);
		if (level === 0) {
			setPendingReplies((prev) => [...prev, reply]);
		} else {
			onReplyAdded?.(reply);
		}
		setReplying(false);
	};

	let status: CommentStatus = "visible";
	if (item.isDeleted) {
		status = "deleted";
	} else if (item.isPending) {
		status = "pending";
	}
	const size = level === 0 ? "md" : "sm";
	const canReply = isLoggedIn && !item.isDeleted;
	const showReplies =
		level === 0 && shouldRenderRepliesBlock(item, config.repliesMode, pendingReplies.length);

	return (
		<CommentView
			author={config.renderAuthorName?.(item) ?? <CommentAuthor item={item} />}
			avatar={config.renderAvatar?.(item, { size }) ?? <CommentAvatar item={item} />}
			dateTime={item.createdAt}
			time={formatCommentTime(item.createdAt)}
			replyTo={item.replyToName}
			badges={config.renderMetaBadges?.(item)}
			isAuthor={item.isAuthor}
			reply={level > 0}
			status={status}
			actions={config.renderActions?.(item)}
			onReply={canReply ? () => setReplying((value) => !value) : undefined}
			enterDelay={enterDelay}
			replyForm={
				replying
					? config.renderReplyForm(item, { onSuccess: handleReplySuccess })
					: undefined
			}
			replies={
				showReplies ? (
					<CommentRepliesBlock
						comment={item}
						isLoggedIn={isLoggedIn}
						config={config}
						pendingReplies={pendingReplies}
						onReplyAdded={(reply) =>
							setPendingReplies((previous) => [...previous, reply])
						}
					/>
				) : undefined
			}
		>
			{config.renderBody ? config.renderBody(item) : item.body}
		</CommentView>
	);
}

export default CommentItem;
