import { cn } from "@/shared/lib/utils";

const METHOD_STYLES: Record<string, string> = {
	GET: "bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
	POST: "bg-sky-600/10 text-sky-800 dark:text-sky-300",
	PUT: "bg-amber-600/12 text-amber-800 dark:text-amber-300",
	PATCH: "bg-orange-600/12 text-orange-800 dark:text-orange-300",
	DELETE: "bg-red-600/10 text-red-800 dark:text-red-300",
};

/** HTTP 方法徽章：等宽小字号，纸面上的墨色系区分 */
export function MethodBadge({ method, className }: { method: string; className?: string }) {
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center justify-center rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider",
				METHOD_STYLES[method] ?? "bg-muted text-muted-foreground",
				className,
			)}
		>
			{method}
		</span>
	);
}
