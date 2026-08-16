import type { Announcement } from "@features/settings/model/types";
import { motion } from "motion/react";
import { BannerFace, BannerStage } from "./BannerStage";
import { useBannerTicker } from "./use-banner-ticker";

const FLIP_EASE = [0.4, 0, 0.2, 1] as const;
const FLIP_DURATION = 0.6;
const FACE_HEIGHT = 28; // 每面高度 px（h-7），与生产 AnnouncementBar 一致

/** N 面棱柱的每面 transform：绕 X 轴 360/N 度 + 内切半径 translateZ */
function faceTransform(i: number, n: number): string {
	const angle = (360 / n) * i;
	const depth = FACE_HEIGHT / 2 / Math.tan(Math.PI / n);
	return `rotateX(${angle}deg) translateZ(${depth}px)`;
}

/**
 * 横幅方向 A · 棱柱旋转（生产现役基准）
 *
 * 生产 AnnouncementBar 的同款几何：N 条公告 = N 面棱柱绕 X 轴排列，
 * 容器整体 rotateX 旋转到当前面。作为对比基准陈列在 lab，
 * 与两个新候选（渐隐轮换 / 滑轨推入）并排比选。
 */
export function BannerPrism({ items }: { items: Announcement[] }) {
	const { index, handlers } = useBannerTicker(items.length);
	const n = items.length;

	return (
		<BannerStage items={items} index={index} {...handlers} style={{ perspective: "800px" }}>
			<motion.div
				className="relative"
				style={{ transformStyle: "preserve-3d", height: FACE_HEIGHT }}
				animate={{ rotateX: -(360 / n) * index }}
				transition={{ duration: FLIP_DURATION, ease: FLIP_EASE }}
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
