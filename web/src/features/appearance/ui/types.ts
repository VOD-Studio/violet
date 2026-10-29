import type { ReactNode } from "react";

/**
 * 外观切换器的三态选项。
 */
export type AppearanceOption = "light" | "dark" | "system";

/**
 * 每个外观选项的展示配置。
 */
export interface AppearanceChoice {
	value: AppearanceOption;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}

/**
 * 外观切换器可渲染的变体。
 */
export type AppearanceVariant = "cyclic" | "cube" | "scene" | "segmented";

/**
 * 切换器尺寸档位。
 *
 * lg / default 用于实验页尺寸陈列，sm 用于 Header/AdminTopBar 紧凑操作区。
 */
export type AppearanceSize = "lg" | "default" | "sm";

/**
 * VariantProps - 所有变体共享的尺寸 prop。
 */
export interface VariantProps {
	size?: AppearanceSize;
}

/**
 * 外观变体组件的统一签名。
 */
export type AppearanceVariantComponent = (props: VariantProps) => ReactNode;
