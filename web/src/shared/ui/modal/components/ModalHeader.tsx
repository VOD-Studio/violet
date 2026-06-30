import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

interface ModalHeaderProps {
    /** 标题（字符串或自定义节点） */
    title?: ReactNode;
    /** 副标题/说明 */
    description?: ReactNode;
    /** 标题是否仅屏幕阅读器可见（lightbox a11y） */
    titleSrOnly?: boolean;
    /** 是否显示右上角关闭按钮 */
    showCloseButton?: boolean;
    /** 无样式逃生口（去掉 padding） */
    unstyled?: boolean;
}

/**
 * ModalHeader - Modal 标题区（固定，不随内容滚）
 *
 * 三段式布局的上段。内部用 Radix Title/Description 保证 a11y。
 */
export function ModalHeader({
    title,
    description,
    titleSrOnly = false,
    showCloseButton = true,
    unstyled = false,
}: ModalHeaderProps) {
    if (!title && !description && !showCloseButton && !titleSrOnly) {
        return null;
    }

    return (
        <div className={cn("flex shrink-0 flex-col gap-2", unstyled ? "" : "px-6 pt-6")}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                    {title && (
                        <DialogPrimitive.Title
                            className={cn(
                                "text-lg leading-none font-semibold",
                                titleSrOnly && "sr-only",
                            )}
                        >
                            {title}
                        </DialogPrimitive.Title>
                    )}
                    {description && (
                        <DialogPrimitive.Description className="text-sm text-muted-foreground">
                            {description}
                        </DialogPrimitive.Description>
                    )}
                </div>
                {showCloseButton && (
                    <DialogPrimitive.Close
                        className="rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:outline-hidden [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
                        aria-label="关闭"
                    >
                        <XIcon />
                    </DialogPrimitive.Close>
                )}
            </div>
        </div>
    );
}
