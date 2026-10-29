import { CubeToggle } from "./CubeToggle";
import { CyclicAppearanceButton } from "./CyclicAppearanceButton";
import { SceneButton } from "./SceneButton";
import { SegmentedToggle } from "./SegmentedToggle";
import type { AppearanceSize, AppearanceVariant } from "./types";

/**
 * 外观切换器配置。
 */
interface AppearanceToggleProps {
	/** 外观切换器变体 */
	variant?: AppearanceVariant;
	/** 外观切换器尺寸 */
	size?: AppearanceSize;
}

export const AppearanceToggle = ({ variant = "segmented", size = "sm" }: AppearanceToggleProps) => {
	switch (variant) {
		case "cyclic":
			return <CyclicAppearanceButton size={size} />;
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
