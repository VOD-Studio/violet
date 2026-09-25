import type { CartoonPopoverSide } from "./types";

interface BubbleOutlineProps {
	width: number;
	height: number;
	side: CartoonPopoverSide;
	arrowOffset: number;
	showArrow: boolean;
	progress: number;
}

/** 尾巴在盒外露 8px，底边半宽 8px。 */
const TAIL_LENGTH = 8;
const TAIL_HALF_BASE = 8;
const CORNER_R = 15;

function clampEdge(value: number, max: number): number {
	return Math.min(Math.max(value, 16), Math.max(16, max));
}

function arrowFillPath(
	width: number,
	height: number,
	side: CartoonPopoverSide,
	arrowOffset: number,
): string {
	const edgeX = Math.max(16, width - 16);
	const edgeY = Math.max(16, height - 16);
	if (side === "bottom") {
		return `M ${arrowOffset} -${TAIL_LENGTH} L ${clampEdge(arrowOffset - TAIL_HALF_BASE, edgeX)} 1 H ${clampEdge(arrowOffset + TAIL_HALF_BASE, edgeX)} Z`;
	}
	if (side === "top") {
		return `M ${arrowOffset} ${height + TAIL_LENGTH} L ${clampEdge(arrowOffset - TAIL_HALF_BASE, edgeX)} ${height - 1} H ${clampEdge(arrowOffset + TAIL_HALF_BASE, edgeX)} Z`;
	}
	if (side === "right") {
		return `M -${TAIL_LENGTH} ${arrowOffset} L 1 ${clampEdge(arrowOffset - TAIL_HALF_BASE, edgeY)} V ${clampEdge(arrowOffset + TAIL_HALF_BASE, edgeY)} Z`;
	}
	return `M ${width + TAIL_LENGTH} ${arrowOffset} L ${width - 1} ${clampEdge(arrowOffset - TAIL_HALF_BASE, edgeY)} V ${clampEdge(arrowOffset + TAIL_HALF_BASE, edgeY)} Z`;
}

/**
 * 两条路径从尾巴尖端向相反方向描绘同一周界；无尾巴时从周界中点起笔。
 * 坐标为气泡盒坐标，描线与静止态共用轨道。
 */
function outlinePaths(
	width: number,
	height: number,
	side: CartoonPopoverSide,
	arrowOffset: number,
	showArrow: boolean,
): [string, string] {
	const right = width - 1;
	const bottom = height - 1;
	const rightCurve = width - 16;
	const bottomCurve = height - 16;
	const halfW = width / 2;
	const halfH = height / 2;

	if (side === "bottom") {
		const leftJoin = showArrow ? clampEdge(arrowOffset - TAIL_HALF_BASE, rightCurve) : halfW;
		const rightJoin = showArrow ? clampEdge(arrowOffset + TAIL_HALF_BASE, rightCurve) : halfW;
		const tip = `M ${arrowOffset} -${TAIL_LENGTH}`;
		return [
			`${showArrow ? tip : `M ${halfW} 1`} ${showArrow ? `L ${leftJoin} 1` : ""} H 16 A ${CORNER_R} ${CORNER_R} 0 0 0 1 16 V ${bottomCurve} A ${CORNER_R} ${CORNER_R} 0 0 0 16 ${bottom} H ${halfW}`,
			`${showArrow ? tip : `M ${halfW} 1`} ${showArrow ? `L ${rightJoin} 1` : ""} H ${rightCurve} A ${CORNER_R} ${CORNER_R} 0 0 1 ${right} 16 V ${bottomCurve} A ${CORNER_R} ${CORNER_R} 0 0 1 ${rightCurve} ${bottom} H ${halfW}`,
		];
	}
	if (side === "top") {
		const leftJoin = showArrow ? clampEdge(arrowOffset - TAIL_HALF_BASE, rightCurve) : halfW;
		const rightJoin = showArrow ? clampEdge(arrowOffset + TAIL_HALF_BASE, rightCurve) : halfW;
		const tip = `M ${arrowOffset} ${height + TAIL_LENGTH}`;
		return [
			`${showArrow ? tip : `M ${halfW} ${bottom}`} ${showArrow ? `L ${leftJoin} ${bottom}` : ""} H 16 A ${CORNER_R} ${CORNER_R} 0 0 1 1 ${bottomCurve} V 16 A ${CORNER_R} ${CORNER_R} 0 0 1 16 1 H ${halfW}`,
			`${showArrow ? tip : `M ${halfW} ${bottom}`} ${showArrow ? `L ${rightJoin} ${bottom}` : ""} H ${rightCurve} A ${CORNER_R} ${CORNER_R} 0 0 0 ${right} ${bottomCurve} V 16 A ${CORNER_R} ${CORNER_R} 0 0 0 ${rightCurve} 1 H ${halfW}`,
		];
	}
	if (side === "right") {
		const topJoin = showArrow ? clampEdge(arrowOffset - TAIL_HALF_BASE, bottomCurve) : halfH;
		const bottomJoin = showArrow ? clampEdge(arrowOffset + TAIL_HALF_BASE, bottomCurve) : halfH;
		const tip = `M -${TAIL_LENGTH} ${arrowOffset}`;
		return [
			`${showArrow ? tip : `M 1 ${halfH}`} ${showArrow ? `L 1 ${topJoin}` : ""} V 16 A ${CORNER_R} ${CORNER_R} 0 0 1 16 1 H ${rightCurve} A ${CORNER_R} ${CORNER_R} 0 0 1 ${right} 16 V ${halfH}`,
			`${showArrow ? tip : `M 1 ${halfH}`} ${showArrow ? `L 1 ${bottomJoin}` : ""} V ${bottomCurve} A ${CORNER_R} ${CORNER_R} 0 0 0 16 ${bottom} H ${rightCurve} A ${CORNER_R} ${CORNER_R} 0 0 0 ${right} ${bottomCurve} V ${halfH}`,
		];
	}
	// 气泡在触发器左侧，尾巴朝右；两段沿上下半周反向描绘。
	const topJoin = showArrow ? clampEdge(arrowOffset - TAIL_HALF_BASE, bottomCurve) : halfH;
	const bottomJoin = showArrow ? clampEdge(arrowOffset + TAIL_HALF_BASE, bottomCurve) : halfH;
	const tip = `M ${width + TAIL_LENGTH} ${arrowOffset}`;
	return [
		`${showArrow ? tip : `M ${right} ${halfH}`} ${showArrow ? `L ${right} ${topJoin}` : ""} V 16 A ${CORNER_R} ${CORNER_R} 0 0 0 ${rightCurve} 1 H 16 A ${CORNER_R} ${CORNER_R} 0 0 0 1 16 V ${halfH}`,
		`${showArrow ? tip : `M ${right} ${halfH}`} ${showArrow ? `L ${right} ${bottomJoin}` : ""} V ${bottomCurve} A ${CORNER_R} ${CORNER_R} 0 0 1 ${rightCurve} ${bottom} H 16 A ${CORNER_R} ${CORNER_R} 0 0 1 1 ${bottomCurve} V ${halfH}`,
	];
}

/**
 * 气泡唯一边框轨道：尾巴 V 边与圆角周界同笔连续，尾巴背景同 SVG 填充。
 * 常驻渲染，progress 只驱动 dashoffset 描线，静止与动画零几何切换。
 */
export function BubbleOutline({
	width,
	height,
	side,
	arrowOffset,
	showArrow,
	progress,
}: BubbleOutlineProps) {
	const [first, second] = outlinePaths(width, height, side, arrowOffset, showArrow);
	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			aria-hidden="true"
			className="pointer-events-none absolute top-0 left-0 z-10 overflow-visible"
		>
			{showArrow && (
				<path
					d={arrowFillPath(width, height, side, arrowOffset)}
					fill="var(--cartoon-bg)"
				/>
			)}
			{[first, second].map((path) => (
				<path
					key={path}
					d={path}
					pathLength={1}
					fill="none"
					stroke="var(--cartoon-border)"
					strokeWidth={2}
					strokeLinecap="round"
					strokeDasharray={1}
					strokeDashoffset={1 - progress}
				/>
			))}
		</svg>
	);
}
