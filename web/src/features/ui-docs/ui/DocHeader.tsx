import { cn } from "cn";
import type { ReactNode } from "react";

/** 页面主标题、范围说明与可选操作区域。 */
export interface DocHeaderProps {
	title: string;
	scope?: string;
	badge?: string;
	extra?: ReactNode;
	className?: string;
}

export function DocHeader({ title, scope, badge, extra, className }: DocHeaderProps) {
	return (
		<header className={cn("mb-8 space-y-3", className)}>
			<div className="flex flex-wrap items-baseline justify-between gap-4">
				<div className="flex items-baseline gap-3">
					<h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
						{title}
					</h1>
					{badge && (
						<span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
							{badge}
						</span>
					)}
				</div>
				{extra && <div>{extra}</div>}
			</div>
			{scope && <p className="max-w-2xl leading-relaxed text-muted-foreground">{scope}</p>}
		</header>
	);
}
