import { CubeToggle } from "./CubeToggle";
import { CyclicAppearanceButton } from "./CyclicAppearanceButton";
import { SceneButton } from "./SceneButton";
import { SegmentedToggle } from "./SegmentedToggle";
import type { AppearanceSize, AppearanceVariant } from "./types";

/** 外观切换器的形态、尺寸与分段文字展示契约。 */
export interface AppearanceToggleProps {
	variant?: AppearanceVariant;
	size?: AppearanceSize;
	/**
	 * 在 segmented 形态显示文字并铺满容器；其他形态忽略。
	 *
	 * @default false
	 */
	showLabels?: boolean;
}

/** 切换亮色、暗色或跟随系统的外观，按宿主选择展示形态。 */
export const AppearanceToggle = ({
	variant = "segmented",
	size = "sm",
	showLabels = false,
}: AppearanceToggleProps) => {
	switch (variant) {
		case "cyclic":
			return <CyclicAppearanceButton size={size} />;
		case "cube":
			return <CubeToggle size={size} />;
		case "scene":
			return <SceneButton size={size} />;
		case "segmented":
			return <SegmentedToggle size={size} showLabels={showLabels} />;
		default:
			return <SegmentedToggle size={size} showLabels={showLabels} />;
	}
};
