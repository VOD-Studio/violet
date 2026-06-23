import { cn } from "@shared/lib/utils";
import { useSpotlight } from "@shared/lib/hooks/use-spotlight";
import * as React from "react";

export interface SpotlightCardProps
	extends React.HTMLAttributes<HTMLDivElement> {
	/** 聚光半径（px） */
	radius?: number;
	/** 渲染的根元素类型 */
	as?: React.ElementType;
}

/**
 * SpotlightCard - 全局边缘聚光灯卡片
 *
 * spec：冷光跟随鼠标游走于卡片边缘，揭示材质边界。
 * - 鼠标移动 → useSpotlight 写 --spot-x/--spot-y
 * - 聚光层用 radial-gradient 在该点画冷光（hover 显现）
 * - 渐变边框层：dark 霓虹冷蓝 inset 发光 / light 由 1px 边框承担
 *
 * Dark：深色毛玻璃 + 边缘霓虹冷蓝发光
 * Light：超柔多层物理阴影 + 1px rgba(0,0,0,0.05) 边框（无发光）
 */
function SpotlightCard({
	className,
	children,
	radius = 220,
	as: Comp = "div",
	...props
}: SpotlightCardProps) {
	const onMove = useSpotlight();
	return (
		<Comp
			onMouseMove={onMove}
			className={cn(
				"group relative overflow-hidden rounded-xl",
				"bg-card text-card-foreground",
				"border border-edge-hairline",
				"transition-[box-shadow,transform] duration-300",
				// dark 毛玻璃 + glow；light 多层柔阴影（由 --shadow-physical 控制）
				"dark:bg-surface-glass/60 dark:backdrop-blur-xl",
				"shadow-[var(--shadow-physical)]",
				className,
			)}
			style={
				{
					"--spot-radius": `${radius}px`,
					...props.style,
				} as React.CSSProperties
			}
			{...props}
		>
			{/* 聚光层 */}
			<span
				aria-hidden
				className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
				style={{
					background:
						"radial-gradient(var(--spot-radius) circle at var(--spot-x, 50%) var(--spot-y, 50%), hsl(var(--glow-soft) / 0.18), transparent 60%)",
				}}
			/>
			{/* 渐变边框层（dark 霓虹） */}
			<span
				aria-hidden
				className="pointer-events-none absolute inset-0 hidden rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:block"
				style={{
					boxShadow:
						"inset 0 0 0 1px hsl(var(--neon-blue) / 0.35), inset 0 0 24px hsl(var(--neon-blue) / 0.08)",
				}}
			/>
			<div className="relative z-10">{children}</div>
		</Comp>
	);
}

export { SpotlightCard };
