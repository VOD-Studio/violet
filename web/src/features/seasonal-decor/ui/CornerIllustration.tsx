/**
 * 视口角落的大幅插画：定位与径向淡出遮罩按季节配置，挂载即生长。
 */
import type { Season } from "@shared/lib/theme-preference";

import { SCENES, SceneFrame } from "./scene";

const CORNER: Record<Season, { viewBox: string; className: string }> = {
	spring: {
		viewBox: "0 0 640 470",
		className:
			"top-0 right-0 w-[min(44vw,640px)] [mask-image:radial-gradient(circle_at_100%_0%,var(--background)_60%,transparent_95%)]",
	},
	summer: {
		viewBox: "0 0 600 380",
		className:
			"bottom-0 left-0 w-[min(44vw,600px)] [mask-image:radial-gradient(circle_at_0%_100%,var(--background)_62%,transparent_95%)]",
	},
	autumn: {
		viewBox: "0 0 640 470",
		className:
			"top-0 right-0 w-[min(44vw,640px)] [mask-image:radial-gradient(circle_at_100%_0%,var(--background)_62%,transparent_96%)]",
	},
	winter: {
		viewBox: "0 0 600 430",
		className:
			"top-0 left-0 w-[min(44vw,600px)] [mask-image:radial-gradient(circle_at_0%_0%,var(--background)_60%,transparent_95%)]",
	},
};

/** 角落插画。 */
export function CornerIllustration({ season }: { season: Season }) {
	const SceneContent = SCENES[season];
	const corner = CORNER[season];
	return (
		<SceneFrame key={season} viewBox={corner.viewBox} className={corner.className}>
			{(prefix) => <SceneContent prefix={prefix} />}
		</SceneFrame>
	);
}
