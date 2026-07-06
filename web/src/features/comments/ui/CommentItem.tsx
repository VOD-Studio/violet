/**
 * CommentItem - 单条评论卡片（两层扁平回复）
 *
 * 视觉跟随项目当前设计语言（与 AnnouncementCard 同构）：
 *   - BorderGlow 外壳，severity 决定色相（shadcn 色阶，非 neon）
 *   - 左侧 1px severity 色条
 *   - font-mono 仅用于时间戳
 *   - 「审批中」徽章（PendingBadge）仅在 pending 态显示
 *
 * 回复（两层扁平，B站式）：
 *   - 顶层评论下挂扁平 replies，回复另一条回复时显示「回复 @yyy」（读 comment.reply_to_name）
 *   - 默认只展开前 REPLIES_PREVIEW_COUNT 条，超出折叠（避免热门评论回复撑爆页面）
 *   - 回复按钮用图标（lucide MessageCircle），hover 显示；仅登录用户可见
 *
 * PRD-0001 双轨制：本组件只负责展示，不区分登录/匿名（可见性由后端 + CommentSection 容器保证）。
 */
import type { Comment } from "@entities/comment/model/types";
import BorderGlow from "@vendor/react-bits/BorderGlow";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { type CommentTreeNode, getCommentSeverity } from "../lib/comment-tree";
import { getCommentSev } from "../lib/severity";
import { CommentForm } from "./CommentForm";
import { PendingBadge } from "./PendingBadge";

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
}

/**
 * REPLIES_PREVIEW_COUNT 默认展开的回复条数。
 * B站式：前 3 条默认展开，超出折叠为「展开剩余 N 条回复」。热门评论回复多了不撑爆页面。
 */
const REPLIES_PREVIEW_COUNT = 3;

export function CommentItem({
    node,
    isAuthor = false,
    level = 0,
    postId,
    isLoggedIn = false,
}: CommentItemProps) {
    const { comment, replies } = node;
    const sev = getCommentSev(getCommentSeverity(node, { isAuthor }));
    const isPending = comment.status === "pending";

    // 回复框开关：点击回复图标后展开 compact CommentForm
    const [replying, setReplying] = useState(false);
    // 回复列表展开开关：默认折叠超出 REPLIES_PREVIEW_COUNT 的部分
    const [repliesExpanded, setRepliesExpanded] = useState(false);

    // 折叠状态下的可见回复：前 REPLIES_PREVIEW_COUNT 条
    const visibleReplies = repliesExpanded ? replies : replies.slice(0, REPLIES_PREVIEW_COUNT);
    const hiddenCount = replies.length - REPLIES_PREVIEW_COUNT;

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
                            {comment.body}
                        </p>

                        {/* 回复按钮（图标）：仅登录用户显示。
                            两层扁平：回复层的回复仍挂同一顶层下，parent_id 指被回复的那条，
                            前端读 comment.reply_to_name 显示「回复 @yyy」。 */}
                        {isLoggedIn && postId && (
                            <button
                                type="button"
                                onClick={() => setReplying((v) => !v)}
                                className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                                aria-label={replying ? "取消回复" : "回复"}
                            >
                                <MessageCircle className="size-3.5" />
                                <span>回复</span>
                            </button>
                        )}
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
                        onSuccess={() => setReplying(false)}
                    />
                </div>
            )}

            {/* 回复列表（两层扁平）：统一缩进一层，不逐层加深 */}
            {replies.length > 0 && (
                <div className="mt-2 space-y-2 border-l border-edge-hairline pl-3">
                    {visibleReplies.map((reply) => (
                        <CommentItem
                            key={reply.comment.id}
                            node={reply}
                            isAuthor={isAuthor}
                            level={level + 1}
                            postId={postId}
                            isLoggedIn={isLoggedIn}
                        />
                    ))}
                    {/* 折叠/展开切换 */}
                    {hiddenCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setRepliesExpanded((v) => !v)}
                            className="text-xs text-primary hover:underline"
                        >
                            {repliesExpanded ? "收起" : `展开剩余 ${hiddenCount} 条回复`}
                        </button>
                    )}
                </div>
            )}
        </div>
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
                    src={comment.avatar_url}
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
                {formatDistanceToNow(new Date(comment.created_at), {
                    addSuffix: true,
                    locale: zhCN,
                })}
            </time>
        </div>
    );
}

export default CommentItem;
