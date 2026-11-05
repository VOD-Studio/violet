"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps, CSSProperties } from "react";
import { useDelayedBusy } from "../indicator";

/** 梅花指示器的五瓣，按 72° 等分；绘制延迟由 `--i` 交给样式表。 */
const PETALS = [0, 1, 2, 3, 4] as const;

/** 开关档位：小 28×16，中 36×20，大 44×24（触屏）。 */
export type SwitchSize = "sm" | "md" | "lg";

/**
 * 保留 Radix Switch.Root 的受控、表单与原生 button 属性。
 *
 * @remarks 名称使用 `aria-labelledby` 或 `aria-label`；失败原因由使用方渲染，并通过 `aria-describedby` 关联。
 */
export interface SwitchProps
	extends Omit<ComponentProps<typeof SwitchPrimitive.Root>, "asChild" | "children"> {
	/** 默认 md。 */
	size?: SwitchSize;
	/**
	 * 等待服务端确认：圆钮里出现梅花指示器，`aria-busy="true"`，点击与键盘激活被忽略。
	 * 外观仍跟随 `checked`，由使用方乐观翻转，失败时翻回。
	 */
	loading?: boolean;
}

/** 点了立即生效的一项设置；只有圆钮平移，轨道只变色。 */
export function Switch({
	size = "md",
	loading = false,
	className,
	onClick,
	...props
}: SwitchProps) {
	const spinnerVisible = useDelayedBusy(Boolean(loading));
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			data-size={size}
			data-loading={loading ? "" : undefined}
			aria-busy={loading ? true : undefined}
			className={className ? `v-switch ${className}` : "v-switch"}
			{...props}
			onClick={(event) => {
				if (loading) {
					event.preventDefault();
					return;
				}
				onClick?.(event);
			}}
		>
			<SwitchPrimitive.Thumb data-slot="switch-thumb" className="v-switch__thumb">
				{spinnerVisible ? (
					<svg
						className="v-switch__indicator"
						viewBox="0 0 24 24"
						aria-hidden="true"
						focusable="false"
					>
						{PETALS.map((petal) => (
							<circle
								key={petal}
								cx="12"
								cy="6.4"
								r="3.6"
								pathLength={1}
								transform={`rotate(${petal * 72} 12 12)`}
								style={{ "--i": petal } as CSSProperties}
							/>
						))}
					</svg>
				) : null}
			</SwitchPrimitive.Thumb>
		</SwitchPrimitive.Root>
	);
}
