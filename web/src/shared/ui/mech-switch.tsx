import * as React from "react";
import { cn } from "@shared/lib/utils";

/**
 * MechSwitchProps - 机械青轴键帽
 */
export interface MechSwitchProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	/** 键帽内显图标/文字 */
	children?: React.ReactNode;
	/** 是否处于「按下/激活」状态（如 dark mode） */
	pressed?: boolean;
	/** aria-label */
	"aria-label"?: string;
}

/**
 * MechSwitch - 机械青轴 3D 键帽原语
 *
 * 严格遵守 spec：
 * - Hover：不缩放、不位移，仅环境光/材质反射率变化（box-shadow 边缘光晕）
 * - Active/pressed：translateY(3px) 下压，阴影同步收缩
 * - 所有位移在自身 Bounding Box 内消化，绝不引起周围 reflow
 *
 * 物理质感由 CSS 变量驱动：
 * - Dark：阳极氧化铝（冷蓝边光 + 高光）
 * - Light：复古哑光高密度塑料（柔阴影 + 极细 1px 边框）
 */
const MechSwitch = React.forwardRef<HTMLButtonElement, MechSwitchProps>(
	({ className, children, pressed, ...props }, ref) => {
		return (
			<button
				ref={ref}
				type="button"
				aria-pressed={pressed}
				data-pressed={pressed ? "1" : "0"}
				className={cn(
					"relative isolate inline-grid place-items-center",
					"h-11 w-11 rounded-[10px]",
					"font-mono text-sm select-none",
					// 底座（永远固定，不参与按压动画 → 无 reflow）
					"before:absolute before:inset-0 before:rounded-[10px] before:-z-10",
					"before:translate-y-1 before:bg-border",
					// 键帽（3D 下压仅在自身 box 内）
					"after:absolute after:inset-0 after:rounded-[10px] after:-z-10",
					// Hover：仅环境光/反射率，无 scale/位移
					"hover:after:brightness-110 dark:hover:after:brightness-125",
					"transition-[transform,box-shadow] duration-75 ease-out",
					"active:translate-y-[3px]",
					pressed && "translate-y-[3px]",
					// 取消浏览器默认 focus 黑框，改 ring
					"outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
					className,
				)}
				style={{
					// 键帽渐变质感（CSS 变量随主题切换）
					background:
						"linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 100%)",
					boxShadow: pressed
						? "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.2)"
						: "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 0 rgba(0,0,0,0.25), var(--shadow-physical)",
				}}
				{...props}
			>
				{children}
			</button>
		);
	},
);
MechSwitch.displayName = "MechSwitch";

export { MechSwitch };
