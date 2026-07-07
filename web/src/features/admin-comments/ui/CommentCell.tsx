import type { AdminComment } from "@features/admin-comments/model/types";
import { Images, Quote } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const ANCHOR_PREVIEW_MAX = 60;

function truncate(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max)}…` : text;
}

interface CommentCellProps {
    row: AdminComment;
}

/**
 * 评论审核列表 — 评论内容预览单元格
 *
 * 紧凑展示三条信息：批注锚定原文摘录（如有）、评论正文预览（2 行）、图片计数徽标。
 * 配合 DataTable expandable 展开 CommentDetail 查看完整内容。
 */
export function CommentCell({ row }: CommentCellProps) {
    const anchorText = row.anchor?.selected_text;
    const hasPictures = row.pictures.length > 0;

    return (
        <div className="space-y-1">
            {anchorText && (
                <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Quote className="size-3 shrink-0 translate-y-0.5 text-primary/50" />
                    <span className="line-clamp-1 italic">
                        {truncate(anchorText, ANCHOR_PREVIEW_MAX)}
                    </span>
                </div>
            )}
            <p
                className={cn(
                    "line-clamp-2 text-sm leading-relaxed break-words",
                    anchorText && "text-foreground",
                )}
            >
                {row.body}
            </p>
            {hasPictures && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Images className="size-3" />
                    <span>{row.pictures.length} 张图片</span>
                </div>
            )}
        </div>
    );
}
