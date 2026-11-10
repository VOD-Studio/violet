/**
 * 荧光笔笔触的颜色。
 *
 * 笔触是手绘的不规则形状：每段划线拆成左端、中段、右端三层背景，两端固定宽度保持圆头，
 * 只有中段随文字拉伸；每种形状有 a、b 两个变体，相邻行交替避免一模一样。背景图是 SVG，
 * 读不到页面的 CSS 变量，所以按当前季节与明暗解析出颜色，生成 data URI 写进 :root 的自定义属性，
 * 由 annotations.css 与 SelectionHighlight 取用。
 */

/** 形状路径：[a 变体, b 变体]，坐标系与 VIEWBOX 对应。 */
const SHAPES = {
	capl: [
		"M10 2.6C6.2 2 2.6 3.6 1.8 8 1.2 11.4 1.4 15.2 3 17.4 4.6 19.2 7.6 18.8 10 18.6Z",
		"M10 2.4C6 2.4 2.8 3 1.6 7 .8 10.6 1.2 14.6 2.6 17 4 19 7.4 18.4 10 18.6Z",
	],
	mid: [
		"M0 2.6C20 1.8 40 3 60 2.2S90 2.8 100 2.4V18.6C80 19.4 60 18 40 18.8S12 18.2 0 18.6Z",
		"M0 2.6C16 3.2 36 1.8 58 2.8S88 2 100 2.4V18.6C84 18 64 19.2 44 18.2S14 19 0 18.6Z",
	],
	capr: [
		"M0 2.4C4.2 2.8 8.4 2 9.4 6.8 10 10.4 9.6 14.2 8.4 16.8 7 19.4 3.6 18 0 18.6Z",
		"M0 2.4C4 2 8 3.2 9.2 7.4 10.1 11 9.4 14.6 8 17.2 6.6 19.2 3 18.2 0 18.6Z",
	],
} as const;

const VIEWBOX = { capl: "0 0 10 20", mid: "0 0 100 20", capr: "0 0 10 20" } as const;

/**
 * 笔触状态与颜色：季节色 22% 的底，悬停 34%，点开与写批注时 38%，选区用强调色 22%。
 * 自定义属性名为 `--annotation-<name>-<part>-<variant>`，如 `--annotation-saved-capl-a`。
 */
const STATES = [
	{ name: "saved", token: "--decoration", alpha: 0.22 },
	{ name: "saved-hover", token: "--decoration", alpha: 0.34 },
	{ name: "active", token: "--decoration", alpha: 0.38 },
	{ name: "select", token: "--link", alpha: 0.22 },
] as const;

function brushImage(part: keyof typeof SHAPES, variant: 0 | 1, color: string, alpha: number) {
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX[part]}" preserveAspectRatio="none">` +
		`<path fill="${color}" fill-opacity="${alpha}" d="${SHAPES[part][variant]}"/></svg>`;
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** token 当前解析出的颜色；token 未定义（如测试环境）时为空串。 */
function resolveColor(token: string): string {
	const probe = document.createElement("span");
	probe.style.display = "none";
	probe.style.color = `var(${token})`;
	document.body.append(probe);
	const color = getComputedStyle(probe).color;
	probe.remove();
	return color;
}

let applied = "";

/**
 * 按当前主题重写 :root 上的笔触自定义属性。颜色没变且属性还在时不写，
 * 因此由 :root 属性变化触发的重复调用不会形成循环；主题切换若清掉了 :root 内联样式则会补写。
 */
export function applyBrushColors(): void {
	const style = document.documentElement.style;
	const colors = STATES.map((state) => resolveColor(state.token));
	const key = colors.join("|");
	if (colors.some((color) => !color)) return;
	if (key === applied && style.getPropertyValue("--annotation-saved-capl-a")) return;
	applied = key;
	STATES.forEach((state, index) => {
		for (const part of Object.keys(SHAPES) as (keyof typeof SHAPES)[]) {
			for (const variant of [0, 1] as const) {
				style.setProperty(
					`--annotation-${state.name}-${part}-${variant === 0 ? "a" : "b"}`,
					brushImage(part, variant, colors[index], state.alpha),
				);
			}
		}
	});
}
