import { cn } from "@shared/lib/utils";
import type * as React from "react";

/**
 * ShimmerSkeleton - 光影扫过精密骨架
 *
 * spec：替代 LoaderCircle。一道高光每 1.6s 横扫，
 * 暗底 + 极细 1px 顶部高光线（模拟玻璃边缘）。
 */
function ShimmerSkeleton({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="shimmer-skeleton"
            className={cn("relative overflow-hidden rounded-md", "bg-secondary", className)}
            {...props}
        >
            {/* 顶部极细高光线 */}
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-edge-hairline to-transparent" />
            {/* 光影扫过 */}
            <span
                className="pointer-events-none absolute inset-0 -translate-x-full"
                style={{
                    background:
                        "linear-gradient(90deg, transparent, hsl(var(--glow-soft) / 0.12), transparent)",
                    animation: "nexus-shimmer 1.6s ease-in-out infinite",
                }}
            />
        </div>
    );
}

export { ShimmerSkeleton };
