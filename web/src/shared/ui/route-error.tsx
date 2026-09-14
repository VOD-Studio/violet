import { cn } from "@shared/lib/utils";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export interface RouteErrorProps {
	/** 路由错误对象（errorComponent 回传入参） */
	error: unknown;
	className?: string;
}

/**
 * RouteError - 公开路由错误态
 *
 * 与 NotFound 共享版面语言（mono 标题 + 静音描述 + 返回首页），但保留错误
 * 信息本身供排查。不自带方言类：路由级错误渲染在壳层内继承所在路由的作用域，
 * 根级错误渲染在壳层外落根作用域中性色——错误面不预设方言归属。
 */
export default function RouteError({ error, className }: RouteErrorProps) {
	return (
		<div
			className={cn(
				// min-h 与 PageShell 同约定：撑起真实页面高度，避免页脚上跳
				"container mx-auto flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-6 py-24 text-center",
				className,
			)}
		>
			<p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
				System Error
			</p>
			<h1 className="mb-4 font-mono text-3xl font-bold">出错了</h1>
			<p className="mx-auto mb-8 max-w-md text-sm text-muted-foreground">
				{error instanceof Error ? error.message : "未知错误，请稍后重试"}
			</p>
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
