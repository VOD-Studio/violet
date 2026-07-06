import { cn } from "@shared/lib/utils";
import { Link } from "@tanstack/react-router";
import DecryptedText from "@vendor/react-bits/DecryptedText";
import { ArrowLeft } from "lucide-react";

export interface NotFoundProps {
    className?: string;
}

/**
 * NotFound - 404 未找到页面
 *
 * 与 Empty 组件保持一致的解密标题视觉语言，
 * 提供返回首页的明确出口。
 */
export default function NotFound({ className }: NotFoundProps) {
    return (
        <div
            className={cn(
                "container mx-auto flex flex-col items-center justify-center px-6 py-32 text-center",
                className,
            )}
        >
            <h1 className="mb-3 font-mono text-4xl font-bold tracking-tight">
                <DecryptedText
                    text="404"
                    animateOn="view"
                    speed={40}
                    maxIterations={12}
                    parentClassName="inline-block"
                    className="bg-gradient-to-r from-muted-foreground to-muted-foreground bg-clip-text text-transparent"
                    encryptedClassName="text-muted-foreground/50"
                />
            </h1>
            <p className="mb-8 max-w-md text-sm text-muted-foreground">页面不存在或已被移除。</p>
            <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-lg border border-edge-hairline px-4 py-2 text-sm transition-colors hover:bg-accent"
            >
                <ArrowLeft className="size-4" />
                返回首页
            </Link>
        </div>
    );
}
