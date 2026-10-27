/**
 * 飘落粒子的离屏精灵：形状先画进小画布，逐帧只贴图，避免每帧重算滤镜与渐变。
 *
 * 精灵按远近三层各带一档模糊（越远越虚）；颜色由调用方从 DOM 探针的计算值传入，
 * canvas 自身不解析 CSS 变量与 light-dark()。
 */

const SPRITE = 64;

/** 每个模糊档的精灵边长（像素）。 */
export const SPRITE_SIZE = SPRITE;

/** 远、中、近三层的模糊半径；索引即层号。 */
export const SPRITE_BLURS = [0, 1.2, 2.6] as const;

/** 给计算出的颜色加透明度；canvas 不一定认 color-mix()。 */
function withAlpha(color: string, alpha: number) {
	const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
	if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
	return color.replace(/\)$/, ` / ${alpha})`).replace(/ \/ [\d.]+ \/ /, " / ");
}

/** 在 SPRITE×SPRITE 的画布中心画形状，形状半径约为 SPRITE 的 0.3。 */
function sprite(draw: (context: CanvasRenderingContext2D, r: number) => void, blur: number) {
	const canvas = document.createElement("canvas");
	canvas.width = SPRITE;
	canvas.height = SPRITE;
	const context = canvas.getContext("2d");
	if (!context) return canvas;
	context.translate(SPRITE / 2, SPRITE / 2);
	if (blur) context.filter = `blur(${blur}px)`;
	draw(context, SPRITE * 0.3);
	return canvas;
}

function petalShape(context: CanvasRenderingContext2D, r: number) {
	context.beginPath();
	context.moveTo(0, r);
	context.bezierCurveTo(-r * 0.85, r * 0.55, -r * 0.8, -r * 0.7, -r * 0.3, -r * 0.95);
	context.quadraticCurveTo(0, -r * 0.82, 0, -r * 0.82);
	context.quadraticCurveTo(0, -r * 0.82, r * 0.3, -r * 0.95);
	context.bezierCurveTo(r * 0.8, -r * 0.7, r * 0.85, r * 0.55, 0, r);
	context.closePath();
}

function mapleShape(context: CanvasRenderingContext2D, r: number) {
	const lobes = [
		[0, -1],
		[0.16, -0.5],
		[0.6, -0.74],
		[0.42, -0.26],
		[0.96, -0.08],
		[0.42, 0.16],
		[0.56, 0.6],
		[0.1, 0.36],
		[0, 0.62],
	];
	context.beginPath();
	context.moveTo(0, -r);
	for (const [x, y] of lobes) context.lineTo(x * r, y * r);
	for (const [x, y] of [...lobes].reverse()) context.lineTo(-x * r, y * r);
	context.closePath();
}

/**
 * 生成一季全部精灵，按模糊档依次排列。
 *
 * @param colors - 探针颜色，依次为花瓣浅/中/深、萤火、落叶金/琥珀/赭红/灰绿、雪
 */
export function buildParticleSprites(
	season: "spring" | "summer" | "autumn" | "winter",
	colors: string[],
): HTMLCanvasElement[] {
	const sprites: HTMLCanvasElement[] = [];
	for (const blur of SPRITE_BLURS) {
		switch (season) {
			case "spring":
				for (const [edge, mid, core] of [
					[0, 1, 2],
					[0, 0, 1],
					[1, 1, 2],
				]) {
					sprites.push(
						sprite((context, r) => {
							const gradient = context.createRadialGradient(
								0,
								r,
								0,
								0,
								r * 0.2,
								r * 1.6,
							);
							gradient.addColorStop(0, colors[core]);
							gradient.addColorStop(0.35, colors[mid]);
							gradient.addColorStop(1, colors[edge]);
							context.fillStyle = gradient;
							petalShape(context, r);
							context.fill();
						}, blur),
					);
				}
				break;
			case "summer":
				sprites.push(
					sprite((context, r) => {
						const glow = context.createRadialGradient(0, 0, 0, 0, 0, r * 1.5);
						glow.addColorStop(0, colors[3]);
						glow.addColorStop(0.12, colors[3]);
						glow.addColorStop(0.3, withAlpha(colors[3], 0.35));
						glow.addColorStop(1, withAlpha(colors[3], 0));
						context.fillStyle = glow;
						context.beginPath();
						context.arc(0, 0, r * 1.5, 0, Math.PI * 2);
						context.fill();
					}, blur),
				);
				break;
			case "autumn":
				for (const tone of [4, 5, 6, 7]) {
					sprites.push(
						sprite((context, r) => {
							context.fillStyle = colors[tone];
							mapleShape(context, r);
							context.fill();
							// 叶柄一侧压暗，叶尖一侧提亮
							const shade = context.createLinearGradient(0, r, 0, -r);
							shade.addColorStop(0, "rgba(0, 0, 0, 0.22)");
							shade.addColorStop(1, "rgba(255, 255, 255, 0.12)");
							context.globalCompositeOperation = "source-atop";
							context.fillStyle = shade;
							context.fillRect(-r, -r, r * 2, r * 2);
							context.globalCompositeOperation = "source-over";
							context.strokeStyle = "rgba(255, 255, 255, 0.5)";
							context.globalAlpha = 0.45;
							context.lineWidth = 1;
							context.beginPath();
							context.moveTo(0, r * 0.62);
							context.lineTo(0, -r * 0.8);
							context.moveTo(0, r * 0.1);
							context.lineTo(r * 0.62, -r * 0.5);
							context.moveTo(0, r * 0.1);
							context.lineTo(-r * 0.62, -r * 0.5);
							context.stroke();
						}, blur),
					);
				}
				break;
			default:
				sprites.push(
					sprite((context, r) => {
						const flake = context.createRadialGradient(0, 0, 0, 0, 0, r);
						flake.addColorStop(0, colors[8]);
						flake.addColorStop(0.55, withAlpha(colors[8], 0.75));
						flake.addColorStop(1, withAlpha(colors[8], 0));
						context.fillStyle = flake;
						context.beginPath();
						context.arc(0, 0, r, 0, Math.PI * 2);
						context.fill();
					}, blur),
				);
		}
	}
	return sprites;
}
