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
 * 信息本身供排查。容器自带公开方言作用域：根 errorComponent 渲染在公开壳层
 * 之外，无法继承壳层的 .dialect-public，须自挂 scope 保证画布与强调语义一致。
 */
export default function RouteError({ error, className }: RouteErrorProps) {
	return (
		<div
			className={cn(
				"dialect-public container mx-auto flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-6 py-24 text-center",
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
