/** 可交互或承载内容的元素：按在这些地方照常选字、点击，不碰窗。 */
const OPAQUE_SELECTOR = [
	"a",
	"button",
	"input",
	"textarea",
	"select",
	"label",
	"summary",
	"video",
	"audio",
	"iframe",
	"img",
	"svg",
	"canvas",
	"p",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"li",
	"dt",
	"dd",
	"pre",
	"code",
	"blockquote",
	"figure",
	"table",
	"[role]",
	"[contenteditable]",
	"[data-window-ignore]",
].join(",");

function hasOwnText(el: Element): boolean {
	for (const node of el.childNodes) {
		if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) return true;
	}
	return false;
}

function isOpaqueBackground(color: string): boolean {
	if (!color || color === "transparent") return false;
	const alpha = color.match(/[\d.]+(?=\)$)/);
	if (/^rgba|\/\s*[\d.]+%?\)$/.test(color) && alpha) return Number.parseFloat(alpha[0]) > 0;
	return true;
}

/**
 * 判断指针落点是不是「窗」：没有文字、不可交互，而且一路往上都没有不透明的卡片或面板挡着。
 *
 * @param target - 指针事件的目标
 */
export function isWindowBlank(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return false;
	if (target.closest(OPAQUE_SELECTOR)) return false;
	for (
		let el: Element | null = target;
		el && el !== document.body && el !== document.documentElement;
		el = el.parentElement
	) {
		if (hasOwnText(el)) return false;
		if (isOpaqueBackground(getComputedStyle(el).backgroundColor)) return false;
	}
	return true;
}
