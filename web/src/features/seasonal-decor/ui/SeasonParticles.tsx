/**
 * 一季飘落粒子的画布与颜色探针；探针隐藏但参与布局计算，canvas 才能取到
 * 各档主题色在当前外观下的计算值。
 */

import type { Season } from "@shared/lib/theme-preference";
import { PARTICLE_PROBES, useSeasonParticles } from "../hooks/useSeasonParticles";

/** 粒子层。 */
export function SeasonParticles({ season }: { season: Season }) {
	const { canvasRef, probeRef } = useSeasonParticles(season);
	return (
		<>
			<span ref={probeRef} aria-hidden="true" className="hidden">
				{PARTICLE_PROBES.map((color) => (
					<span key={color} style={{ color }} />
				))}
			</span>
			<canvas ref={canvasRef} className="absolute inset-0 size-full" />
		</>
	);
}
