import type { Season } from "@shared/lib/theme-preference";

import { AutumnScene } from "./AutumnScene";
import { SpringScene } from "./SpringScene";
import { SummerScene } from "./SummerScene";
import { WinterScene } from "./WinterScene";

/** 四季场景组件的注册表；新增季节时在此登记。 */
export const SCENES: Record<
	Season,
	(props: { prefix: string; compact?: boolean }) => React.ReactNode
> = {
	spring: SpringScene,
	summer: SummerScene,
	autumn: AutumnScene,
	winter: WinterScene,
};

export { SceneFrame } from "./SceneFrame";
