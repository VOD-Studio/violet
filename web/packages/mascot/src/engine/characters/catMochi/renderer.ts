import { shade } from "../../../lib/color";
import { clamp, TAU } from "../../../lib/math";
import type { EffectMounts } from "../../effects/types";
import { EYE_RINGS, type EyeRing } from "../../eyes";
import type { BodyState, EyeState, Pose } from "../../pose";
import type { FrameContext } from "../../types";
import type { CharacterRenderer } from "../types";
import {
	CAT_EARS,
	catTailPath,
	FACE,
	FACE_PROJECTION_RADIUS,
	MOUTH_SHAPES,
	type MouthShapeId,
	projectSurfaceAngle,
	smoothClosedPath,
	surfaceAngleForX,
	TAIL_ROOT_RADIUS,
} from "./geometry";
import { buildCatMochiRig } from "./rig";

/**
 * 堇喵渲染器:把 Pose 写入 rig。持有渲染专属缓存(身体变色、尾巴前后
 * 画序、嘴型切换);动画语义状态全部在 PoseController。
 */
export class CatMochiRenderer implements CharacterRenderer {
	readonly mounts: EffectMounts;
	private readonly rig = buildCatMochiRig();
	private curBodyColor = "";
	private tailInFront = false;
	private curMouthShape: MouthShapeId = "w";

	get root(): SVGSVGElement {
		return this.rig.svg;
	}

	constructor() {
		this.mounts = { back: this.rig.fxBackG, front: this.rig.fxLayer, defs: this.rig.defsEl };
	}

	render(pose: Pose, frame: FrameContext): void {
		const now = frame.now;
		const b = pose.body;
		// 身体 rig:中心 130,贴地 226
		const cx = 130;
		const anchorY = 226;

		// 3D 偏航角计算 (自旋 yaw + 视线 lookX 转换为弧度制偏角)
		const avgLookX = (pose.left.lookX + pose.right.lookX) * 0.5;
		const avgLookY = (pose.left.lookY + pose.right.lookY) * 0.5;
		const phi = pose.yaw + avgLookX / 75;
		const pitchY = avgLookY * 0.65;
		// 整脸透明度:随偏航提早下降,配合位置滑动读出侧面
		const faceOp = clamp((Math.cos(phi) - 0.2) / 0.5, 0, 1);
		// 所有面部锚点与尾根都经由 geometry.ts 的同一条表面投影曲线。
		const thetaOf = (x0: number) => surfaceAngleForX(x0, FACE_PROJECTION_RADIUS);
		const faceProj = (theta0: number, a: number) =>
			projectSurfaceAngle(theta0, a, FACE_PROJECTION_RADIUS);

		// 身体轮廓是近圆团子,不额外按 yaw 压缩;身体与五官共享同一个 rig 变换。
		// 自旋时保持身体比例和接地点不变,避免角色像橡皮泥一样被横向拉扯。
		const leanSquash = frame.isSpinning ? 1 : frame.leanSquash;
		const stretchY = frame.isSpinning ? 1 : b.stretchY;
		this.rig.rigG.setAttribute(
			"transform",
			[
				`translate(${(cx + b.x + frame.leanShift).toFixed(2)} ${(anchorY + b.y).toFixed(2)})`,
				`rotate(${(b.rotate + frame.leanRot).toFixed(2)})`,
				`scale(${(b.scale * leanSquash).toFixed(4)} ${(b.scale * stretchY).toFixed(4)})`,
				`translate(${(-cx).toFixed(2)} ${(-anchorY).toFixed(2)})`,
			].join(" "),
		);

		// 阴影固定在地面接触点:角色升高只缩小并减淡,偏航不应让脚下阴影横移。
		const height = Math.max(0, -b.y);
		const shadowScale = clamp(b.scale * (1 - height * 0.006), 0.46, 1.1);
		const shadowX = cx + b.x * 0.4 + frame.leanShift * 0.5;
		this.rig.shadowEl.setAttribute(
			"transform",
			`translate(${shadowX.toFixed(2)} 234) scale(${shadowScale.toFixed(3)}) translate(${-cx} -234)`,
		);
		this.rig.shadowEl.setAttribute(
			"opacity",
			clamp(0.88 - height * 0.008, 0.2, 0.88).toFixed(3),
		);

		// 身体变色与高光梯度
		if (b.color !== this.curBodyColor) {
			this.curBodyColor = b.color;
			this.rig.gradStopA.setAttribute("stop-color", shade(b.color, 0.25));
			this.rig.gradStopB.setAttribute("stop-color", b.color);
			this.rig.gradStopC.setAttribute("stop-color", shade(b.color, -0.1));
			this.rig.earLOuter.setAttribute("fill", shade(b.color, -0.04));
			this.rig.earROuter.setAttribute("fill", shade(b.color, -0.04));
			this.rig.tailEl.setAttribute("stroke", shade(b.color, -0.06));
		}

		const gradCx = `${(38 + 14 * Math.sin(phi)).toFixed(1)}%`;
		const gradCy = `${(32 + 6 * Math.sin(phi * 2) - pitchY * 0.1).toFixed(1)}%`;
		this.rig.bodyGrad.setAttribute("cx", gradCx);
		this.rig.bodyGrad.setAttribute("cy", gradCy);

		// 尾巴根与耳朵都挂在同一表面坐标;尾巴的横向收窄在 catTailPath 内完成。
		const tailSway = Math.sin((TAU * now) / 2400) * b.tail;
		this.rig.tailEl.setAttribute("d", catTailPath(tailSway, b.tailElev, phi, TAIL_ROOT_RADIUS));
		// 正面隐藏尾根;背面显示尾巴并覆盖身体边缘,避免尾巴被整块身体吞掉。
		const tailInFront = Math.cos(pose.yaw) < -0.2;
		if (tailInFront !== this.tailInFront) {
			this.tailInFront = tailInFront;
			if (tailInFront) {
				this.rig.rigG.insertBefore(this.rig.tailEl, this.rig.whiskerLG);
			} else if (this.rig.rigG.firstChild !== this.rig.tailEl) {
				this.rig.rigG.insertBefore(this.rig.tailEl, this.rig.rigG.firstChild);
			}
		}

		// 侧视时只保留更靠近观察者的耳朵,避免两只耳朵挤成一根重叠尖刺。
		const earL = faceProj(thetaOf(CAT_EARS.left.pivot[0]), phi);
		const earR = faceProj(thetaOf(CAT_EARS.right.pivot[0]), phi);
		const earLRot = b.earL + Math.sin((TAU * now) / 3200) * 1.5 - avgLookX * 0.1;
		const earRRot = b.earR - Math.sin((TAU * now) / 3200 + 0.4) * 1.5 - avgLookX * 0.1;
		const absEarLDepth = Math.abs(earL.depth);
		const absEarRDepth = Math.abs(earR.depth);
		const sideView = Math.abs(Math.cos(phi)) < 0.82;
		const equalDepth = Math.abs(absEarLDepth - absEarRDepth) < 0.08;
		const earLVisible =
			!sideView || (equalDepth ? earL.depth >= earR.depth : absEarLDepth >= absEarRDepth);
		const earRVisible =
			!sideView || (equalDepth ? earR.depth > earL.depth : absEarRDepth > absEarLDepth);
		const earLOp = earLVisible ? clamp((absEarLDepth - 0.18) / 0.42, 0, 1) : 0;
		const earROp = earRVisible ? clamp((absEarRDepth - 0.18) / 0.42, 0, 1) : 0;
		const earLInnerOp = earLVisible ? earL.op : 0;
		const earRInnerOp = earRVisible ? earR.op : 0;

		this.rig.earLG.setAttribute("opacity", earLOp.toFixed(3));
		this.rig.earLG.setAttribute(
			"transform",
			`translate(${earL.x.toFixed(2)} ${(CAT_EARS.left.pivot[1] + pitchY).toFixed(2)}) ` +
				`rotate(${earLRot.toFixed(2)}) scale(${earL.sx.toFixed(3)} 1) ` +
				`translate(${-CAT_EARS.left.pivot[0]} ${-CAT_EARS.left.pivot[1]})`,
		);
		this.rig.earRG.setAttribute("opacity", earROp.toFixed(3));
		this.rig.earRG.setAttribute(
			"transform",
			`translate(${earR.x.toFixed(2)} ${(CAT_EARS.right.pivot[1] + pitchY).toFixed(2)}) ` +
				`rotate(${earRRot.toFixed(2)}) scale(${earR.sx.toFixed(3)} 1) ` +
				`translate(${-CAT_EARS.right.pivot[0]} ${-CAT_EARS.right.pivot[1]})`,
		);

		this.rig.earLInner.setAttribute("opacity", earLInnerOp.toFixed(3));
		this.rig.earRInner.setAttribute("opacity", earRInnerOp.toFixed(3));

		// 左右眼:统一投影,锚点为 FACE 眼位
		const eL = faceProj(thetaOf(FACE.eyeL[0]), phi);
		const eR = faceProj(thetaOf(FACE.eyeR[0]), phi);
		const eyeLX = eL.x + pose.left.x + pose.left.lookX * 0.2;
		const eyeRX = eR.x + pose.right.x + pose.right.lookX * 0.2;
		const eyeLY = 142 + pitchY + pose.left.y;
		const eyeRY = 142 + pitchY + pose.right.y;

		this.renderEye(
			this.rig.eyeLG,
			this.rig.eyeLNode,
			this.rig.eyeLSparkleA,
			this.rig.eyeLSparkleB,
			pose.left,
			eyeLX,
			eyeLY,
			eL.sx,
			eL.op * faceOp,
		);
		this.renderEye(
			this.rig.eyeRG,
			this.rig.eyeRNode,
			this.rig.eyeRSparkleA,
			this.rig.eyeRSparkleB,
			pose.right,
			eyeRX,
			eyeRY,
			eR.sx,
			eR.op * faceOp,
		);

		// 嘴:统一投影,锚点 130
		const m = faceProj(0, phi);
		const mouthY = 142 + pitchY + 14 + b.mouthY;
		this.renderMouth(b, m.x, mouthY, (b.mouthScale ?? 1) * m.sx, m.op * faceOp);

		// 腮红跟随同一投影中心,横向尺度限制在贴纸几何的安全区间,避免边缘
		// 经度的导数把腮红突然放大成漂浮的椭圆。
		const bl = faceProj(thetaOf(FACE.blushL[0]), phi);
		const br = faceProj(thetaOf(FACE.blushR[0]), phi);
		const blushY = 162 + pitchY * 0.85;
		const blushR0 = 15;
		const blushScaleL = clamp(Math.abs(bl.sx), 0.4, 1.15);
		const blushScaleR = clamp(Math.abs(br.sx), 0.4, 1.15);

		this.rig.blushL.setAttribute("cx", bl.x.toFixed(2));
		this.rig.blushL.setAttribute("cy", blushY.toFixed(2));
		this.rig.blushL.setAttribute("rx", (blushR0 * blushScaleL).toFixed(2));
		this.rig.blushL.setAttribute("opacity", (b.blush * bl.op * faceOp).toFixed(3));

		this.rig.blushR.setAttribute("cx", br.x.toFixed(2));
		this.rig.blushR.setAttribute("cy", blushY.toFixed(2));
		this.rig.blushR.setAttribute("rx", (blushR0 * blushScaleR).toFixed(2));
		this.rig.blushR.setAttribute("opacity", (b.blush * br.op * faceOp).toFixed(3));

		// 胡须以锚点为局部原点缩放与平移;原始路径在 yaw=0 精确保持,
		// 不再用相对原点的 translate + scale 把须线甩离脸缘。
		const wl = faceProj(thetaOf(FACE.whiskerL[0]), phi);
		const wr = faceProj(thetaOf(FACE.whiskerR[0]), phi);
		const whiskerWobble = Math.sin((TAU * now) / 2800) * 1.2;
		const whiskerBaseOp = b.whiskers * 0.55;
		const whiskerScaleL = clamp(Math.abs(wl.sx), 0.25, 1);
		const whiskerScaleR = clamp(Math.abs(wr.sx), 0.25, 1);

		this.rig.whiskerLG.setAttribute("opacity", (whiskerBaseOp * wl.op * faceOp).toFixed(3));
		this.rig.whiskerRG.setAttribute("opacity", (whiskerBaseOp * wr.op * faceOp).toFixed(3));
		this.rig.whiskerLG.setAttribute(
			"transform",
			`translate(${wl.x.toFixed(2)} ${(FACE.whiskerL[1] + pitchY).toFixed(2)}) ` +
				`rotate(${whiskerWobble.toFixed(2)}) scale(${whiskerScaleL.toFixed(3)} 1) ` +
				`translate(${-FACE.whiskerL[0]} ${-FACE.whiskerL[1]})`,
		);
		this.rig.whiskerRG.setAttribute(
			"transform",
			`translate(${wr.x.toFixed(2)} ${(FACE.whiskerR[1] + pitchY).toFixed(2)}) ` +
				`rotate(${(-whiskerWobble).toFixed(2)}) scale(${whiskerScaleR.toFixed(3)} 1) ` +
				`translate(${-FACE.whiskerR[0]} ${-FACE.whiskerR[1]})`,
		);
		// 左右前爪:统一投影,锚点为 FACE 爪位
		const pl = faceProj(thetaOf(FACE.pawL[0]), phi);
		const pr = faceProj(thetaOf(FACE.pawR[0]), phi);

		this.rig.pawLG.setAttribute("opacity", (pl.op * faceOp).toFixed(3));
		this.rig.pawRG.setAttribute("opacity", (pr.op * faceOp).toFixed(3));

		this.rig.pawLG.setAttribute(
			"transform",
			`translate(${(FACE.pawL[0] + b.pawLX + (pl.x - FACE.pawL[0])).toFixed(2)} ${(FACE.pawL[1] + b.pawY + b.pawLY).toFixed(2)}) ` +
				`rotate(${b.pawLRot.toFixed(2)}) scale(${(b.pawLScale * pl.sx).toFixed(3)} ${b.pawLScale.toFixed(3)}) ` +
				`translate(${-FACE.pawL[0]} ${-FACE.pawL[1]})`,
		);
		this.rig.pawRG.setAttribute(
			"transform",
			`translate(${(FACE.pawR[0] + b.pawRX + (pr.x - FACE.pawR[0])).toFixed(2)} ${(FACE.pawR[1] + b.pawY + b.pawRY).toFixed(2)}) ` +
				`rotate(${b.pawRRot.toFixed(2)}) scale(${(b.pawRScale * pr.sx).toFixed(3)} ${b.pawRScale.toFixed(3)}) ` +
				`translate(${-FACE.pawR[0]} ${-FACE.pawR[1]})`,
		);

		// 思考光环
		this.rig.haloG.setAttribute("opacity", b.halo > 0 ? "1" : "0");
		if (b.halo > 0) {
			const speed = frame.haloFast ? 2.6 : 1.4;
			const ang = (now / 1000) * speed;
			for (let i = 0; i < this.rig.haloDots.length; i++) {
				const a = ang + i * Math.PI;
				this.rig.haloDots[i].setAttribute("cx", (130 + 48 * Math.cos(a)).toFixed(2));
				this.rig.haloDots[i].setAttribute("cy", (32 + 11 * Math.sin(a)).toFixed(2));
			}
		}

		// zzz 睡眠粒子
		const zOn = b.zzz > 0;
		for (let i = 0; i < this.rig.zzzEls.length; i++) {
			const z = this.rig.zzzEls[i];
			if (!zOn) {
				if (z.getAttribute("opacity") !== "0") z.setAttribute("opacity", "0");
				continue;
			}
			const zp = (now * 0.00033 + i / 3) % 1;
			const zo = (zp < 0.18 ? zp / 0.18 : 1 - (zp - 0.18) / 0.82) * 0.8 * b.zzz;
			z.setAttribute("opacity", zo.toFixed(3));
			z.setAttribute("font-size", (12 + zp * 11).toFixed(1));
			z.setAttribute(
				"transform",
				`translate(${(182 + zp * 34 + 4 * Math.sin(zp * 9)).toFixed(2)} ${(44 - zp * 42).toFixed(2)}) rotate(${(-10 + zp * 14).toFixed(1)})`,
			);
		}
	}

	destroy(): void {
		this.rig.svg.remove();
	}

	private renderMouth(
		b: BodyState,
		mx: number,
		my: number,
		persScaleX: number,
		opacity: number,
	): void {
		if (opacity <= 0.01) {
			this.rig.mouthG.setAttribute("opacity", "0");
			this.rig.mouthG.style.display = "none";
			return;
		}
		this.rig.mouthG.style.display = "";
		this.rig.mouthG.setAttribute("opacity", opacity.toFixed(3));

		const shapeId = b.mouth ?? "w";
		if (shapeId !== this.curMouthShape) {
			this.curMouthShape = shapeId;
			const geom = MOUTH_SHAPES[shapeId] ?? MOUTH_SHAPES.w;
			this.rig.mouthLine.setAttribute("d", geom.lineD);
			if (geom.fillD) {
				this.rig.mouthCavity.setAttribute("d", geom.fillD);
				this.rig.mouthCavity.setAttribute("opacity", "1");
			} else {
				this.rig.mouthCavity.setAttribute("opacity", "0");
			}
			if (geom.tongueD) {
				this.rig.mouthTongue.setAttribute("d", geom.tongueD);
				this.rig.mouthTongue.setAttribute("opacity", "1");
			} else {
				this.rig.mouthTongue.setAttribute("opacity", "0");
			}
		}

		const ms = b.mouthScale ?? 1;
		this.rig.mouthG.setAttribute(
			"transform",
			`translate(${mx.toFixed(2)} ${my.toFixed(2)}) scale(${persScaleX.toFixed(3)} ${ms.toFixed(3)}) translate(${-130} ${-156})`,
		);
	}

	private renderEye(
		eyeG: SVGGElement,
		node: SVGPathElement,
		sparkleA: SVGCircleElement,
		sparkleB: SVGCircleElement,
		eye: EyeState,
		targetX: number,
		targetY: number,
		cn: number,
		opacity: number,
	): void {
		const ring = eye.ring ?? EYE_RINGS.round;
		if (ring !== (node as unknown as { __ring?: EyeRing }).__ring) {
			(node as unknown as { __ring?: EyeRing }).__ring = ring;
			// 归一化轮廓点乘以眼半径,并缓存谷底半径(高光内收用)
			let rMin = Number.POSITIVE_INFINITY;
			const scaled: [number, number][] = [];
			for (const p of ring) {
				const x = p[0] * FACE.eyeRadius;
				const y = p[1] * FACE.eyeRadius;
				scaled.push([x, y]);
				rMin = Math.min(rMin, Math.hypot(x, y));
			}
			(node as unknown as { __rMin?: number }).__rMin = rMin;
			node.setAttribute("d", smoothClosedPath(scaled));
		}

		if (cn <= 0.02 || opacity <= 0.01) {
			eyeG.setAttribute("opacity", "0");
			eyeG.style.display = "none";
			return;
		}
		eyeG.style.display = "";
		eyeG.setAttribute("opacity", opacity.toFixed(3));

		const open = clamp(eye.open, 0.02, 2.4);
		const sy = clamp(eye.scaleY * open, 0.02, 2.4);
		const sx = clamp(eye.scaleX * cn, 0.02, 2.4);

		eyeG.setAttribute(
			"transform",
			`translate(${targetX.toFixed(2)} ${targetY.toFixed(2)})` +
				(eye.rotate ? ` rotate(${eye.rotate.toFixed(1)})` : "") +
				` scale(${sx.toFixed(3)} ${sy.toFixed(3)})`,
		);

		// 高光透明度随睁眼幅度
		const sparkleOp = clamp((open - 0.28) / 0.5, 0, 1);
		sparkleA.setAttribute("opacity", (0.95 * sparkleOp).toFixed(3));
		sparkleB.setAttribute("opacity", (0.75 * sparkleOp).toFixed(3));
		// 高光视差漂移;窄谷眼环(星形/月牙)内收防贴边出界
		const spx = eye.lookX * 0.12;
		const spy = eye.lookY * 0.12;
		const rMin = (node as unknown as { __rMin?: number }).__rMin ?? FACE.eyeRadius;
		const pull = (x: number, y: number, cap: number): [number, number] => {
			const r = Math.hypot(x, y);
			return r > cap ? [(x / r) * cap, (y / r) * cap] : [x, y];
		};
		const [ax, ay] = pull(-4.5 + spx, -4.5 + spy, rMin * 0.6);
		const [bx, by] = pull(4.0 + spx * 0.6, 3.5 + spy * 0.6, rMin * 0.55);
		// 高光抵抗透视压扁:水平向反向缩放抵消眼形的 cn 压缩,保持正圆;
		// 垂直向保留压缩(眼睑压光的物理语义)
		const inv = 1 / Math.max(sx, 0.3);
		sparkleA.setAttribute("cx", ax.toFixed(2));
		sparkleA.setAttribute("cy", ay.toFixed(2));
		sparkleA.setAttribute("transform", `scale(${inv.toFixed(3)} 1)`);
		sparkleB.setAttribute("cx", bx.toFixed(2));
		sparkleB.setAttribute("cy", by.toFixed(2));
		sparkleB.setAttribute("transform", `scale(${inv.toFixed(3)} 1)`);
	}
}
