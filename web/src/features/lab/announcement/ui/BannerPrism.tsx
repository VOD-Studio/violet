import type { Announcement } from "@features/settings/model/types";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { BannerFace, BannerStage } from "./BannerStage";
import { useBannerTicker, usePrefersReducedMotion } from "./use-banner-ticker";

// 正交投影（无 perspective）的滚筒翻面——机场翻牌显示屏的做法：
// 3D 结构感来自 N 面滚筒与遮挡关系，旋转只是垂直压扁再展开，
// 没有单点透视的梯形畸变（近侧放大远侧缩小会被读作「特意放大」）
const FLIP_EASE = [0.2, 0, 0, 1] as const;
const FLIP_DURATION = 0.45;
const FACE_HEIGHT = 28; // 每面高度 px（h-7），与生产 AnnouncementBar 一致

/** N 面棱柱的每面 transform：绕 X 轴 360/N 度 + 内切半径 translateZ。
 * n=2 时内切半径为 0（两面共面、退化成平面翻牌），特判给半面高
 * 厚度，翻面时有实体板的厚度感 */
function faceTransform(i: number, n: number): string {
	const angle = (360 / n) * i;
	const depth = n === 2 ? FACE_HEIGHT / 2 : FACE_HEIGHT / 2 / Math.tan(Math.PI / n);
	return `rotateX(${angle}deg) translateZ(${depth}px)`;
}

/**
 * 横幅方向 A · 棱柱旋转（正交 3D 滚筒）
 *
 * N 条公告 = N 面实体滚筒绕 X 轴翻到当前面（面底色比槽底亮一档，
 * 转的是有边界的面板）。**无 perspective 的正交投影**：结构感来自
 * 滚筒遮挡关系，旋转只是垂直压扁再展开——没有单点透视的近大远小
 * 与梯形畸变（会被读作「特意放大再缩小」）。文字模糊的修法：3D 层
 * 只承担旋转过渡，落定后切无 transform 静态层。reduced-motion 下
 * 直接静态展示。
 */
export function BannerPrism({ items }: { items: Announcement[] }) {
	const { index, hoverHandlers, wheelRef } = useBannerTicker(items.length);
	const reduced = usePrefersReducedMotion();
	const n = items.length;

	const [settled, setSettled] = useState(true);
	/** 累计角度：每次翻页在上次落定角上 ±360/n，单调递进。
	 * 若按 index 推导（-(360/n)*index），第 n 条翻回第 1 条时目标从
	 * -(n-1)·360/n 跳回 0，动画会反向倒转一大圈——观感是「重置」 */
	const [rotation, setRotation] = useState(0);
	const prevIndexRef = useRef(0);
	// 动画层从上一落定角起转，避免动画层重挂载时跳回 0 度
	const prevRotationRef = useRef(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reduced 切 true 时渲染分支直接走静态层，无需 effect 响应
	useEffect(() => {
		const prev = prevIndexRef.current;
		if (index === prev) return;
		prevIndexRef.current = index;
		// 新旧 index 的最短方向：差 1 = 下一条（顺向翻），差 n-1 = 上一条（逆向翻）
		const delta = (((index - prev) % n) + n) % n;
		const dir = delta === n - 1 ? -1 : 1;
		setRotation((r) => r - dir * (360 / n));
		if (!reduced) setSettled(false);
	}, [index]);

	// reduced-motion / 单条：静态层兜底（effect 不会 unsettle）
	const staticFace = (
		<div className="overflow-hidden">
			<BannerFace a={items[index]} />
		</div>
	);

	if (settled || reduced || n <= 1) {
		return (
			<BannerStage
				items={items}
				index={index}
				stageRef={wheelRef}
				{...hoverHandlers}
				className="h-7 overflow-hidden"
			>
				{staticFace}
			</BannerStage>
		);
	}

	return (
		<BannerStage
			items={items}
			index={index}
			stageRef={wheelRef}
			{...hoverHandlers}
			className="h-7 overflow-hidden"
		>
			<motion.div
				className="relative"
				style={{ transformStyle: "preserve-3d", height: FACE_HEIGHT }}
				initial={{ rotateX: prevRotationRef.current }}
				animate={{ rotateX: rotation }}
				transition={{ duration: FLIP_DURATION, ease: FLIP_EASE }}
				onAnimationComplete={() => {
					prevRotationRef.current = rotation;
					setSettled(true);
				}}
			>
				{items.map((a, i) => (
					<div
						key={a.id}
						className="absolute inset-0 backface-hidden"
						style={{ transform: faceTransform(i, n) }}
					>
						<BannerFace a={a} />
					</div>
				))}
			</motion.div>
		</BannerStage>
	);
}
