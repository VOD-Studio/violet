import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

interface ModalFooterProps {
    /** 操作按钮等内容 */
    children?: ReactNode;
    /** 额外 className */
    className?: string;
}

/**
 * ModalFooter - Modal 底部操作区（固定，不随内容滚）
 *
 * 三段式布局的下段。顶部带分隔线，按钮默认右对齐、移动端纵向。
 *
 * @example
 * <ModalFooter>
 *   <Button variant="outline" type="button" onClick={close}>取消</Button>
 *   <Button type="submit" form="my-form">提交</Button>
 * </ModalFooter>
 */
export function ModalFooter({ children, className }: ModalFooterProps) {
    return (
        <div
            className={cn(
                "flex shrink-0 flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end",
                className,
            )}
        >
            {children}
        </div>
    );
}
