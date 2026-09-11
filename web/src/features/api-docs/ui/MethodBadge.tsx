import { cn } from "@/shared/lib/utils";

/** 方法语义色：纯文字着色，配合固定字宽在白纸面上作扫描锚点 */
const METHOD_TEXT: Record<string, string> = {
	GET: "text-emerald-600 dark:text-emerald-400",
	POST: "text-sky-600 dark:text-sky-400",
	PUT: "text-amber-600 dark:text-amber-400",
	PATCH: "text-orange-600 dark:text-orange-400",
	DELETE: "text-red-600 dark:text-red-400",
};

/** HTTP 方法标注：等宽纯色文字，固定宽度保证路径列对齐 */
export function MethodBadge({ method, className }: { method: string; className?: string }) {
	return (
		<span
			className={cn(
				"shrink-0 text-center font-mono text-[10px] font-bold tracking-[0.14em]",
				METHOD_TEXT[method] ?? "text-muted-foreground",
				className,
			)}
		>
			{method}
		</span>
	);
}
