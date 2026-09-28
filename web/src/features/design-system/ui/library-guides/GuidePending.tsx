import { cn } from "cn";

interface GuidePendingProps {
	/** 条目名称，如框架或能力名 */
	title: string;
	/** 补充说明，默认「暂未开放」 */
	children?: string;
	/** 外部布局类 */
	className?: string;
}

/**
 * 指南里「暂未开放」条目的朦胧卡片：毛玻璃叠层压低对比度，
 * 内容降不透明度并禁用交互，与可用条目形成一眼可辨的界线。
 */
export function GuidePending({ title, children, className }: GuidePendingProps) {
	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-2xl border border-border/60 select-none",
				className,
			)}
		>
			<div
				aria-hidden="true"
				className="absolute inset-0 bg-gradient-to-br from-muted/70 via-background/30 to-muted/60 backdrop-blur-sm"
			/>
			<div className="relative flex items-center justify-between gap-3 p-4 opacity-60">
				<span className="text-sm font-medium text-muted-foreground">{title}</span>
				<span className="shrink-0 rounded-full border border-border/60 bg-background/50 px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
					{children ?? "暂未开放"}
				</span>
			</div>
		</div>
	);
}
