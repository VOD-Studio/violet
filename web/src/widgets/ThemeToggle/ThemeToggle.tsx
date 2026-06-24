import { MechSwitch } from "@shared/ui/mech-switch";
import { useThemeTransition } from "@shared/ui/theme-transition";
import { Moon, Sun } from "lucide-react";

/**
 * ThemeToggle - 机械轴体主题切换器
 *
 * spec：放置首屏底部 20% 区域极左侧边缘（位置由父容器控制）。
 * - Hover：仅环境光/反射率，不缩放不位移（由 MechSwitch 保证）
 * - Active：键帽 translateY(3px) 下压，自身 box 内消化，无 reflow
 * - 切换：触发 useThemeTransition 的 clip-path 圆形扩散（非闪烁）
 *
 * 仍走 next-themes 的 class 注入 + cookie 持久化（保留架构）。
 * pressed 反映当前是否 dark。
 */
const ThemeToggle = () => {
	const { toggle, theme } = useThemeTransition();
	const isDark = theme === "dark";

	return (
		<MechSwitch aria-label="切换主题" pressed={isDark} onClick={(e) => toggle(e)}>
			{isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
		</MechSwitch>
	);
};

export default ThemeToggle;
