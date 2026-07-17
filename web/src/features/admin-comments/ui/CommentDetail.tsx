import type { AdminComment } from "@features/admin-comments/model/types";
import { avatarUrl, imageUrl } from "@shared/lib/image-url";
import { Quote } from "lucide-react";
import { ImagePreview, useImagePreview } from "@/shared/ui/image-preview";

interface CommentDetailProps {
    row: AdminComment;
}

/**
 * 评论审核列表 — 展开行详情视图
 *
 * 聊天气泡式布局：左侧作者头像 + 右侧气泡内容。
 * 气泡内按顺序展示批注锚定原文（引用块）、评论正文、图片画廊。
 * 图片点击调起全屏 ImagePreview。
 */
export function CommentDetail({ row }: CommentDetailProps) {
    const preview = useImagePreview();

    return (
        <div className="flex gap-3">
            {/* 作者头像 */}
            <img
                src={avatarUrl(row.avatar_url, row.author_name)}
                alt={row.author_name}
                className="size-9 shrink-0 rounded-full object-cover"
                loading="lazy"
            />

            {/* 气泡内容 */}
            <div className="min-w-0 flex-1 space-y-2">
                {/* 批注锚定原文 */}
                {row.anchor?.selected_text && (
                    <div className="flex items-start gap-1.5 rounded-lg border-l-2 border-primary/30 bg-muted/50 px-3 py-1.5 text-xs">
                        <Quote className="size-3 shrink-0 translate-y-0.5 text-primary/50" />
                        <span className="italic text-muted-foreground">
                            {row.anchor.selected_text}
                        </span>
                    </div>
                )}

                {/* 评论正文 — 气泡 */}
                <div className="inline-block rounded-2xl rounded-tl-sm bg-muted/40 px-4 py-2.5">
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {row.body}
                    </p>
                </div>

                {/* 图片画廊 */}
                {row.pictures.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                        {row.pictures.map((pic, i) => (
                            <button
                                type="button"
                                key={pic.url}
                                onClick={(e) =>
                                    preview.openPreview(
                                        row.pictures.map((p) => p.url),
                                        i,
                                        e.currentTarget,
                                    )
                                }
                                className="size-20 shrink-0 overflow-hidden rounded-lg border hover:opacity-80 transition-opacity"
                            >
                                <img
                                    src={imageUrl(pic.url, { thumb: "200x200", format: "webp" })}
                                    alt={`图片 ${i + 1}`}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <ImagePreview
                open={preview.open}
                images={preview.images}
                currentIndex={preview.currentIndex}
                triggerElement={preview.triggerElement}
                onClose={preview.closePreview}
                onIndexChange={preview.setCurrentIndex}
            />
        </div>
    );
}
