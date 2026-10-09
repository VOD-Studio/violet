import { CLOSE, CUBIC, type Drawing, LINE, MOVE, type Path } from "../core/types.ts";
import { type Palette, paint, type RenderOptions } from "./palette.ts";

const NS = "http://www.w3.org/2000/svg";
let serial = 0;

/** SVG 输出选项。 */
export interface SvgOptions extends RenderOptions {
	/** 坐标保留的小数位数。 @default 2 */
	decimals?: number;
	/** 内部 clipPath id 前缀；会追加实例序号以免同页冲突。 @default "sketch" */
	idPrefix?: string;
	/** 无障碍名称。 */
	title?: string;
}

// 定点格式化：整数运算拼接，避免浮点 toString 在大量坐标上的开销。
function formatter(decimals: number): (v: number) => string {
	const f = 10 ** decimals;
	return (v) => {
		let k = Math.round(v * f);
		if (k === 0) return "0";
		let sign = "";
		if (k < 0) {
			sign = "-";
			k = -k;
		}
		const whole = Math.floor(k / f);
		let frac = k - whole * f;
		if (!frac) return sign + whole;
		let digits = decimals;
		while (frac % 10 === 0) {
			frac /= 10;
			digits--;
		}
		let tail = `${frac}`;
		while (tail.length < digits) tail = `0${tail}`;
		return `${sign}${whole}.${tail}`;
	};
}

/**
 * 把动词与坐标序列序列化为 SVG path 数据。
 *
 * @param decimals - 坐标保留的小数位数
 */
export function pathData(
	verbs: ArrayLike<number>,
	coords: ArrayLike<number>,
	decimals = 2,
): string {
	const n = formatter(decimals);
	let d = "";
	let c = 0;
	for (let i = 0; i < verbs.length; i++) {
		const verb = verbs[i];
		if (verb === MOVE) d += `M${n(coords[c++])} ${n(coords[c++])}`;
		else if (verb === LINE) d += `L${n(coords[c++])} ${n(coords[c++])}`;
		else if (verb === CUBIC) {
			d += `C${n(coords[c])} ${n(coords[c + 1])} ${n(coords[c + 2])} ${n(coords[c + 3])} ${n(coords[c + 4])} ${n(coords[c + 5])}`;
			c += 6;
		} else if (verb === CLOSE) d += "Z";
	}
	return d;
}

function escapeXml(text: string): string {
	return text.replace(
		/[&<>"]/g,
		(ch) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[ch]};`,
	);
}

/**
 * 把生成结果序列化为独立的 SVG 文本，不依赖 DOM，可在 Worker 或 Node 中调用。
 *
 * @throws 当 palette 缺少任一引用的颜色角色。
 * @remarks 每个渲染批次一个 path；只有带裁剪的批次建立 clipPath，不使用 mask。
 */
export function renderSvg(drawing: Drawing, palette: Palette, options: SvgOptions = {}): string {
	const decimals = options.decimals ?? 2;
	const id = `${options.idPrefix ?? "sketch"}-${++serial}`;
	const clips = new Map<Path, string>();
	let defs = "";
	let body = "";
	const background = options.background === undefined ? "paper" : options.background;
	if (background)
		body += `<rect width="${drawing.width}" height="${drawing.height}" fill="${paint(palette, background)}" data-role="${background}" data-paint="fill"/>`;
	for (const item of drawing.items) {
		body += `<g data-item="${escapeXml(item.id)}"${item.transform ? ` transform="matrix(${item.transform.join(" ")})"` : ""}>`;
		for (const batch of item.batches) {
			let clipAttr = "";
			if (batch.clip) {
				let clipId = clips.get(batch.clip);
				if (!clipId) {
					clipId = `${id}-c${clips.size}`;
					clips.set(batch.clip, clipId);
					defs += `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><path d="${pathData(batch.clip.verbs, batch.clip.coords, decimals)}" clip-rule="${batch.clip.fillRule}"/></clipPath>`;
				}
				clipAttr = ` clip-path="url(#${clipId})"`;
			}
			const color = paint(palette, batch.role);
			const opacity =
				batch.opacity === undefined || batch.opacity === 1
					? ""
					: ` opacity="${batch.opacity}"`;
			const look =
				batch.mode === "fill"
					? `fill="${color}" fill-rule="${batch.fillRule ?? "nonzero"}"`
					: `fill="none" stroke="${color}" stroke-width="${batch.width ?? 1}" stroke-linecap="round" stroke-linejoin="round"`;
			body += `<path d="${pathData(batch.verbs, batch.coords, decimals)}" ${look}${opacity}${clipAttr} data-role="${escapeXml(batch.role)}" data-paint="${batch.mode}"/>`;
		}
		if (item.label) {
			const { text, x, y, size } = item.label;
			body += `<text x="${x}" y="${y}" fill="${paint(palette, "ink")}" font-size="${size ?? 14}" font-family="${escapeXml(options.fontFamily ?? "system-ui, sans-serif")}" text-anchor="middle" dominant-baseline="middle" data-role="ink" data-paint="fill">${escapeXml(text)}</text>`;
		}
		body += "</g>";
	}
	const title = options.title ? `<title>${escapeXml(options.title)}</title>` : "";
	return `<svg xmlns="${NS}" viewBox="0 0 ${drawing.width} ${drawing.height}" width="${drawing.width}" height="${drawing.height}" role="img">${title}${defs ? `<defs>${defs}</defs>` : ""}${body}</svg>`;
}

/**
 * 构造尚未挂载的 SVG 元素。
 *
 * @remarks 需要浏览器 DOM；元素可直接挂载或用 XMLSerializer 导出。
 */
export function mountSvg(
	drawing: Drawing,
	palette: Palette,
	options: SvgOptions = {},
): SVGSVGElement {
	const doc = new DOMParser().parseFromString(
		renderSvg(drawing, palette, options),
		"image/svg+xml",
	);
	const svg = document.importNode(doc.documentElement, true) as unknown as SVGSVGElement;
	svg.style.width = "100%";
	svg.style.height = "auto";
	svg.style.display = "block";
	return svg;
}

/**
 * 按新配色更新由本模块生成的 SVG，不改变几何。
 *
 * @throws 当 palette 缺少元素引用的颜色角色；出错前已更新的属性不回滚。
 */
export function updateSvgPalette(svg: SVGSVGElement, palette: Palette): void {
	for (const node of svg.querySelectorAll<SVGElement>("[data-role]")) {
		const role = node.getAttribute("data-role");
		if (role)
			node.setAttribute(
				node.getAttribute("data-paint") === "stroke" ? "stroke" : "fill",
				paint(palette, role),
			);
	}
}

export type { Palette, RenderOptions } from "./palette.ts";
