import type { Announcement } from "@features/settings/model/types";
import { AnimatePresence, motion } from "motion/react";
import { BannerFace, BannerStage } from "./BannerStage";
import { useBannerTicker } from "./use-banner-ticker";

const HALF = 0.25; // 折叠/展开各半程，合计 0.5s 落在 NN/g 金区间

/**
 * 横幅方向 A · 翻牌折叠
 *
 * split-flap 路牌的两段式换页：旧面向下折平（rotateX → 90°）消失，
 * 新面从折平展开。正交投影（无 perspective / translateZ）——静止态
 * transform 为 identity，文字始终清晰；也修复了真棱柱在 28px 条上
 * 「像内部内容在转」与「两条时退化成平面」两个观感问题。
 */
export function BannerFlip({ items }: { items: Announcement[] }) {
	const { index, hoverHandlers, wheelRef } = useBannerTicker(items.length);

	return (
		<BannerStage
			items={items}
			index={index}
			stageRef={wheelRef}
			{...hoverHandlers}
			className="h-7 overflow-hidden"
		>
			<AnimatePresence mode="wait" initial={false}>
				<motion.div
					key={items[index].id}
					exit={{ rotateX: 90 }}
					initial={{ rotateX: -90 }}
					animate={{ rotateX: 0 }}
					transition={{ duration: HALF, ease: [0.4, 0, 0.2, 1] }}
					className="h-7 origin-center"
				>
					<BannerFace a={items[index]} />
				</motion.div>
			</AnimatePresence>
		</BannerStage>
	);
}
