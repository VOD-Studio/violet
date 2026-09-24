import type { CartoonPopoverAlign, CartoonPopoverSide } from "./types";

export interface ComputePositionOptions {
	triggerRect: DOMRect;
	contentWidth: number;
	contentHeight: number;
	side?: CartoonPopoverSide;
	align?: CartoonPopoverAlign;
	sideOffset?: number;
	collisionPadding?: number;
	viewportWidth?: number;
	viewportHeight?: number;
}

export interface ComputePositionResult {
	x: number;
	y: number;
	actualSide: CartoonPopoverSide;
	arrowOffset: number;
	arrowSide: CartoonPopoverSide;
	transformOrigin: string;
}

/**
 * 计算浮层固定定位坐标与小尾巴对齐偏移，支持边缘防溢出和方向翻转。
 */
export function computePosition(options: ComputePositionOptions): ComputePositionResult {
	const {
		triggerRect,
		contentWidth,
		contentHeight,
		side = "bottom",
		align = "center",
		sideOffset = 14,
		collisionPadding = 8,
		viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1024,
		viewportHeight = typeof window !== "undefined" ? window.innerHeight : 768,
	} = options;

	let actualSide = side;

	// 1. 垂直/水平碰撞检测与自适应翻转
	if (side === "bottom") {
		const bottomSpace = viewportHeight - triggerRect.bottom;
		const needed = contentHeight + sideOffset + collisionPadding;
		if (bottomSpace < needed && triggerRect.top > needed) {
			actualSide = "top";
		}
	} else if (side === "top") {
		const topSpace = triggerRect.top;
		const needed = contentHeight + sideOffset + collisionPadding;
		if (topSpace < needed && viewportHeight - triggerRect.bottom > needed) {
			actualSide = "bottom";
		}
	} else if (side === "right") {
		const rightSpace = viewportWidth - triggerRect.right;
		const needed = contentWidth + sideOffset + collisionPadding;
		if (rightSpace < needed && triggerRect.left > needed) {
			actualSide = "left";
		}
	} else if (side === "left") {
		const leftSpace = triggerRect.left;
		const needed = contentWidth + sideOffset + collisionPadding;
		if (leftSpace < needed && viewportWidth - triggerRect.right > needed) {
			actualSide = "right";
		}
	}

	let x = 0;
	let y = 0;

	// 2. 主轴坐标定位：保证气泡主体与触发器保持足够的间隙，小尾巴（凸出 8px）绝不碰到或穿模触发器
	if (actualSide === "bottom") {
		y = triggerRect.bottom + sideOffset;
	} else if (actualSide === "top") {
		y = triggerRect.top - contentHeight - sideOffset;
	} else if (actualSide === "right") {
		x = triggerRect.right + sideOffset;
	} else if (actualSide === "left") {
		x = triggerRect.left - contentWidth - sideOffset;
	}

	// 3. 交叉轴坐标定位
	if (actualSide === "top" || actualSide === "bottom") {
		if (align === "start") {
			x = triggerRect.left;
		} else if (align === "end") {
			x = triggerRect.right - contentWidth;
		} else {
			x = triggerRect.left + (triggerRect.width - contentWidth) / 2;
		}
		// 视口边缘限位
		x = Math.max(
			collisionPadding,
			Math.min(x, viewportWidth - contentWidth - collisionPadding),
		);
	} else {
		if (align === "start") {
			y = triggerRect.top;
		} else if (align === "end") {
			y = triggerRect.bottom - contentHeight;
		} else {
			y = triggerRect.top + (triggerRect.height - contentHeight) / 2;
		}
		// 视口边缘限位
		y = Math.max(
			collisionPadding,
			Math.min(y, viewportHeight - contentHeight - collisionPadding),
		);
	}

	// 4. 计算小尾巴相对气泡的偏移位置（确保始终指向触发器中心，并避开 16px 圆角）
	let arrowOffset = 0;
	if (actualSide === "top" || actualSide === "bottom") {
		const triggerCenterX = triggerRect.left + triggerRect.width / 2;
		const relativeX = triggerCenterX - x;
		const minOffset = 24;
		const maxOffset = Math.max(minOffset, contentWidth - 24);
		arrowOffset = Math.max(minOffset, Math.min(relativeX, maxOffset));
	} else {
		const triggerCenterY = triggerRect.top + triggerRect.height / 2;
		const relativeY = triggerCenterY - y;
		const minOffset = 24;
		const maxOffset = Math.max(minOffset, contentHeight - 24);
		arrowOffset = Math.max(minOffset, Math.min(relativeY, maxOffset));
	}

	// 5. 动画展开原点：与小尾巴方向绑定，避免缩放动画向触发器方向膨胀发生穿模
	let transformOrigin = "center";
	if (actualSide === "bottom") {
		transformOrigin = `${arrowOffset}px top`;
	} else if (actualSide === "top") {
		transformOrigin = `${arrowOffset}px bottom`;
	} else if (actualSide === "right") {
		transformOrigin = `left ${arrowOffset}px`;
	} else if (actualSide === "left") {
		transformOrigin = `right ${arrowOffset}px`;
	}

	return {
		x: Math.round(x),
		y: Math.round(y),
		actualSide,
		arrowOffset: Math.round(arrowOffset),
		arrowSide: actualSide,
		transformOrigin,
	};
}
