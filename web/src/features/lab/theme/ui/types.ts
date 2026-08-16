import type { ReactNode } from "react";

/**
 * ThemeOption - 主题切换器的三态选项
 */
export type ThemeOption = "light" | "dark" | "system";

/**
 * ThemeChoice - 每个选项的展示配置
 */
export interface ThemeChoice {
	value: ThemeOption;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}

/**
 * ThemeVariant - ThemeToggle 可渲染的切换器变体
 *
 * 对应同目录的各原型组件，ThemeToggle 按 variant prop 分发。
 */
export type ThemeVariant =
	| "cyclic"
	| "cube"
	| "orbiting"
	| "pie"
	| "rotary"
	| "scene"
	| "segmented";

/**
 * ThemeSize - 切换器尺寸档位
 *
 * default 用于 theme-lab 展示，sm 用于 Header/AdminTopBar 紧凑操作区。
 */
export type ThemeSize = "default" | "sm";

/**
 * VariantProps - 所有变体共享的尺寸 prop。
 */
export interface VariantProps {
	size?: ThemeSize;
}

/**
 * ThemeVariantComponent - 变体组件的统一签名。
 */
export type ThemeVariantComponent = (props: VariantProps) => ReactNode;
