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
