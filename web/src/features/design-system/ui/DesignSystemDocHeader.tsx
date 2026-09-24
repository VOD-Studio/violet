import { cn } from "@shared/lib/utils";
import type { ReactNode } from "react";

export interface DesignSystemDocHeaderProps {
	/** 中文章号，如「壹」 */
	num?: string;
	/** 章节标题 */
	title: string;
	/** 范围说明导言 */
	scope?: string;
	/** 状态或徽标，如「营造中」 */
	badge?: string;
	/** 额外操作区 */
	extra?: ReactNode;
	/** 自定义类名 */
	className?: string;
}

/**
 * 营造法式章节标头：呈现章号、章节主标题与范围导言。
 */
export function DesignSystemDocHeader({
	num,
	title,
	scope,
	badge,
	extra,
	className,
}: DesignSystemDocHeaderProps) {
	return (
		<div className={cn("mb-8", className)}>
			<div className="flex flex-wrap items-baseline justify-between gap-4">
				<div className="flex items-baseline gap-3">
					{num && <span className="font-mono text-sm text-muted-foreground">{num}</span>}
					<h2 className="text-2xl font-bold text-foreground">{title}</h2>
					{badge && (
						<span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
							{badge}
						</span>
					)}
				</div>
				{extra && <div>{extra}</div>}
			</div>
			{scope && (
				<p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">{scope}</p>
			)}
		</div>
	);
}
