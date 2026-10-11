import { itemProgress, type Schedule } from "../animate/schedule.ts";
import { CLOSE, CUBIC, type Drawing, type InkBatch, LINE, MOVE, type Path } from "../core/types.ts";
import { type Palette, paint, type RenderOptions } from "./palette.ts";
import { TextWriter } from "./text-writer.ts";
import { batchTracks, ease, ribbonPrefix, type Track, trackProgress } from "./tracks.ts";

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
	/**
	 * 提供编排后，stroke 与 ribbon 批次按子路径输出独立元素，供 {@link seekSvg} 按时间显现；
	 * 挂载时画面保持完整，不立即进入动画。仅 {@link mountSvg} 使用。
	 */
	schedule?: Schedule;
}

/** 动画模式下每个子路径元素的元数据，顺序与文档中 `[data-trk]` 一致。 */
interface TrackRef {
	item: number;
	track: Track;
	batch: InkBatch;
	baseOpacity: number;
}

function writePath(
	w: TextWriter,
	verbs: ArrayLike<number>,
	coords: ArrayLike<number>,
	v0: number,
	v1: number,
	c0: number,
): void {
	let c = c0;
	for (let i = v0; i < v1; i++) {
		const verb = verbs[i];
		if (verb === MOVE) w.char(77).num(coords[c++]).char(32).num(coords[c++]);
		else if (verb === LINE) w.char(76).num(coords[c++]).char(32).num(coords[c++]);
		else if (verb === CUBIC) {
			w.char(67)
				.num(coords[c])
				.char(32)
				.num(coords[c + 1])
				.char(32)
				.num(coords[c + 2]);
			w.char(32)
				.num(coords[c + 3])
				.char(32)
				.num(coords[c + 4])
				.char(32)
				.num(coords[c + 5]);
			c += 6;
		} else if (verb === CLOSE) w.char(90);
	}
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
	const w = new TextWriter(decimals, verbs.length + coords.length * 8);
	writePath(w, verbs, coords, 0, verbs.length, 0);
	return w.toString();
}

function escapeXml(text: string): string {
	return text.replace(
		/[&<>"]/g,
		(ch) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[ch]};`,
	);
}

function buildSvg(
	drawing: Drawing,
	palette: Palette,
	options: SvgOptions,
	split: boolean,
): { svg: string; refs: TrackRef[] } {
	const decimals = options.decimals ?? 2;
	const id = `${options.idPrefix ?? "sketch"}-${++serial}`;
	const clips = new Map<Path, string>();
	const refs: TrackRef[] = [];
	let estimate = 256;
	for (const item of drawing.items)
		for (const batch of item.batches)
			estimate += batch.verbs.length + batch.coords.length * 8 + 256;
	const defs = new TextWriter(decimals);
	const body = new TextWriter(decimals, estimate);
	const background = options.background === undefined ? "paper" : options.background;
	if (background)
		body.text(
			`<rect width="${drawing.width}" height="${drawing.height}" fill="${paint(palette, background)}" data-role="${background}" data-paint="fill"/>`,
		);
	drawing.items.forEach((item, itemIndex) => {
		body.text(
			`<g data-item="${escapeXml(item.id)}"${item.transform ? ` transform="matrix(${item.transform.join(" ")})"` : ""}>`,
		);
		for (const batch of item.batches) {
			let clipAttr = "";
			if (batch.clip) {
				let clipId = clips.get(batch.clip);
				if (!clipId) {
					const { verbs, coords, fillRule } = batch.clip;
					clipId = `${id}-c${clips.size}`;
					clips.set(batch.clip, clipId);
					defs.text(`<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><path d="`);
					writePath(defs, verbs, coords, 0, verbs.length, 0);
					defs.text(`" clip-rule="${fillRule}"/></clipPath>`);
				}
				clipAttr = ` clip-path="url(#${clipId})"`;
			}
			const color = paint(palette, batch.role);
			const baseOpacity = batch.opacity ?? 1;
			const opacity = baseOpacity === 1 ? "" : ` opacity="${baseOpacity}"`;
			const look =
				batch.mode === "fill"
					? `fill="${color}" fill-rule="${batch.fillRule ?? "nonzero"}"`
					: `fill="none" stroke="${color}" stroke-width="${batch.width ?? 1}" stroke-linecap="round" stroke-linejoin="round"`;
			const tail = `" ${look}${opacity}${clipAttr} data-role="${escapeXml(batch.role)}" data-paint="${batch.mode}"`;
			if (!split) {
				body.text('<path d="');
				writePath(body, batch.verbs, batch.coords, 0, batch.verbs.length, 0);
				body.text(tail).text("/>");
				continue;
			}
			for (const track of batchTracks(batch)) {
				refs.push({ item: itemIndex, track, batch, baseOpacity });
				body.text('<path d="');
				writePath(body, batch.verbs, batch.coords, track.v0, track.v1, track.c0);
				body.text(tail).text(
					track.kind === "stroke" ? ' data-trk="1" pathLength="1"/>' : ' data-trk="1"/>',
				);
			}
		}
		if (item.label) {
			const { text, x, y, size } = item.label;
			body.text(
				`<text x="${x}" y="${y}" fill="${paint(palette, "ink")}" font-size="${size ?? 14}" font-family="${escapeXml(options.fontFamily ?? "system-ui, sans-serif")}" text-anchor="middle" dominant-baseline="middle" data-role="ink" data-paint="fill" data-lbl="${itemIndex}">${escapeXml(text)}</text>`,
			);
		}
		body.text("</g>");
	});
	const title = options.title ? `<title>${escapeXml(options.title)}</title>` : "";
	const clipDefs = clips.size ? `<defs>${defs}</defs>` : "";
	return {
		svg: `<svg xmlns="${NS}" viewBox="0 0 ${drawing.width} ${drawing.height}" width="${drawing.width}" height="${drawing.height}" role="img">${title}${clipDefs}${body}</svg>`,
		refs,
	};
}

/**
 * 把生成结果序列化为独立的 SVG 文本，不依赖 DOM，可在 Worker 或 Node 中调用。
 *
 * @throws 当 palette 缺少任一引用的颜色角色。
 * @remarks 每个渲染批次一个 path；只有带裁剪的批次建立 clipPath，不使用 mask。
 */
export function renderSvg(drawing: Drawing, palette: Palette, options: SvgOptions = {}): string {
	return buildSvg(drawing, palette, options, false).svg;
}

interface ItemModel {
	/** full 为条带的完整路径数据，首次显现前缀时才读取。 */
	refs: { ref: TrackRef; el: SVGElement; full?: string; last: number }[];
	label?: SVGElement;
	/** 0 尚未开始，1 进行中，2 已完成。 */
	state: 0 | 1 | 2;
}

interface SvgModel {
	schedule: Schedule;
	decimals: number;
	items: ItemModel[];
}

const models = new WeakMap<SVGSVGElement, SvgModel>();

/**
 * 构造尚未挂载的 SVG 元素。
 *
 * @remarks 需要浏览器 DOM；元素可直接挂载或用 XMLSerializer 导出。提供 `schedule` 时可用 {@link seekSvg} 按时间显现。
 */
export function mountSvg(
	drawing: Drawing,
	palette: Palette,
	options: SvgOptions = {},
): SVGSVGElement {
	const { svg: text, refs } = buildSvg(drawing, palette, options, Boolean(options.schedule));
	// HTML 解析器比 DOMParser 的 XML 解析快数倍；template 在惰性文档中解析，再整棵移入当前文档
	const template = document.createElement("template");
	template.innerHTML = text;
	const svg = document.adoptNode(template.content.firstElementChild as SVGSVGElement);
	svg.setAttribute("style", "width:100%;height:auto;display:block");
	if (options.schedule) {
		const items: ItemModel[] = drawing.items.map(() => ({ refs: [], state: 2 }));
		const nodes = svg.querySelectorAll<SVGElement>("[data-trk]");
		refs.forEach((ref, i) => {
			const el = nodes[i];
			items[ref.item].refs.push({ ref, el, last: 1 });
		});
		for (const label of svg.querySelectorAll<SVGElement>("[data-lbl]"))
			items[Number(label.getAttribute("data-lbl"))].label = label;
		models.set(svg, { schedule: options.schedule, decimals: options.decimals ?? 2, items });
	}
	return svg;
}

function showTrack(model: SvgModel, entry: ItemModel["refs"][number], p: number): void {
	if (p === entry.last) return;
	entry.last = p;
	const { el, ref } = entry;
	if (p <= 0) {
		el.setAttribute("display", "none");
		return;
	}
	el.removeAttribute("display");
	const { kind } = ref.track;
	if (kind === "stroke") {
		if (p >= 1) {
			el.removeAttribute("stroke-dasharray");
			el.removeAttribute("stroke-dashoffset");
		} else {
			el.setAttribute("stroke-dasharray", "1 1");
			el.setAttribute("stroke-dashoffset", String(1 - p));
		}
	} else if (kind === "ribbon") {
		if (p >= 1) {
			if (entry.full !== undefined) el.setAttribute("d", entry.full);
		} else {
			entry.full ??= el.getAttribute("d") ?? "";
			const xy = ribbonPrefix(ref.batch.coords, ref.track, p);
			const f = 10 ** model.decimals;
			let d = "";
			for (let i = 0; i < xy.length; i += 2)
				d += `${i ? "L" : "M"}${Math.round(xy[i] * f) / f} ${Math.round(xy[i + 1] * f) / f}`;
			el.setAttribute("d", `${d}Z`);
		}
	} else el.setAttribute("opacity", String(ref.baseOpacity * ease(p)));
}

/**
 * 把按 `schedule` 挂载的 SVG 推进到时间 t（秒）：已落笔的部分完整显示，进行中的笔画只显现前缀。
 *
 * @param t - 整图时间轴上的时间；跳转、暂停与倒放都只改变显现范围，不重新生成笔画
 * @remarks 只更新进行中与状态变化的图元，每帧成本与同时进行的笔画数成正比。
 */
export function seekSvg(svg: SVGSVGElement, t: number): void {
	const model = models.get(svg);
	if (!model) return;
	model.items.forEach((item, i) => {
		const u = itemProgress(model.schedule, i, t);
		const state = u <= 0 ? 0 : u >= 1 ? 2 : 1;
		if (state !== 1 && state === item.state) return;
		item.state = state;
		for (const entry of item.refs) showTrack(model, entry, trackProgress(entry.ref.track, u));
		if (item.label) {
			const p = state === 2 ? 1 : state === 0 ? 0 : Math.max(0, (u - 0.75) / 0.25);
			if (p <= 0) item.label.setAttribute("opacity", "0");
			else if (p >= 1) item.label.removeAttribute("opacity");
			else item.label.setAttribute("opacity", String(ease(p)));
		}
	});
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
