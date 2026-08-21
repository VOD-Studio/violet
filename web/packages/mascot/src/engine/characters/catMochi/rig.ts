import { shade } from "../../../lib/color";
import { svgEl } from "../../../lib/svg";
import {
	CAT_EARS,
	CAT_WHISKERS,
	catMochiOutline,
	catTailPath,
	FACE,
	MOUTH_SHAPES,
	smoothClosedPath,
} from "./geometry";
import { PALETTE } from "./palette";

let uidCounter = 0;

/** 堇喵 rig:一次性创建的全部 SVG 节点引用。 */
export interface CatMochiRig {
	svg: SVGSVGElement;
	shadowEl: SVGEllipseElement;
	haloG: SVGGElement;
	haloDots: SVGCircleElement[];
	/** 彩带后层:先于 rig 挂载,轨道绕到身体背面的段被身体遮挡 */
	fxBackG: SVGGElement;
	rigG: SVGGElement;
	zzzEls: SVGTextElement[];
	fxLayer: SVGGElement;
	defsEl: SVGElement;
	bodyPath: SVGPathElement;
	bodyGrad: SVGElement;
	/* 渐变 stops,用于身体变色 */
	gradStopA: SVGStopElement;
	gradStopB: SVGStopElement;
	gradStopC: SVGStopElement;
	tailEl: SVGPathElement;
	earLG: SVGGElement;
	earRG: SVGGElement;
	earLOuter: SVGPathElement;
	earROuter: SVGPathElement;
	earLInner: SVGPathElement;
	earRInner: SVGPathElement;
	whiskerLG: SVGGElement;
	whiskerRG: SVGGElement;
	blushL: SVGEllipseElement;
	blushR: SVGEllipseElement;
	eyeLG: SVGGElement;
	eyeRG: SVGGElement;
	eyeLNode: SVGPathElement;
	eyeRNode: SVGPathElement;
	eyeLSparkleA: SVGCircleElement;
	eyeLSparkleB: SVGCircleElement;
	eyeRSparkleA: SVGCircleElement;
	eyeRSparkleB: SVGCircleElement;
	mouthG: SVGGElement;
	mouthCavity: SVGPathElement;
	mouthTongue: SVGPathElement;
	mouthLine: SVGPathElement;
	pawLG: SVGGElement;
	pawRG: SVGGElement;
}

/**
 * 一次性创建堇喵全部 SVG 结构并返回节点引用。
 *
 * svg 子节点顺序:defs → shadow → halo → fxBackG → rigG → zzz×3 → fxLayer。
 */
export function buildCatMochiRig(): CatMochiRig {
	const uid = ++uidCounter;
	const svg = svgEl("svg", { viewBox: "0 0 260 260" }) as SVGSVGElement;
	svg.style.width = "100%";
	svg.style.height = "100%";
	svg.style.display = "block";
	svg.style.cursor = "pointer";
	// 粒子层溢出可见:confetti 从中心爆开后会飞出 viewBox,
	// 默认 overflow:hidden 会拦腰裁断烟花(宿主容器自行决定最终裁剪边界)
	svg.style.overflow = "visible";

	const defs = svgEl("defs", {});
	const gradId = `cat-body-grad-${uid}`;
	const grad = svgEl("radialGradient", {
		id: gradId,
		cx: "38%",
		cy: "32%",
		r: "70%",
	});
	const gradStopA = svgEl("stop", {
		offset: "0%",
		"stop-color": "#FFFFFF",
	}) as SVGStopElement;
	const gradStopB = svgEl("stop", {
		offset: "55%",
		"stop-color": PALETTE.body,
	}) as SVGStopElement;
	const gradStopC = svgEl("stop", {
		offset: "100%",
		"stop-color": shade(PALETTE.body, -0.08),
	}) as SVGStopElement;
	grad.appendChild(gradStopA);
	grad.appendChild(gradStopB);
	grad.appendChild(gradStopC);
	defs.appendChild(grad);
	svg.appendChild(defs);

	// 地面软阴影
	const shadowEl = svgEl("ellipse", {
		cx: "130",
		cy: "234",
		rx: "82",
		ry: "11",
		fill: "rgba(18, 14, 38, 0.4)",
	}) as SVGEllipseElement;
	svg.appendChild(shadowEl);

	// 思考环带
	const haloG = svgEl("g", { opacity: "0" }) as SVGGElement;
	haloG.appendChild(
		svgEl("ellipse", {
			cx: "130",
			cy: "32",
			rx: "48",
			ry: "11",
			fill: "none",
			stroke: "#A78BFA",
			"stroke-width": "1.8",
			"stroke-dasharray": "4 8",
			opacity: "0.5",
			transform: "rotate(-6 130 32)",
		}),
	);
	const haloDots: SVGCircleElement[] = [];
	for (let i = 0; i < 2; i++) {
		const dot = svgEl("circle", { r: "3.6", fill: "#8B5CF6" }) as SVGCircleElement;
		haloDots.push(dot);
		haloG.appendChild(dot);
	}
	svg.appendChild(haloG);

	// rig 容器
	const rigG = svgEl("g", {}) as SVGGElement;

	// 尾巴默认挂在身体后层,渲染时按角色朝向切换前后层。
	const tailEl = svgEl("path", {
		d: catTailPath(0.5, 0.3),
		fill: "none",
		stroke: PALETTE.tail,
		"stroke-width": "12",
		"stroke-linecap": "round",
	}) as SVGPathElement;
	rigG.appendChild(tailEl);

	// 耳朵:外耳廓 + 内耳窝
	const earLG = svgEl("g", {}) as SVGGElement;
	const earLOuter = svgEl("path", {
		d: CAT_EARS.left.outerD,
		fill: PALETTE.earOuter,
		stroke: PALETTE.bodyStroke,
		"stroke-width": "1.6",
	}) as SVGPathElement;
	const earLInner = svgEl("path", {
		d: CAT_EARS.left.innerD,
		fill: PALETTE.earInner,
	}) as SVGPathElement;
	earLG.appendChild(earLOuter);
	earLG.appendChild(earLInner);
	rigG.appendChild(earLG);

	const earRG = svgEl("g", {}) as SVGGElement;
	const earROuter = svgEl("path", {
		d: CAT_EARS.right.outerD,
		fill: PALETTE.earOuter,
		stroke: PALETTE.bodyStroke,
		"stroke-width": "1.6",
	}) as SVGPathElement;
	const earRInner = svgEl("path", {
		d: CAT_EARS.right.innerD,
		fill: PALETTE.earInner,
	}) as SVGPathElement;
	earRG.appendChild(earROuter);
	earRG.appendChild(earRInner);
	rigG.appendChild(earRG);

	// 面团身体
	const bodyPath = svgEl("path", {
		d: smoothClosedPath(catMochiOutline()),
		fill: `url(#${gradId})`,
		stroke: PALETTE.bodyStroke,
		"stroke-width": "1.8",
	}) as SVGPathElement;
	rigG.appendChild(bodyPath);

	// 胡须(左右各上下 2 根)
	const whiskerLG = svgEl("g", { opacity: "0.55" }) as SVGGElement;
	const whiskerLTop = svgEl("path", {
		d: CAT_WHISKERS.leftUpper,
		fill: "none",
		stroke: PALETTE.whisker,
		"stroke-width": "1.3",
		"stroke-linecap": "round",
	}) as SVGPathElement;
	const whiskerLBot = svgEl("path", {
		d: CAT_WHISKERS.leftLower,
		fill: "none",
		stroke: PALETTE.whisker,
		"stroke-width": "1.3",
		"stroke-linecap": "round",
	}) as SVGPathElement;
	whiskerLG.appendChild(whiskerLTop);
	whiskerLG.appendChild(whiskerLBot);
	rigG.appendChild(whiskerLG);

	const whiskerRG = svgEl("g", { opacity: "0.55" }) as SVGGElement;
	const whiskerRTop = svgEl("path", {
		d: CAT_WHISKERS.rightUpper,
		fill: "none",
		stroke: PALETTE.whisker,
		"stroke-width": "1.3",
		"stroke-linecap": "round",
	}) as SVGPathElement;
	const whiskerRBot = svgEl("path", {
		d: CAT_WHISKERS.rightLower,
		fill: "none",
		stroke: PALETTE.whisker,
		"stroke-width": "1.3",
		"stroke-linecap": "round",
	}) as SVGPathElement;
	whiskerRG.appendChild(whiskerRTop);
	whiskerRG.appendChild(whiskerRBot);
	rigG.appendChild(whiskerRG);

	// 腮红
	const blushL = svgEl("ellipse", {
		cx: String(FACE.blushL[0]),
		cy: String(FACE.blushL[1]),
		rx: "15",
		ry: "8",
		fill: PALETTE.blush,
		opacity: "0",
	}) as SVGEllipseElement;
	const blushR = svgEl("ellipse", {
		cx: String(FACE.blushR[0]),
		cy: String(FACE.blushR[1]),
		rx: "15",
		ry: "8",
		fill: PALETTE.blush,
		opacity: "0",
	}) as SVGEllipseElement;
	rigG.appendChild(blushL);
	rigG.appendChild(blushR);

	// 眼睛(主形 + 双高光点)
	const eyeLG = svgEl("g", {}) as SVGGElement;
	const eyeLNode = svgEl("path", { fill: PALETTE.eye }) as SVGPathElement;
	const eyeLSparkleA = svgEl("circle", {
		cx: "-4.5",
		cy: "-4.5",
		r: "3.2",
		fill: PALETTE.eyeSparkle,
		opacity: "0.95",
	}) as SVGCircleElement;
	const eyeLSparkleB = svgEl("circle", {
		cx: "4",
		cy: "3.5",
		r: "1.6",
		fill: PALETTE.eyeSparkle,
		opacity: "0.8",
	}) as SVGCircleElement;
	eyeLG.appendChild(eyeLNode);
	eyeLG.appendChild(eyeLSparkleA);
	eyeLG.appendChild(eyeLSparkleB);
	rigG.appendChild(eyeLG);

	const eyeRG = svgEl("g", {}) as SVGGElement;
	const eyeRNode = svgEl("path", { fill: PALETTE.eye }) as SVGPathElement;
	const eyeRSparkleA = svgEl("circle", {
		cx: "-4.5",
		cy: "-4.5",
		r: "3.2",
		fill: PALETTE.eyeSparkle,
		opacity: "0.95",
	}) as SVGCircleElement;
	const eyeRSparkleB = svgEl("circle", {
		cx: "4",
		cy: "3.5",
		r: "1.6",
		fill: PALETTE.eyeSparkle,
		opacity: "0.8",
	}) as SVGCircleElement;
	eyeRG.appendChild(eyeRNode);
	eyeRG.appendChild(eyeRSparkleA);
	eyeRG.appendChild(eyeRSparkleB);
	rigG.appendChild(eyeRG);

	// 嘴(多形态:闭合腔/舌头/外轮廓)
	const mouthG = svgEl("g", {}) as SVGGElement;
	const mouthCavity = svgEl("path", {
		fill: PALETTE.mouthCavity,
		opacity: "0",
	}) as SVGPathElement;
	const mouthTongue = svgEl("path", {
		fill: PALETTE.mouthTongue,
		opacity: "0",
	}) as SVGPathElement;
	const mouthLine = svgEl("path", {
		d: MOUTH_SHAPES.w.lineD,
		fill: "none",
		stroke: PALETTE.mouth,
		"stroke-width": "1.6",
		"stroke-linecap": "round",
		"stroke-linejoin": "round",
	}) as SVGPathElement;
	mouthG.appendChild(mouthCavity);
	mouthG.appendChild(mouthTongue);
	mouthG.appendChild(mouthLine);
	rigG.appendChild(mouthG);

	// 胸前爪(主肉垫 + 3 颗趾肉球)
	const pawLG = svgEl("g", {}) as SVGGElement;
	pawLG.appendChild(
		svgEl("ellipse", {
			cx: String(FACE.pawL[0]),
			cy: String(FACE.pawL[1]),
			rx: "13",
			ry: "9",
			fill: PALETTE.paw,
			stroke: PALETTE.bodyStroke,
			"stroke-width": "1.2",
		}),
	);
	pawLG.appendChild(
		svgEl("ellipse", {
			cx: String(FACE.pawL[0]),
			cy: String(FACE.pawL[1] + 1.2),
			rx: "5.5",
			ry: "3.8",
			fill: PALETTE.pawPad,
		}),
	);
	pawLG.appendChild(
		svgEl("circle", {
			cx: String(FACE.pawL[0] - 5),
			cy: String(FACE.pawL[1] - 4.5),
			r: "1.6",
			fill: PALETTE.pawBean,
		}),
	);
	pawLG.appendChild(
		svgEl("circle", {
			cx: String(FACE.pawL[0]),
			cy: String(FACE.pawL[1] - 6.2),
			r: "1.7",
			fill: PALETTE.pawBean,
		}),
	);
	pawLG.appendChild(
		svgEl("circle", {
			cx: String(FACE.pawL[0] + 5),
			cy: String(FACE.pawL[1] - 4.5),
			r: "1.6",
			fill: PALETTE.pawBean,
		}),
	);
	rigG.appendChild(pawLG);

	const pawRG = svgEl("g", {}) as SVGGElement;
	pawRG.appendChild(
		svgEl("ellipse", {
			cx: String(FACE.pawR[0]),
			cy: String(FACE.pawR[1]),
			rx: "13",
			ry: "9",
			fill: PALETTE.paw,
			stroke: PALETTE.bodyStroke,
			"stroke-width": "1.2",
		}),
	);
	pawRG.appendChild(
		svgEl("ellipse", {
			cx: String(FACE.pawR[0]),
			cy: String(FACE.pawR[1] + 1.2),
			rx: "5.5",
			ry: "3.8",
			fill: PALETTE.pawPad,
		}),
	);
	pawRG.appendChild(
		svgEl("circle", {
			cx: String(FACE.pawR[0] - 5),
			cy: String(FACE.pawR[1] - 4.5),
			r: "1.6",
			fill: PALETTE.pawBean,
		}),
	);
	pawRG.appendChild(
		svgEl("circle", {
			cx: String(FACE.pawR[0]),
			cy: String(FACE.pawR[1] - 6.2),
			r: "1.7",
			fill: PALETTE.pawBean,
		}),
	);
	pawRG.appendChild(
		svgEl("circle", {
			cx: String(FACE.pawR[0] + 5),
			cy: String(FACE.pawR[1] - 4.5),
			r: "1.6",
			fill: PALETTE.pawBean,
		}),
	);
	rigG.appendChild(pawRG);

	// 彩带后层:先于 rig 挂载,轨道绕到身体背面的段被身体遮挡
	const fxBackG = svgEl("g", { "pointer-events": "none" }) as SVGGElement;
	svg.appendChild(fxBackG);
	svg.appendChild(rigG);

	// 睡眠 zzz
	const zzzEls: SVGTextElement[] = [];
	for (let i = 0; i < 3; i++) {
		const z = svgEl("text", {
			x: "0",
			y: "0",
			"font-size": "13",
			fill: "#A78BFA",
			"font-weight": "700",
			"font-style": "italic",
			"text-anchor": "middle",
			opacity: "0",
		}) as SVGTextElement;
		z.textContent = "z";
		zzzEls.push(z);
		svg.appendChild(z);
	}

	const fxLayer = svgEl("g", { "pointer-events": "none" }) as SVGGElement;
	svg.appendChild(fxLayer);

	return {
		svg,
		shadowEl,
		haloG,
		haloDots,
		fxBackG,
		rigG,
		zzzEls,
		fxLayer,
		defsEl: defs,
		bodyPath,
		bodyGrad: grad,
		gradStopA,
		gradStopB,
		gradStopC,
		tailEl,
		earLG,
		earRG,
		earLOuter,
		earROuter,
		earLInner,
		earRInner,
		whiskerLG,
		whiskerRG,
		blushL,
		blushR,
		eyeLG,
		eyeRG,
		eyeLNode,
		eyeRNode,
		eyeLSparkleA,
		eyeLSparkleB,
		eyeRSparkleA,
		eyeRSparkleB,
		mouthG,
		mouthCavity,
		mouthTongue,
		mouthLine,
		pawLG,
		pawRG,
	};
}
