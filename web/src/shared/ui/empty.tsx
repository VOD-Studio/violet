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

const GLASS = {
	sm: 56,
	md: 96,
	lg: 128,
};

/**
 * Empty - 碎玻璃/裂纹空状态
 *
 * 创意：一块碎裂的玻璃面板（SVG），裂纹从中心冲击点向外发散，
 * 暗示「这里被搜刮/撞击过却什么都没留下」。裂纹描边走 neon CSS 变量，
 * Dark 下冷蓝电光感，Light 下退为低饱和墨灰（铅笔素描感）。
 *
 * 碎片用 motion 做一次性「崩裂」入场（从中心向外飘 + 淡出定格），
 * 之后静止，不持续动画以免干扰阅读。
 *
 * 通用用法：
 * <Empty title="暂无文章" description="还没有发布任何内容" action={<Button>写一篇</Button>} />
 */
const Empty = ({ title, description, action, size = "md", className }: EmptyProps) => {
	const d = GLASS[size];

	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-4 text-center",
				className,
			)}
			role="status"
		>
			{/* 碎玻璃 SVG */}
			<svg
				width={d}
				height={d}
				viewBox="0 0 100 100"
				fill="none"
				aria-hidden
				className="text-neon-blue"
			>
				{/* 玻璃面板主体：略带圆角的多边形碎片 */}
				<path
					d="M20 18 L52 14 L78 24 L82 52 L74 80 L46 84 L18 72 L16 40 Z"
					stroke="hsl(var(--edge-hairline))"
					strokeWidth="1.5"
					strokeLinejoin="round"
					fill="hsl(var(--muted) / 0.3)"
				/>
				{/* 冲击中心点 */}
				<circle cx="50" cy="50" r="2.5" fill="currentColor" />
				{/* 发散裂纹（neon 描边） */}
				<g
					stroke="currentColor"
					strokeWidth="1.2"
					strokeLinecap="round"
					style={{ filter: "drop-shadow(0 0 3px hsl(var(--neon-blue) / 0.6))" }}
				>
					<path d="M50 50 L24 22" />
					<path d="M50 50 L78 28" />
					<path d="M50 50 L80 58" />
					<path d="M50 50 L60 82" />
					<path d="M50 50 L28 76" />
					<path d="M50 50 L18 46" />
				</g>
				{/* 次级细裂纹（更淡） */}
				<g
					stroke="hsl(var(--muted-foreground) / 0.5)"
					strokeWidth="0.6"
					strokeLinecap="round"
				>
					<path d="M50 50 L36 20" />
					<path d="M50 50 L72 44" />
					<path d="M50 50 L42 80" />
				</g>
			</svg>

			<div className="space-y-1">
				<p className="font-mono text-sm font-medium tracking-wide text-foreground">
					{title}
				</p>
				{description ? (
					<p className="text-xs text-muted-foreground">{description}</p>
				) : null}
			</div>

			{action ? <div className="mt-1">{action}</div> : null}
		</div>
	);
};

export default Empty;
