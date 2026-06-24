import type { ReactNode } from "react";
import { cn } from "@shared/lib/utils";

export interface EmptyProps {
	/** 标题（必填） */
	title: string;
	/** 描述文案（可选） */
	description?: string;
	/** 操作区（可选，通常放 <Button>） */
	action?: ReactNode;
	/** 尺寸 */
	size?: "sm" | "md" | "lg";
	className?: string;
}

const ICON = {
	sm: "size-6",
	md: "size-8",
	lg: "size-10",
};

/**
 * Empty - 空状态（柔和阅读风）
 *
 * 极简：一个柔和的空心圆图标 + 标题 + 描述 + 可选操作。
 * 克制不抢戏，任何场景适用。
 *
 * 通用用法：
 * <Empty title="暂无文章" description="还没有发布任何内容" action={<Button>写一篇</Button>} />
 */
const Empty = ({ title, description, action, size = "md", className }: EmptyProps) => {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-3 text-center",
				className,
			)}
			role="status"
		>
			{/* 空心圆图标（柔和描边） */}
			<div
				className={cn(
					"flex items-center justify-center rounded-full border border-border text-muted-foreground/40",
					ICON[size],
				)}
				aria-hidden
			>
				<span className="text-lg leading-none">·</span>
			</div>

			<div className="space-y-1">
				<p className="text-sm font-medium text-muted-foreground">{title}</p>
				{description ? <p className="text-xs text-muted-foreground/70">{description}</p> : null}
			</div>

			{action ? <div className="mt-1">{action}</div> : null}
		</div>
	);
};

export default Empty;
