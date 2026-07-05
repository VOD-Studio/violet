/**
 * AnnotationCard - 批注卡片（侧边栏 / 行内气泡共用）。
 *
 * 与 CommentItem 的差异：
 *   - 顶部多一个「引言区」（selectedText 高亮展示），点明批注锚定的原文
 *   - 支持点击触发滚动回高亮（onClick）
 *   - 支持 active 态（当前高亮对应的卡片亮起，severity 边框加重）
 *
 * 复用：BorderGlow 外壳 + severity 配色（lib/severity.ts）+ PendingBadge。
 */
import type { Comment } from "@entities/comment/model/types";
import BorderGlow from "@vendor/react-bits/BorderGlow";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { getCommentSev } from "../lib/severity";
import { PendingBadge } from "./PendingBadge";

export interface AnnotationCardProps {
    /** 批注评论 */
    comment: Comment;
    /** 选中原文（引言区展示） */
    selectedText: string;
    /** 是否为当前滚动激活的批注（影响边框高亮） */
    active?: boolean;
    /** 点击卡片回调（通常滚动到正文高亮） */
    onClick?: () => void;
}

export function AnnotationCard({
    comment,
    selectedText,
    active = false,
    onClick,
}: AnnotationCardProps) {
    const sev = getCommentSev(comment.is_author ? "author" : "default");
    const isPending = comment.status === "pending";

    return (
        <button
            type="button"
            onClick={onClick}
            className={`block w-full text-left transition-transform ${active ? "scale-[1.02]" : "hover:scale-[1.01]"}`}
            aria-label={`批注：${comment.body.slice(0, 30)}`}
        >
            <div
                className={`overflow-hidden rounded-xl ring-1 ${active ? "ring-2" : "ring-black/5 dark:ring-white/10"}`}
            >
                <BorderGlow
                    backgroundColor="hsl(var(--card))"
                    borderRadius={12}
                    glowColor={sev.glow[0]}
                    colors={[
                        `hsl(${sev.glow[0]} / ${active ? 0.95 : 0.6})`,
                        `hsl(${sev.glow[1]} / 0.5)`,
                        `hsl(${sev.glow[2]} / 0.9)`,
                    ]}
                    glowIntensity={active ? 0.8 : 0.4}
                    glowRadius={active ? 18 : 12}
                    animated={false}
                    className="flex gap-2 p-3"
                >
                    <div className={`w-1 shrink-0 rounded-full ${sev.bar}`} aria-hidden />

                    <div className="min-w-0 flex-1">
                        {/* 引言区：选中原文，斜体 + severity 色条 + 截断 */}
                        <div className="mb-2 border-l-2 border-edge-hairline pl-2 text-xs italic text-muted-foreground line-clamp-2">
                            {selectedText}
                        </div>

                        {/* 评论元信息 */}
                        <div className="mb-1 flex items-center gap-1.5">
                            {comment.avatar_url ? (
                                <img
                                    src={comment.avatar_url}
                                    alt={comment.author_name}
                                    className="size-5 rounded-full object-cover"
                                    loading="lazy"
                                />
                            ) : (
                                <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                                    {comment.author_name.slice(0, 1).toUpperCase()}
                                </span>
                            )}
                            <span className="text-xs font-medium text-foreground">
                                {comment.author_name}
                            </span>
                            {comment.is_author && (
                                <span className={`rounded px-1 text-[10px] ${sev.badge}`}>
                                    作者
                                </span>
                            )}
                            <PendingBadge show={isPending} />
                        </div>

                        {/* 评论正文 */}
                        <p className="whitespace-pre-wrap break-words text-sm text-foreground line-clamp-3">
                            {comment.body}
                        </p>

                        <time className="mt-1 block font-mono text-[10px] tabular-nums text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), {
                                addSuffix: true,
                                locale: zhCN,
                            })}
                        </time>
                    </div>
                </BorderGlow>
            </div>
        </button>
    );
}

export default AnnotationCard;
