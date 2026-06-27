import { useMagnetic } from "@shared/lib/hooks/use-magnetic";
import { cn } from "@shared/lib/utils";
import * as React from "react";

export interface MagneticProps extends React.HTMLAttributes<HTMLSpanElement> {
    /** 吸附强度 0..1（默认 0.25） */
    strength?: number;
    children: React.ReactNode;
}

/**
 * Magnetic - 磁性吸附包裹器
 *
 * spec「靠近核心可点击元素产生轻微磁力吸附与形变」。
 * 用 useMagnetic 写 --mx/--my，本元素 translate 跟随，位移在自身
 * box 内（不引起周围 reflow）。配合 CustomCursor 的放大形变共构
 * 完整磁力效果。
 */
function Magnetic({ strength, className, children, ...props }: MagneticProps) {
    const { onMouseMove, onMouseLeave } = useMagnetic(strength);
    return (
        <span
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            className={cn(
                "inline-block transition-transform duration-200 ease-out will-change-transform",
                className,
            )}
            style={{ transform: "translate(var(--mx, 0), var(--my, 0))" }}
            {...props}
        >
            {children}
        </span>
    );
}

export { Magnetic };
