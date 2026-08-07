import { CubeToggle } from "./variants/cube-toggle";
import { CyclicThemeButton } from "./variants/cyclic-theme-button";
import { OrbitingPlanets } from "./variants/orbiting-planets";
import { PieMenuToggle } from "./variants/pie-menu-toggle";
import { RotaryDial } from "./variants/rotary-dial";
import { SceneButton } from "./variants/scene-button";
import { SegmentedToggle } from "./variants/segmented-toggle";
import type { ThemeVariant } from "./variants/types";

/**
 * ThemeToggle - 主题切换器（Header / AdminTopBar 操作区用）
 *
 * variant prop 选择渲染哪种切换器变体（对应 variants/ 下的原型），
 * 默认 cyclic。size 透传给所有变体，适配 Header 紧凑布局。
 */
interface ThemeToggleProps {
	variant?: ThemeVariant;
	size?: "default" | "sm";
}

const ThemeToggle = ({ variant = "cyclic", size = "sm" }: ThemeToggleProps) => {
	switch (variant) {
		case "cyclic":
			return <CyclicThemeButton size={size} />;
		case "cube":
			return <CubeToggle size={size} />;
		case "orbiting":
			return <OrbitingPlanets size={size} />;
		case "pie":
			return <PieMenuToggle size={size} />;
		case "rotary":
			return <RotaryDial size={size} />;
		case "scene":
			return <SceneButton size={size} />;
		case "segmented":
			return <SegmentedToggle size={size} />;
		default:
			return <CyclicThemeButton size={size} />;
	}
};

export default ThemeToggle;
