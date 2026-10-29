import { CustomThemeDialog } from "@features/theme-switcher/ui/CustomThemeDialog";
import { ThemeSettings } from "@features/theme-switcher/ui/ThemeSettings";
import { useState } from "react";

/** 移动导航内的设置内容，自定义对话框不受导航滚动区裁剪。 */
export function ThemePicker({ className }: { className?: string }) {
	const [customOpen, setCustomOpen] = useState(false);

	return (
		<>
			<ThemeSettings className={className} onCustomize={() => setCustomOpen(true)} />
			<CustomThemeDialog open={customOpen} onOpenChange={setCustomOpen} />
		</>
	);
}
