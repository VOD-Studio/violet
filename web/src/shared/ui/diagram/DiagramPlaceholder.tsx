/**
 * DiagramPlaceholder - 图块加载占位（阅读端共用）
 *
 * 纯 UI 组件（不依赖 mermaid）：markdown-components 的 Suspense fallback 与
 * DiagramBlock 的渲染中占位共用，保证「chunk 懒加载 → mermaid 渲染」两段等待
 * 视觉一致。消费方按 renderers.ts 同款方式深路径直连引入，避免经
 * diagram/index barrel 把 mermaid 依赖树拉进文章正文主 chunk。
 */
import { Workflow } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export function DiagramPlaceholder({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "flex min-h-24 w-full items-center justify-center rounded-lg bg-muted/40",
                className,
            )}
            aria-hidden
        >
            <Workflow className="size-5 animate-pulse text-muted-foreground/40" />
        </div>
    );
}
