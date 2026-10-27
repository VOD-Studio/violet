/**
 * 点缀位插槽：首页收尾寄语上方的小幅插画，进入视口才开始生长。
 */
import { useDecorationSeason } from "../hooks/useDecorationSeason";
import { SCENES, SceneFrame } from "./scene";

/** 点缀位装饰；未投放季节时不渲染。 */
export function ClosingVignette() {
	const season = useDecorationSeason();
	if (!season) return null;
	const SceneContent = SCENES[season];
	return (
		<SceneFrame
			key={season}
			viewBox="0 0 230 110"
			className="relative! mx-auto mb-6 block h-22"
			playOnView
		>
			{(prefix) => <SceneContent prefix={prefix} compact />}
		</SceneFrame>
	);
}
