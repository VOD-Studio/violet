/**
 * 一季飘落粒子的画布与颜色探针；探针挂调色板类读各档主题色在当前外观下的计算值，
 * canvas 才能取到颜色。
 */
import type { Season } from "@shared/lib/theme-preference";
import { useSeasonParticles } from "../hooks/useSeasonParticles";
import { PARTICLE_PROBES } from "../lib/particle-sprites";
import styles from "../scene.module.css";

/** 粒子层。 */
export function SeasonParticles({ season }: { season: Season }) {
	const { canvasRef, probeRef } = useSeasonParticles(season);
	return (
		<>
			<span ref={probeRef} aria-hidden="true" className={`hidden ${styles.palette}`}>
				{PARTICLE_PROBES.map((color) => (
					<span key={color} style={{ color }} />
				))}
			</span>
			<canvas ref={canvasRef} className="absolute inset-0 size-full" />
		</>
	);
}
