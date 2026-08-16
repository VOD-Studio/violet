import { CubeToggle } from "./CubeToggle";
import { CyclicThemeButton } from "./CyclicThemeButton";
import { SceneButton } from "./SceneButton";
import { SegmentedToggle } from "./SegmentedToggle";
import type { ThemeSize, ThemeVariant } from "./types";

/**
 * ThemeToggle - 主题切换器
 */
interface ThemeToggleProps {
	/** 主题切换器变体 */
	variant?: ThemeVariant;
	/** 主题切换器尺寸 */
	size?: ThemeSize;
}

const ThemeToggle = ({ variant = "segmented", size = "sm" }: ThemeToggleProps) => {
	switch (variant) {
		case "cyclic":
			return <CyclicThemeButton size={size} />;
		case "cube":
			return <CubeToggle size={size} />;
		case "scene":
			return <SceneButton size={size} />;
		case "segmented":
			return <SegmentedToggle size={size} />;
		default:
			return <SegmentedToggle size={size} />;
	}
};

export default ThemeToggle;
