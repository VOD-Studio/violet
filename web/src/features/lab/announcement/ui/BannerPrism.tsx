import type { Announcement } from "@features/settings/model/types";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { BannerFace, BannerStage } from "./BannerStage";
import { useBannerTicker, usePrefersReducedMotion } from "./use-banner-ticker";

const FLIP_EASE = [0.4, 0, 0.2, 1] as const;
const FLIP_DURATION = 0.6;
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
 * 横幅方向 A · 棱柱旋转（真 3D）
 *
 * N 条公告 = N 面实体棱柱绕 X 轴旋转到当前面（面自带横幅底色，
 * 转的是面板不是透明文字）。文字模糊的修法：3D 层只承担旋转过渡，
 * 动画落定后切到无 transform 的静态层——静止态永远清晰，模糊只
 * 存在于旋转过程中。reduced-motion 下直接静态展示。
 */
export function BannerPrism({ items }: { items: Announcement[] }) {
	const { index, hoverHandlers, wheelRef } = useBannerTicker(items.length);
	const reduced = usePrefersReducedMotion();
	const n = items.length;

	const [settled, setSettled] = useState(true);
	// 动画层从上一落定角起转，避免连续翻页时跳回 0 度
	const prevRotationRef = useRef(0);
	const targetRotation = -(360 / n) * index;

	// reduced 仅作守卫：翻页要播动画；reduced 切 true 时渲染分支直接走静态层，无需 effect 响应
	// biome-ignore lint/correctness/useExhaustiveDependencies: 见上
	useEffect(() => {
		if (reduced) return;
		setSettled(false);
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
			style={{ perspective: "800px" }}
		>
			<motion.div
				className="relative"
				style={{ transformStyle: "preserve-3d", height: FACE_HEIGHT }}
				initial={{ rotateX: prevRotationRef.current }}
				animate={{ rotateX: targetRotation }}
				transition={{ duration: FLIP_DURATION, ease: FLIP_EASE }}
				onAnimationComplete={() => {
					prevRotationRef.current = targetRotation;
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
