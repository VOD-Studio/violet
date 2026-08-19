/**
 * CommentItem - 单条评论卡片（两层扁平回复）
 *
 * 文章评论与推文评论共用：SpotlightCard + severity 色条 + CommentMeta + 正文插槽 +
 * 操作插槽 + 内联回复表单插槽。深度 1 的回复不再嵌套回复区（两层扁平）。
 *
 * feature 差异经 CommentSectionConfig 注入（正文 / 操作 / 回复表单是插槽），
 * 能力开关走 CommentDisplayItem 字段（isAuthor / isPending / repliesTotal / repliesPreview）。
 */
import { SpotlightCard } from "@shared/vendor/react-bits/SpotlightCard";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { CommentMeta } from "./CommentMeta";
import { CommentRepliesBlock } from "./CommentRepliesBlock";
import { getCommentToneCfg } from "./tone";
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
}: CommentItemProps<T>) {
	const tone = getCommentToneCfg(item.tone ?? "default");
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

	return (
		<div>
			<SpotlightCard className="flex gap-3 p-4">
				<div className={`w-1 shrink-0 rounded-full ${tone.bar}`} aria-hidden />

				<div className="min-w-0 flex-1">
					<CommentMeta item={item} />

					{config.renderBody ? (
						config.renderBody(item)
					) : (
						<p className="mt-2 whitespace-pre-wrap wrap-break-word text-sm text-foreground">
							{item.body}
						</p>
					)}

					<div className="mt-2 flex flex-wrap items-start gap-3">
						{isLoggedIn && (
							<button
								type="button"
								onClick={() => setReplying((v) => !v)}
								className="inline-flex h-6 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
								aria-label={replying ? "取消回复" : "回复"}
							>
								<MessageCircle className="size-3.5" />
								<span>回复</span>
							</button>
						)}
						{config.renderActions?.(item)}
					</div>

					{/* 内嵌回复表单：点回复按钮后展开 */}
					{replying && (
						<div className="mt-2 pl-3">
							{config.renderReplyForm(item, { onSuccess: handleReplySuccess })}
						</div>
					)}
				</div>
			</SpotlightCard>

			{/* 回复区：仅顶层评论渲染（两层扁平，回复不再嵌套回复区） */}
			{level === 0 &&
				shouldRenderRepliesBlock(item, config.repliesMode, pendingReplies.length) && (
					<CommentRepliesBlock
						comment={item}
						isLoggedIn={isLoggedIn}
						config={config}
						pendingReplies={pendingReplies}
						onReplyAdded={(reply) => setPendingReplies((prev) => [...prev, reply])}
					/>
				)}
		</div>
	);
}

export default CommentItem;
