import type { Announcement } from "@features/settings/model/types";
import { AnimatePresence, motion } from "motion/react";
import { BannerFace, BannerStage } from "./BannerStage";
import { useBannerTicker } from "./use-banner-ticker";

/**
 * 横幅方向 B · 渐隐轮换
 *
 * 同一位置整条淡入淡出（300ms），无位移、无 3D。最安静的横幅——
 * 装置感为零，只有文字在换。
 */
export function BannerCrossfade({ items }: { items: Announcement[] }) {
	const { index, hoverHandlers, wheelRef } = useBannerTicker(items.length);

	return (
		<BannerStage items={items} index={index} stageRef={wheelRef} {...hoverHandlers}>
			<AnimatePresence mode="wait" initial={false}>
				<motion.div
					key={items[index].id}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.3 }}
				>
					<BannerFace a={items[index]} />
				</motion.div>
			</AnimatePresence>
		</BannerStage>
	);
}
