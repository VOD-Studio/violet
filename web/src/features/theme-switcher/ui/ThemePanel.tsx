import { ThemeSettings } from "@features/theme-switcher/ui/ThemeSettings";
import type { ReactNode } from "react";

/** 外观设置内容与宿主的组合契约。 */
export interface ThemePanelProps {
	/** 明、暗、跟随系统的切换器；省略时不渲染外观分组。 */
	appearance?: ReactNode;
	/** 打开宿主维护的自定义主题对话框，设置面板保持挂载。 */
	onCustomize: () => void;
}

/** 统一呈现外观、主题配色与装饰设置，不持有弹层或触发器。 */
export function ThemePanel({ appearance, onCustomize }: ThemePanelProps) {
	return (
		<div className="space-y-4 p-4">
			<h2 className="font-serif text-base font-medium text-foreground">季节与外观</h2>
			{appearance != null && (
				<section aria-label="外观" className="space-y-2">
					<h3 className="text-xs font-medium text-muted-foreground">外观</h3>
					{appearance}
				</section>
			)}
			<ThemeSettings onCustomize={onCustomize} />
		</div>
	);
}
