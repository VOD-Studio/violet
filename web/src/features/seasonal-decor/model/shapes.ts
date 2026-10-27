/**
 * 花瓣与叶片的 path 生成：原点都是着生点（叶柄/花瓣基部），向上生长，
 * 场景组件用 translate + rotate 摆到枝条上。
 */

/** 桃花瓣：宽圆、瓣尖微凹。 */
export function petalPath(r: number) {
	return `M0,0 C${(-0.42 * r).toFixed(1)},${(-0.14 * r).toFixed(1)} ${(-0.58 * r).toFixed(1)},${(-0.66 * r).toFixed(1)} ${(-0.34 * r).toFixed(1)},${(-0.94 * r).toFixed(1)} C${(-0.2 * r).toFixed(1)},${(-1.06 * r).toFixed(1)} ${(-0.05 * r).toFixed(1)},${(-1.02 * r).toFixed(1)} 0,${(-0.96 * r).toFixed(1)} C${(0.05 * r).toFixed(1)},${(-1.02 * r).toFixed(1)} ${(0.2 * r).toFixed(1)},${(-1.06 * r).toFixed(1)} ${(0.34 * r).toFixed(1)},${(-0.94 * r).toFixed(1)} C${(0.58 * r).toFixed(1)},${(-0.66 * r).toFixed(1)} ${(0.42 * r).toFixed(1)},${(-0.14 * r).toFixed(1)} 0,0 Z`;
}

/** 披针形叶片。 */
export function leafPath(length: number, width: number) {
	return `M0,0 C${width.toFixed(1)},${(-length * 0.25).toFixed(1)} ${(width * 0.9).toFixed(1)},${(-length * 0.7).toFixed(1)} 0,${(-length).toFixed(1)} C${(-width * 0.9).toFixed(1)},${(-length * 0.7).toFixed(1)} ${(-width).toFixed(1)},${(-length * 0.25).toFixed(1)} 0,0 Z`;
}
