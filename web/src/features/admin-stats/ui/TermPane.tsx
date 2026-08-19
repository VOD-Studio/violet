import { cn } from "@shared/lib/utils";
import type { ReactNode } from "react";

interface TermPaneProps {
	/** mono 路径小签（如 ~/trend、~/top） */
	tag: string;
	/** 中文标题 */
	title: string;
	/** 标题行右侧附注（如图例） */
	trailing?: ReactNode;
	children: ReactNode;
	/** 内容区是否填满剩余高度 */
	fill?: boolean;
	className?: string;
}

/**
 * TermPane - 终端窗格外壳。
 *
 * 概览驾驶舱的区块容器：mono 路径小签 + hairline 标题行 + 内容区，
 * 取代 shadcn 大圆角卡片——后台信息面板与前台 terminal-card 共享
 * 同一视觉身份，而非通用 admin 模板脸。
 */
export function TermPane({
	tag,
	title,
	trailing,
	children,
	fill = true,
	className,
}: TermPaneProps) {
	return (
		<section
			className={cn(
				"border-edge-hairline bg-card flex flex-col rounded-sm border",
				className,
			)}
		>
			<header className="border-edge-hairline flex h-10 items-center gap-2.5 border-b px-4">
				<span className="bg-emerald-500 size-1.5 shrink-0 rounded-full" aria-hidden />
				<span className="text-muted-foreground font-mono text-xs">{tag}</span>
				<span className="text-foreground text-sm font-medium">{title}</span>
				{trailing && <div className="ml-auto flex items-center">{trailing}</div>}
			</header>
			<div className={cn("p-4", fill && "min-h-0 flex-1")}>{children}</div>
		</section>
	);
}
