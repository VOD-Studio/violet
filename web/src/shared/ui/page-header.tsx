import { cn } from "cn";
import type { ReactNode } from "react";

export interface PageHeaderProps {
	/** 眉题：标题上方的英文 mono 小字（如 "All Posts"） */
	eyebrow: string;
	/** 页面主标题（如 "博客"） */
	title: string;
	/** 标题下方的静音色副标题，一句话说明页面内容；省略时不渲染 */
	description?: string;
	/** 标题右侧操作区（与标题底对齐），通常放本页主行动按钮 */
	action?: ReactNode;
	className?: string;
}

/**
 * PageHeader - 公开页面标题头
 *
 * 统一公开路由的「眉题 + mono 大标题 (+ 副标题) (+ 右侧动作)」版式：
 * 眉题 font-mono text-xs 大写宽字距静音色，标题 font-mono text-4xl 粗体。
 * 列表页传 action 时呈左右两端底对齐；不传时退化为纯标题头。
 */
export function PageHeader({ eyebrow, title, description, action, className }: PageHeaderProps) {
	const titleBlock = (
		<>
			<p className="mb-2 font-mono text-xs tracking-[0.3em] text-muted-foreground uppercase">
				{eyebrow}
			</p>
			<h1 className="font-mono text-4xl font-bold">{title}</h1>
			{description ? (
				<p className="mt-3 leading-relaxed text-muted-foreground">{description}</p>
			) : null}
		</>
	);
	if (!action) {
		return <header className={cn("mb-10", className)}>{titleBlock}</header>;
	}
	return (
		<header className={cn("mb-10 flex flex-wrap items-end justify-between gap-4", className)}>
			<div>{titleBlock}</div>
			{action}
		</header>
	);
}
