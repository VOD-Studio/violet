/**
 * 背景层插槽：视口角落的大幅插画与整幅飘落粒子，挂在 SiteBackdrop 内。
 *
 * 画布尺寸与粒子位置依赖随机数，只在客户端 effect 中生成；SSR 输出空的画布与
 * 颜色探针，不产生水合差异。
 */

import { useDecorationSeason } from "../hooks/useDecorationSeason";
import { CornerIllustration } from "./CornerIllustration";
import { SeasonParticles } from "./SeasonParticles";

/** 背景层装饰；未投放季节时不渲染。 */
export function SeasonBackdrop() {
	const season = useDecorationSeason();
	if (!season) return null;
	return (
		<>
			<CornerIllustration season={season} />
			<SeasonParticles key={season} season={season} />
		</>
	);
}
