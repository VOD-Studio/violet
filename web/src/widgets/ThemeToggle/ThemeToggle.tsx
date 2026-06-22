import { Button } from "@shared/ui/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/**
 * ThemeToggle - 主题切换按钮
 *
 * 读写 next-themes（cookie 持久化），点击切换 light/dark。
 * next-themes 自动同步 <html> 的 class（dark），触发 CSS 变量切换。
 * 图标随当前主题切换 Sun/Moon，过渡动画由 Tailwind dark: 变体驱动。
 */
const ThemeToggle = () => {
	const { theme, setTheme } = useTheme();

	return (
		<Button
			variant="ghost"
			size="icon"
			aria-label="切换主题"
			onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
		>
			<Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
			<Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
		</Button>
	);
};

export default ThemeToggle;
