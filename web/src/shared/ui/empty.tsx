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

const RING = {
	sm: 56,
	md: 96,
	lg: 128,
};

/**
 * Empty - 发光圆环 + 噪点容器
 *
 * 创意：一个 neon 描边的细圆环（容器感），内部铺极淡的网格点，
 * 暗示「这里本该有内容，现在是空的容器」。精致不消极。
 *
 * 描边与发光走 CSS 变量：Dark 下冷蓝电光（neon-blue glow），
 * Light 下退为低饱和墨灰细线（铅笔素描感，无 glow）。
 * 内部网格点用 radial-gradient 平铺，零额外 DOM。
 *
 * 通用用法：
 * <Empty title="暂无文章" description="还没有发布任何内容" action={<Button>写一篇</Button>} />
 */
const Empty = ({ title, description, action, size = "md", className }: EmptyProps) => {
	const d = RING[size];

	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-4 text-center",
				className,
			)}
			role="status"
		>
			{/* 发光圆环容器 */}
			<div
				className="relative rounded-full"
				style={{
					width: d,
					height: d,
					// neon 描边 + glow（Dark 电光感；Light 下 glow-soft 退化为白，近乎无 glow）
					boxShadow:
						"inset 0 0 0 1px hsl(var(--neon-blue) / 0.55), 0 0 16px hsl(var(--glow-soft) / 0.18)",
					// 内部极淡网格点（径向小点平铺，零额外 DOM）
					backgroundImage:
						"radial-gradient(hsl(var(--muted-foreground) / 0.25) 1px, transparent 1px)",
					backgroundSize: `${d / 8}px ${d / 8}px`,
				}}
			>
				{/* 环上一个细小的发光点，打破纯圆的单调 */}
				<span
					className="absolute rounded-full bg-neon-blue"
					style={{
						width: d * 0.06,
						height: d * 0.06,
						top: -(d * 0.03),
						left: "50%",
						marginLeft: -(d * 0.03),
						boxShadow: "0 0 8px hsl(var(--neon-blue) / 0.9)",
					}}
				/>
			</div>

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
