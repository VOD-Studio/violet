import { Button } from "@shared/ui/base/button";
import { useThemeTransition } from "@shared/ui/theme-transition";
import { Moon, Sun } from "lucide-react";

/**
 * ThemeToggle - 主题切换按钮
 *
 * 普通 ghost icon 按钮（与 Header 操作区风格一致）。
 * 切换动画仍走 useThemeTransition 的 View Transitions 圆形扩散（非闪烁）。
 * next-themes 的 class 注入 + cookie 持久化不变（保留架构）。
 */
const ThemeToggle = () => {
	const { toggle, theme } = useThemeTransition();
	const isDark = theme === "dark";

	return (
		<Button variant="ghost" size="icon-sm" aria-label="切换主题" onClick={(e) => toggle(e)}>
			{isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
		</Button>
	);
};

export default ThemeToggle;
