/**
 * CommentItem - 单条评论卡片（两层扁平回复）
 *
 * 视觉跟随项目当前设计语言（与 AnnouncementCard 同构）：
 *   - BorderGlow 外壳，severity 决定色相（shadcn 色阶，非 neon）
 *   - 左侧 1px severity 色条
 *   - font-mono 仅用于时间戳
 *   - 「审批中」徽章（PendingBadge）仅在 pending 态显示
 *
 * 回复（按需加载分页）：
 *   - 默认显示后端预览（comment.replies，前 3 条）
 *   - 「查看全部 xx 条回复」走 GET /comments/{id}/replies 独立分页
 *   - 纯追加（预览不动 + 去重新增），无视觉抖动
 *   - 回复按钮用图标（lucide MessageCircle），仅登录用户可见
 */
import type { Comment } from "@entities/comment/model/types";
import { useReplies } from "@features/comments/api/queries";
import { avatarUrl, contentImageUrl, imageUrl } from "@shared/lib/image-url";
import { EmojiText } from "@shared/ui/emoji-text";
import { ImageGrid } from "@shared/ui/image-grid";
import BorderGlow from "@vendor/react-bits/BorderGlow";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronDown, Loader2, MessageCircle } from "lucide-react";
import { useState } from "react";
import { type CommentTreeNode, getCommentSeverity } from "../lib/comment-tree";
import { getCommentSev } from "../lib/severity";
import { CommentForm } from "./CommentForm";
import { PendingBadge } from "./PendingBadge";
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

export interface CommentItemProps {
    /** 当前评论节点（含回复） */
    node: CommentTreeNode;
    /** 是否为文章 Owner 本人评论（影响 severity 高亮） */
    isAuthor?: boolean;
    /** 当前缩进深度（顶级为 0，用于视觉缩进与避免无限嵌套） */
    level?: number;
    /** 文章 id（回复表单提交用）。仅 level=0 的顶层评论需要传，回复层不需要再嵌回复表单 */
    postId?: string;
    /** 是否登录（决定是否显示回复按钮；仅登录可回复） */
    isLoggedIn?: boolean;
    /** 回复提交回调（level>=1 时由父级传入，将新回复冒泡到顶层 CommentItem 的 pendingReplies） */
    onReplyAdded?: (reply: Comment) => void;
}

export function CommentItem({
    node,
    isAuthor = false,
    level = 0,
    postId,
    isLoggedIn = false,
    onReplyAdded,
}: CommentItemProps) {
    const comment = node.comment;
    const sev = getCommentSev(getCommentSeverity(node, { isAuthor }));
    const isPending = comment.status === "pending";

    const [replying, setReplying] = useState(false);
    const [pendingReplies, setPendingReplies] = useState<Comment[]>([]);

    return (
        <div className="group relative">
            <div className="overflow-hidden rounded-xl ring-1 ring-black/5 dark:ring-white/10">
                <BorderGlow
                    backgroundColor="hsl(var(--card))"
                    borderRadius={12}
                    glowColor={sev.glow[0]}
                    colors={[
                        `hsl(${sev.glow[0]} / 0.9)`,
                        `hsl(${sev.glow[1]} / 0.5)`,
                        `hsl(${sev.glow[2]} / 0.9)`,
                    ]}
                    glowIntensity={isPending ? 0.3 : 0.5}
                    glowRadius={14}
                    animated={false}
                    className="flex gap-3 p-4"
                >
                    {/* 左侧 severity 色条 */}
                    <div className={`w-1 shrink-0 rounded-full ${sev.bar}`} aria-hidden />

                    <div className="flex-1 min-w-0">
                        <CommentMeta comment={comment} isAuthor={isAuthor} isPending={isPending} />
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground">
                            <EmojiText text={comment.body} emote={comment.emote} />
                        </p>

                        {comment.pictures && comment.pictures.length > 0 && (
                            <div className="mt-2">
                                {/*
                                 * 格子用缩略图(点开预览才加载原图):
                                 * 单图 w=800 保比例(GIF 剥参数保动画);
                                 * 多图 thumb=400x400 居中裁方,与 aspect-square 格子一致。
                                 */}
                                <ImageGrid images={toGridImages(comment.pictures)} />
                            </div>
                        )}

                        {/* 互动区：回复 + 表情 */}
                        <div className="mt-2 flex flex-wrap items-start gap-3">
                            {/* 回复按钮（图标）：仅登录用户显示 */}
                            {isLoggedIn && postId && (
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

                            <ReactionBar commentId={comment.id} isLoggedIn={isLoggedIn} />
                        </div>
                    </div>
                </BorderGlow>
            </div>

            {/* 内嵌回复表单：点回复图标后展开 */}
            {replying && postId && (
                <div className="mt-2 pl-3">
                    <CommentForm
                        postId={postId}
                        parentId={comment.id}
                        compact
                        isLoggedIn={isLoggedIn}
                        onSuccess={(newReply) => {
                            if (onReplyAdded) {
                                onReplyAdded(newReply);
                            } else {
                                setPendingReplies((prev) => [...prev, newReply]);
                            }
                            setReplying(false);
                        }}
                    />
                </div>
            )}

            {/* 回复区：顶层评论显示「按需加载回复」，回复层（level>=1）不再嵌套回复区 */}
            {level === 0 && ((comment.replies_total ?? 0) > 0 || pendingReplies.length > 0) && (
                <CommentRepliesBlock
                    comment={comment}
                    isLoggedIn={isLoggedIn}
                    postId={postId}
                    pendingReplies={pendingReplies}
                    onReplyAdded={(reply) => setPendingReplies((prev) => [...prev, reply])}
                />
            )}
        </div>
    );
}

/**
 * CommentRepliesBlock 顶层评论下的回复区（预览 + 按需追加 + 分页）。
 *
 * 渲染策略（纯追加，无替换，避免视觉抖动）：
 *   1. 永远显示后端预览（comment.replies，前 3 条）——位置不动
 *   2. 总数超预览数时，底部显示「查看全部 xx 条回复」按钮
 *   3. 点击 → useInfiniteQuery 拉分页，渲染时去重（跳过预览里已有的 id），
 *      新增回复追加在预览下方
 *   4. 「查看更多」按钮在底部，fetchNextPage 继续追加
 *
 * 回复不排序（排序只给顶层评论用），默认按后端 created_at ASC。
 */
function CommentRepliesBlock({
    comment,
    isLoggedIn,
    postId,
    pendingReplies = [],
    onReplyAdded,
}: {
    comment: Comment;
    isLoggedIn: boolean;
    postId?: string;
    pendingReplies?: Comment[];
    onReplyAdded?: (reply: Comment) => void;
}) {
    const repliesTotal = comment.replies_total ?? 0;
    const previewReplies = comment.replies ?? [];
    const [expanded, setExpanded] = useState(false);

    const previewIds = new Set(previewReplies.map((r) => r.id));
    // refetch 后新回复可能进了预览，此时不重复显示
    const visiblePending = pendingReplies.filter((r) => !previewIds.has(r.id));
    const visibleCount = previewReplies.length + visiblePending.length;
    const allExcludedIds = new Set([...previewIds, ...visiblePending.map((r) => r.id)]);

    return (
        <div className="mt-2 space-y-2 border-l border-edge-hairline pl-3">
            {/* 预览回复 */}
            {previewReplies.map((reply) => (
                <CommentItem
                    key={reply.id}
                    node={{ comment: reply, replies: [] }}
                    level={1}
                    postId={postId}
                    isLoggedIn={isLoggedIn}
                    onReplyAdded={onReplyAdded}
                />
            ))}

            {/* 刚提交的回复（尾部追加） */}
            {visiblePending.map((reply) => (
                <CommentItem
                    key={reply.id}
                    node={{ comment: reply, replies: [] }}
                    level={1}
                    postId={postId}
                    isLoggedIn={isLoggedIn}
                    onReplyAdded={onReplyAdded}
                />
            ))}

            {/* 展开后的追加回复（useReplies 分页，去重预览 + pending） */}
            {expanded && (
                <ExpandedReplies
                    commentId={comment.id}
                    excludeIds={allExcludedIds}
                    isLoggedIn={isLoggedIn}
                    postId={postId}
                    onReplyAdded={onReplyAdded}
                />
            )}

            {/* 「查看全部」按钮：仅当实际有更多回复未显示时出现 */}
            {!expanded && repliesTotal > visibleCount && (
                <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                    <ChevronDown className="size-3" />
                    查看全部 {repliesTotal} 条回复
                </button>
            )}
        </div>
    );
}

/**
 * ExpandedReplies 展开后的追加回复（useInfiniteQuery 分页 + 去重 + 加载效果）。
 *
 * - excludeIds：预览的 id 集合，useReplies 返回里与预览重复的跳过（纯追加）
 * - 「查看更多回复」按钮在底部，fetchNextPage 继续追加
 * - 加载中显示 Loader2 旋转图标
 */
function ExpandedReplies({
    commentId,
    excludeIds,
    isLoggedIn,
    postId,
    onReplyAdded,
}: {
    commentId: string;
    excludeIds: Set<string>;
    isLoggedIn: boolean;
    postId?: string;
    onReplyAdded?: (reply: Comment) => void;
}) {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useReplies(commentId, {
        limit: 10,
    });
    // 去重：跳过与预览重复的 id（纯追加，预览已在上方独立显示）
    const allReplies = data?.pages.flatMap((p) => p.data) ?? [];
    const replies = allReplies.filter((r) => !excludeIds.has(r.id));

    return (
        <>
            {/* 追加回复列表 */}
            {replies.map((reply) => (
                <CommentItem
                    key={reply.id}
                    node={{ comment: reply, replies: [] }}
                    level={1}
                    postId={postId}
                    isLoggedIn={isLoggedIn}
                    onReplyAdded={onReplyAdded}
                />
            ))}

            {/* 底部「查看更多回复」按钮 + 加载效果 */}
            {hasNextPage && (
                <button
                    type="button"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                >
                    {isFetchingNextPage ? (
                        <>
                            <Loader2 className="size-3 animate-spin" />
                            加载中...
                        </>
                    ) : (
                        <>
                            <ChevronDown className="size-3" />
                            查看更多回复
                        </>
                    )}
                </button>
            )}
            {/* 首次加载效果（fetchNextPage 没触发过，但 useReplies 还在加载第一页） */}
            {isFetchingNextPage && replies.length === 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    加载中...
                </div>
            )}
        </>
    );
}

/** 评论顶部元信息：头像 + 昵称 + 「回复 @yyy」标注 + 作者徽章 + 审批中徽章 + 时间 */
function CommentMeta({
    comment,
    isAuthor,
    isPending,
}: {
    comment: Comment;
    isAuthor: boolean;
    isPending: boolean;
}) {
    const sev = getCommentSev(isAuthor ? "author" : "default");
    return (
        <div className="flex items-center gap-2">
            {comment.avatar_url ? (
                <img
                    src={avatarUrl(comment.avatar_url)}
                    alt={comment.author_name}
                    className="size-6 rounded-full object-cover"
                    loading="lazy"
                />
            ) : (
                <div className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {comment.author_name.slice(0, 1).toUpperCase()}
                </div>
            )}
            <span className="text-sm font-medium text-foreground">{comment.author_name}</span>
            {/* 回复标注：reply_to_name 非空表示这是对某条回复的回复，显示「回复 @yyy」 */}
            {comment.reply_to_name && (
                <span className="text-xs text-muted-foreground">
                    回复 <span className="text-primary">@{comment.reply_to_name}</span>
                </span>
            )}
            {isAuthor && (
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${sev.badge}`}>作者</span>
            )}
            <PendingBadge show={isPending} />
            <time className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                {formatTimeAgo(comment.created_at)}
            </time>
        </div>
    );
}

export default CommentItem;

function formatTimeAgo(createdAt: string): string {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) {
        return "刚刚";
    }
    return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
}
