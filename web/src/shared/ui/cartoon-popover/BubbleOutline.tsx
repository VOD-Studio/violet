import type { CartoonPopoverSide } from "./types";

interface BubbleOutlineProps {
	width: number;
	height: number;
	side: CartoonPopoverSide;
	arrowOffset: number;
	showArrow: boolean;
	progress: number;
}

/** 尾巴尖端到边框中心线的沉降距离：外露 10px + 1px 边框中心。 */
const TIP_SETTLE = 11;
/** 圆角半径：16px 圆角减 1px 边框中心内缩。 */
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
		return `M ${arrowOffset} -10 L ${clampEdge(arrowOffset - TIP_SETTLE, edgeX)} 1 H ${clampEdge(arrowOffset + TIP_SETTLE, edgeX)} Z`;
	}
	if (side === "top") {
		return `M ${arrowOffset} ${height + 10} L ${clampEdge(arrowOffset - TIP_SETTLE, edgeX)} ${height - 1} H ${clampEdge(arrowOffset + TIP_SETTLE, edgeX)} Z`;
	}
	if (side === "right") {
		return `M -10 ${arrowOffset} L 1 ${clampEdge(arrowOffset - TIP_SETTLE, edgeY)} V ${clampEdge(arrowOffset + TIP_SETTLE, edgeY)} Z`;
	}
	return `M ${width + 10} ${arrowOffset} L ${width - 1} ${clampEdge(arrowOffset - TIP_SETTLE, edgeY)} V ${clampEdge(arrowOffset + TIP_SETTLE, edgeY)} Z`;
}

/**
 * 两条对称描线路径：有小尾巴时从尖端起笔，沿 45° V 边沉降到边框中心线
 * 后沿圆角周界向两侧描绘至对边中点；无尾巴时从周界中点向两侧。
 * 坐标即气泡盒坐标，周界线画在 CSS border 中心线（1px）上，动画全程与
 * 静止态共用同一条轨道，描完不发生几何切换。
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
		// 尾巴在顶边朝上：尖端 (arrowOffset, -10)；左段逆时针、右段顺时针行进
		const leftJoin = showArrow ? clampEdge(arrowOffset - TIP_SETTLE, rightCurve) : halfW;
		const rightJoin = showArrow ? clampEdge(arrowOffset + TIP_SETTLE, rightCurve) : halfW;
		const tip = `M ${arrowOffset} -10`;
		return [
			`${showArrow ? tip : `M ${halfW} 1`} ${showArrow ? `L ${leftJoin} 1` : ""} H 16 A ${CORNER_R} ${CORNER_R} 0 0 0 1 16 V ${bottomCurve} A ${CORNER_R} ${CORNER_R} 0 0 0 16 ${bottom} H ${halfW}`,
			`${showArrow ? tip : `M ${halfW} 1`} ${showArrow ? `L ${rightJoin} 1` : ""} H ${rightCurve} A ${CORNER_R} ${CORNER_R} 0 0 1 ${right} 16 V ${bottomCurve} A ${CORNER_R} ${CORNER_R} 0 0 1 ${rightCurve} ${bottom} H ${halfW}`,
		];
	}
	if (side === "top") {
		// 尾巴在底边朝下：尖端 (arrowOffset, height+10)；左段顺时针、右段逆时针行进
		const leftJoin = showArrow ? clampEdge(arrowOffset - TIP_SETTLE, rightCurve) : halfW;
		const rightJoin = showArrow ? clampEdge(arrowOffset + TIP_SETTLE, rightCurve) : halfW;
		const tip = `M ${arrowOffset} ${height + 10}`;
		return [
			`${showArrow ? tip : `M ${halfW} ${bottom}`} ${showArrow ? `L ${leftJoin} ${bottom}` : ""} H 16 A ${CORNER_R} ${CORNER_R} 0 0 1 1 ${bottomCurve} V 16 A ${CORNER_R} ${CORNER_R} 0 0 1 16 1 H ${halfW}`,
			`${showArrow ? tip : `M ${halfW} ${bottom}`} ${showArrow ? `L ${rightJoin} ${bottom}` : ""} H ${rightCurve} A ${CORNER_R} ${CORNER_R} 0 0 0 ${right} ${bottomCurve} V 16 A ${CORNER_R} ${CORNER_R} 0 0 0 ${rightCurve} 1 H ${halfW}`,
		];
	}
	if (side === "right") {
		// 气泡在触发器右侧，尾巴在左边朝左：尖端 (-10, arrowOffset)；上段顺时针、下段逆时针
		const topJoin = showArrow ? clampEdge(arrowOffset - TIP_SETTLE, bottomCurve) : halfH;
		const bottomJoin = showArrow ? clampEdge(arrowOffset + TIP_SETTLE, bottomCurve) : halfH;
		const tip = `M -10 ${arrowOffset}`;
		return [
			`${showArrow ? tip : `M 1 ${halfH}`} ${showArrow ? `L 1 ${topJoin}` : ""} V 16 A ${CORNER_R} ${CORNER_R} 0 0 1 16 1 H ${rightCurve} A ${CORNER_R} ${CORNER_R} 0 0 1 ${right} 16 V ${halfH}`,
			`${showArrow ? tip : `M 1 ${halfH}`} ${showArrow ? `L 1 ${bottomJoin}` : ""} V ${bottomCurve} A ${CORNER_R} ${CORNER_R} 0 0 0 16 ${bottom} H ${rightCurve} A ${CORNER_R} ${CORNER_R} 0 0 0 ${right} ${bottomCurve} V ${halfH}`,
		];
	}
	// 气泡在触发器左侧，尾巴在右边朝右：尖端 (width+10, arrowOffset)；上段逆时针、下段顺时针
	const topJoin = showArrow ? clampEdge(arrowOffset - TIP_SETTLE, bottomCurve) : halfH;
	const bottomJoin = showArrow ? clampEdge(arrowOffset + TIP_SETTLE, bottomCurve) : halfH;
	const tip = `M ${width + 10} ${arrowOffset}`;
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
