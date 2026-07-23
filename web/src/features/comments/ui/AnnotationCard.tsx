/**
 * AnnotationCard - 批注卡片（侧边栏 / 行内气泡共用）。
 *
 * 与 CommentItem 的差异：
 *   - 顶部多一个「引言区」（selectedText 高亮展示），点明批注锚定的原文
 *   - 支持点击触发滚动回高亮（onClick）
 *   - 支持 active 态（当前高亮对应的卡片亮起，severity 边框加重）
 *   - 批注回复也两层扁平，继承父锚点（子批注共享同一高亮区）
 *
 * 复用：BorderGlow 外壳 + severity 配色（lib/severity.ts）+ PendingBadge。
 */
import type { Comment } from "@entities/comment/model/types";
import { avatarUrl } from "@shared/lib/image-url";
import { EmojiText } from "@shared/ui/emoji-text";
import { SpotlightCard } from "@shared/vendor/react-bits/SpotlightCard";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import type { CommentTreeNode } from "../lib/comment-tree";
import { getCommentSev } from "../lib/severity";
import { CommentForm } from "./CommentForm";
import { PendingBadge } from "./PendingBadge";

/** 批注面板空间小，回复折叠阈值比评论区更紧 */
const REPLIES_PREVIEW_COUNT = 2;

export interface AnnotationCardProps {
    /** 批注节点（含扁平回复，子批注继承父锚点） */
    node: CommentTreeNode;
    /** 选中原文（引言区展示）。同一 block 的批注共享锚点。 */
    selectedText: string;
    /** 是否为当前滚动激活的批注（影响边框高亮） */
    active?: boolean;
    /** 点击卡片回调（通常滚动到正文高亮） */
    onClick?: () => void;
    /** 文章 id（回复表单提交用）。不传则不显示回复按钮（如未登录） */
    postId?: string;
    /** 是否登录（决定是否显示回复按钮；仅登录可回复） */
    isLoggedIn?: boolean;
}

export function AnnotationCard({
    node,
    selectedText,
    active = false,
    onClick,
    postId,
    isLoggedIn = false,
}: AnnotationCardProps) {
    const { comment, replies } = node;
    const sev = getCommentSev(comment.is_author ? "author" : "default");
    const isPending = comment.status === "pending";

    const [replying, setReplying] = useState(false);
    const [repliesExpanded, setRepliesExpanded] = useState(false);
    const [pendingReplies, setPendingReplies] = useState<Comment[]>([]);

    // refetch 后新回复进了 node.replies，从 pendingReplies 去重移除
    const replyIds = new Set(replies.map((r) => r.comment.id));
    const visiblePending = pendingReplies.filter((r) => !replyIds.has(r.id));
    const allReplies = [...replies, ...visiblePending.map((r) => ({ comment: r, replies: [] }))];
    const visibleReplies = repliesExpanded
        ? allReplies
        : allReplies.slice(0, REPLIES_PREVIEW_COUNT);
    const hiddenCount = allReplies.length - REPLIES_PREVIEW_COUNT;

    return (
        <div className="w-full">
            <SpotlightCard
                className={`flex gap-2 p-3 ${active ? "ring-2 ring-primary/40" : ""}`}
                onClick={onClick}
                role={onClick ? "button" : undefined}
                tabIndex={onClick ? 0 : undefined}
                onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
                {...(onClick ? { "aria-label": `批注：${comment.body.slice(0, 30)}` } : {})}
            >
                <div className={`w-1 shrink-0 rounded-full ${sev.bar}`} aria-hidden />

                <div className="min-w-0 flex-1">
                    <div className="mb-2 border-l-2 border-edge-hairline pl-2 text-xs italic text-muted-foreground line-clamp-2">
                        {selectedText}
                    </div>

                    <CommentMeta comment={comment} sev={sev} isPending={isPending} />

                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                        <EmojiText text={comment.body} emote={comment.emote} />
                    </p>

                    <time className="mt-1 block font-mono text-[10px] tabular-nums text-muted-foreground">
                        {formatTimeAgo(comment.created_at)}
                    </time>

                    {isLoggedIn && postId && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setReplying((v) => !v);
                            }}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                            aria-label={replying ? "取消回复" : "回复批注"}
                        >
                            <MessageCircle className="size-3" />
                            <span>回复</span>
                        </button>
                    )}
                </div>
            </SpotlightCard>

            {/* 内嵌回复表单 */}
            {replying && postId && (
                <div className="mt-2 px-3">
                    <CommentForm
                        postId={postId}
                        parentId={comment.id}
                        compact
                        isLoggedIn={isLoggedIn}
                        enableImage={false}
                        onSuccess={(newReply) => {
                            setPendingReplies((prev) => [...prev, newReply]);
                            setReplying(false);
                        }}
                    />
                </div>
            )}

            {/* 回复列表（两层扁平，继承同一锚点） */}
            {allReplies.length > 0 && (
                <div className="mt-1 space-y-1 border-l border-edge-hairline pl-2">
                    {visibleReplies.map((reply) => (
                        <AnnotationReply key={reply.comment.id} comment={reply.comment} sev={sev} />
                    ))}
                    {hiddenCount > 0 && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setRepliesExpanded((v) => !v);
                            }}
                            className="text-[11px] text-primary hover:underline"
                        >
                            {repliesExpanded ? "收起" : `展开剩余 ${hiddenCount} 条`}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

/** CommentMeta 批注元信息：头像 + 昵称 + 「回复 @yyy」+ 作者徽章 + 审批中徽章 */
function CommentMeta({
    comment,
    sev,
    isPending,
}: {
    comment: Comment;
    sev: ReturnType<typeof getCommentSev>;
    isPending: boolean;
}) {
    return (
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {comment.avatar_url ? (
                <img
                    src={avatarUrl(comment.avatar_url)}
                    alt={comment.author_name}
                    className="size-5 rounded-full object-cover"
                    loading="lazy"
                />
            ) : (
                <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                    {comment.author_name.slice(0, 1).toUpperCase()}
                </span>
            )}
            <span className="max-w-32 truncate text-xs font-medium text-foreground sm:max-w-[10rem]">
                {comment.author_name}
            </span>
            {comment.reply_to_name && (
                <span className="text-[10px] text-muted-foreground">
                    回复 <span className="text-primary">@{comment.reply_to_name}</span>
                </span>
            )}
            {comment.is_author && (
                <span className={`rounded px-1 text-[10px] ${sev.badge}`}>作者</span>
            )}
            <PendingBadge show={isPending} />
        </div>
    );
}

/**
 * AnnotationReply 批注的扁平回复（不再嵌回复表单，两层结构到顶）。
 * 比 AnnotationCard 更紧凑：无引言区、无 BorderGlow 外壳。
 */
function AnnotationReply({
    comment,
    sev,
}: {
    comment: Comment;
    sev: ReturnType<typeof getCommentSev>;
}) {
    return (
        <div className="rounded-md bg-muted/30 p-2">
            <CommentMeta comment={comment} sev={sev} isPending={comment.status === "pending"} />
            <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-foreground">
                <EmojiText text={comment.body} emote={comment.emote} />
            </p>
        </div>
    );
}

export default AnnotationCard;

/** formatTimeAgo 与 CommentItem 同样的零值守卫：无效日期或 2000 年前显示「刚刚」 */
function formatTimeAgo(createdAt: string): string {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) {
        return "刚刚";
    }
    return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
}
