import type { Season } from "@shared/lib/theme-preference";
import { useDecorationLayers } from "../hooks/useDecorationLayers";
import { useDecorationSeason } from "../hooks/useDecorationSeason";
import styles from "../scene.module.css";
import { SCENES, SceneFrame } from "./scene";

// 各 compact 场景独立取景，并为描边、滤镜扰动与花叶旋转留出余量。
const COMPACT_VIEW_BOX: Record<Season, string> = {
	// 桃枝右端超过 x=278，顶部花瓣越过 y=-13。
	spring: "-12 -28 304 136",
	// 荷叶下缘约 y=116；蜻蜓双翼在 (186, 42) 周围轻颤。
	summer: "-4 16 216 108",
	// 桂叶绕叶柄展开的包络约为 (52, -12) 至 (224, 122)。
	autumn: "40 -24 196 160",
	// 枯枝中心线覆盖 y=-26 至 132，另留积雪厚度与描边余量。
	winter: "-12 -44 240 196",
};

/**
 * 首页收尾寄语上方的小幅季节插画。
 *
 * @remarks 进入视口后播放；未投放季节或关闭插画层时不渲染。
 */
export function ClosingVignette() {
	const season = useDecorationSeason();
	const layers = useDecorationLayers();
	if (!season || !layers.illustration) return null;
	const SceneContent = SCENES[season];
	return (
		<div
			aria-hidden="true"
			data-decoration-slot="accent"
			className={`${styles.accent} pointer-events-none absolute inset-x-0 top-5 h-22 sm:top-8`}
		>
			<SceneFrame
				key={season}
				viewBox={COMPACT_VIEW_BOX[season]}
				className="left-1/2 block h-22 w-46 -translate-x-1/2"
				playOnView
			>
				{(prefix) => <SceneContent prefix={prefix} compact />}
			</SceneFrame>
		</div>
	);
}
