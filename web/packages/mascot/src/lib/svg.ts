/**
 * SVG DOM 工具:rig 构建与特效粒子共用的元素创建。
 */

/** 创建 SVG 命名空间元素并批量设置属性。 */
export function svgEl(tag: string, attrs: Record<string, string>): SVGElement {
	const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
	for (const k in attrs) e.setAttribute(k, attrs[k]);
	return e;
}
