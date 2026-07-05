/**
 * CommentItem - 单条评论卡片（递归渲染嵌套回复）
 *
 * 视觉跟随项目当前设计语言（与 AnnouncementCard 同构）：
 *   - BorderGlow 外壳，severity 决定色相（shadcn 色阶，非 neon）
 *   - 左侧 1px severity 色条
 *   - font-mono 仅用于时间戳
 *   - 「审批中」徽章（PendingBadge）仅在 pending 态显示
 *
 * 递归：replies 用缩进对话树展示，最大深度由后端 path+depth 强制（前端不重复校验）。
 *
 * PRD-0001 双轨制：本组件只负责展示，不区分登录/匿名（可见性由后端 + CommentSection 容器保证）。
 */
import type { Comment } from "@entities/comment/model/types";
import BorderGlow from "@vendor/react-bits/BorderGlow";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { type CommentTreeNode, getCommentSeverity } from "../lib/comment-tree";
import { getCommentSev } from "../lib/severity";
import { PendingBadge } from "./PendingBadge";

export interface CommentItemProps {
    /** 当前评论节点（含回复） */
    node: CommentTreeNode;
    /** 是否为文章 Owner 本人评论（影响 severity 高亮） */
    isAuthor?: boolean;
    /** 当前缩进深度（顶级为 0，用于视觉缩进与避免无限嵌套） */
    level?: number;
}

/** 最大渲染深度（与后端 MaxDepth=4 对齐，防止视觉过深） */
const MAX_RENDER_DEPTH = 4;

/** 缩进 class 映射（Tailwind 静态 class，避免动态拼接被 purge） */
const INDENT_CLASS = ["", "ml-4", "ml-8", "ml-12", "ml-16"] as const;

export function CommentItem({ node, isAuthor = false, level = 0 }: CommentItemProps) {
    const { comment, replies } = node;
    const sev = getCommentSev(getCommentSeverity(node, { isAuthor }));
    const isPending = comment.status === "pending";

    return (
        <div
            className={`group relative ${INDENT_CLASS[Math.min(level, INDENT_CLASS.length - 1)] ?? ""}`}
        >
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
                    </div>
                </BorderGlow>
            </div>

            {/* 递归渲染回复，超过最大深度不再渲染（避免视觉过深） */}
            {replies.length > 0 && level < MAX_RENDER_DEPTH && (
                <div className="mt-2 space-y-2 border-l border-edge-hairline pl-3">
                    {replies.map((reply) => (
                        <CommentItem
                            key={reply.comment.id}
                            node={reply}
                            isAuthor={isAuthor}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/** 评论顶部元信息：头像 + 昵称 + 作者徽章 + 审批中徽章 + 时间 */
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
