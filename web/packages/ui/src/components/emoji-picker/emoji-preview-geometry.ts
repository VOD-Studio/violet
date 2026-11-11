const PREVIEW_WIDTH = 120;
const PREVIEW_HEIGHT = 100;
const ARROW_GAP = 9;
const EDGE_PADDING = 5;
const PANEL_OVERHANG = 16;

interface Rectangle {
	left: number;
	top: number;
	right: number;
	bottom: number;
	width: number;
	height: number;
}

/** 预览坐标属于面板未缩放的本地坐标系；side 表示纸片相对目标的位置。 */
export interface EmojiPreviewGeometry {
	x: number;
	y: number;
	width: number;
	arrow: number;
	side: "top" | "bottom" | "left" | "right";
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.max(minimum, Math.min(value, maximum));
}

function toLocal(rectangle: DOMRect, bounds: DOMRect, scaleX: number, scaleY: number): Rectangle {
	return {
		left: (rectangle.left - bounds.left) / scaleX,
		top: (rectangle.top - bounds.top) / scaleY,
		right: (rectangle.right - bounds.left) / scaleX,
		bottom: (rectangle.bottom - bounds.top) / scaleY,
		width: rectangle.width / scaleX,
		height: rectangle.height / scaleY,
	};
}

/** 先在滚动视口内上下翻转；均放不下时侧放，最多借用面板外 16px 留白。 */
export function measureEmojiPreview(
	root: HTMLDivElement,
	viewport: HTMLDivElement,
	element: HTMLElement,
): EmojiPreviewGeometry {
	const bounds = root.getBoundingClientRect();
	let scaleX = 1;
	let scaleY = 1;
	if (bounds.width > 0 && root.offsetWidth > 0) {
		scaleX = bounds.width / root.offsetWidth;
	}
	if (bounds.height > 0 && root.offsetHeight > 0) {
		scaleY = bounds.height / root.offsetHeight;
	}

	const grid = toLocal(viewport.getBoundingClientRect(), bounds, scaleX, scaleY);
	const target = toLocal(element.getBoundingClientRect(), bounds, scaleX, scaleY);
	const browserWidth = root.ownerDocument.documentElement.clientWidth || window.innerWidth;
	const browserHeight = root.ownerDocument.documentElement.clientHeight || window.innerHeight;
	const browserLeft = -bounds.left / scaleX;
	const browserRight = (browserWidth - bounds.left) / scaleX;
	const top = Math.max(grid.top, -bounds.top / scaleY) + EDGE_PADDING;
	const bottom = Math.min(grid.bottom, (browserHeight - bounds.top) / scaleY) - EDGE_PADDING;
	const panelWidth = bounds.width / scaleX;
	const left = Math.max(0, browserLeft) + EDGE_PADDING;
	const right = Math.min(panelWidth, browserRight) - EDGE_PADDING;
	const centerX = target.left + target.width / 2;
	const centerY = target.top + target.height / 2;
	const above = target.top - ARROW_GAP - PREVIEW_HEIGHT;
	const below = target.bottom + ARROW_GAP;
	const fitsAbove = above >= top && above + PREVIEW_HEIGHT <= bottom;
	const fitsBelow = below >= top && below + PREVIEW_HEIGHT <= bottom;

	if (fitsAbove || fitsBelow) {
		const width = Math.min(PREVIEW_WIDTH, right - left);
		const x = clamp(centerX - width / 2, left, right - width);
		let side: EmojiPreviewGeometry["side"] = "bottom";
		let y = below;
		if (fitsAbove) {
			side = "top";
			y = above;
		}
		return { x, y, width, arrow: clamp(centerX - x, 10, width - 10), side };
	}

	const sideLeft = Math.max(-PANEL_OVERHANG, browserLeft + EDGE_PADDING);
	const sideRight = Math.min(panelWidth + PANEL_OVERHANG, browserRight - EDGE_PADDING);
	const roomLeft = Math.max(0, target.left - ARROW_GAP - sideLeft);
	const roomRight = Math.max(0, sideRight - target.right - ARROW_GAP);
	let side: EmojiPreviewGeometry["side"] = "right";
	let available = roomRight;
	if (roomLeft >= roomRight) {
		side = "left";
		available = roomLeft;
	}
	const width = Math.min(PREVIEW_WIDTH, available);
	let x = target.right + ARROW_GAP;
	if (side === "left") {
		x = target.left - ARROW_GAP - width;
	}
	const y = clamp(centerY - PREVIEW_HEIGHT / 2, top, bottom - PREVIEW_HEIGHT);
	return { x, y, width, arrow: clamp(centerY - y, 10, PREVIEW_HEIGHT - 10), side };
}
