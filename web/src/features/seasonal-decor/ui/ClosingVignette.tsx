/**
 * 点缀位插槽：首页收尾寄语上方的小幅插画，进入视口才开始生长。
 */
import { useDecorationLayers } from "../hooks/useDecorationLayers";
import { useDecorationSeason } from "../hooks/useDecorationSeason";
import styles from "../scene.module.css";
import { SCENES, SceneFrame } from "./scene";

/** 点缀位装饰；未投放季节时不渲染。 */
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
				viewBox="0 0 230 110"
				className="left-1/2 block h-22 w-46 -translate-x-1/2"
				playOnView
			>
				{(prefix) => <SceneContent prefix={prefix} compact />}
			</SceneFrame>
		</div>
	);
}
