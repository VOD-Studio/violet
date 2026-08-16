import type { Announcement } from "@features/settings/model/types";
import { AnimatePresence, motion } from "motion/react";
import { BannerFace, BannerStage } from "./BannerStage";
import { useBannerTicker } from "./use-banner-ticker";

const SLIDE_DURATION = 0.45;

/**
 * 横幅方向 C · 滑轨推入
 *
 * 新公告从右侧推入、旧公告向左推出（绝对定位叠放同时进出），
 * 底部 2px 驻留进度线由 useBannerTicker 的单一 rAF 时钟驱动
 * （scaleX = progress）——暂停与手动翻页作用于同一时钟，进度
 * 与换页永不漂移。
 */
export function BannerSlide({ items }: { items: Announcement[] }) {
	const { index, progress, hoverHandlers, wheelRef } = useBannerTicker(items.length);

	return (
		<BannerStage
			items={items}
			index={index}
			stageRef={wheelRef}
			{...hoverHandlers}
			className="group h-7 overflow-hidden"
		>
			<AnimatePresence initial={false}>
				<motion.div
					key={items[index].id}
					initial={{ x: "100%" }}
					animate={{ x: 0 }}
					exit={{ x: "-100%" }}
					transition={{ duration: SLIDE_DURATION, ease: [0.4, 0, 0.2, 1] }}
					className="absolute inset-0"
				>
					<BannerFace a={items[index]} />
				</motion.div>
			</AnimatePresence>
			{/* 驻留进度线：同一 rAF 时钟，暂停/翻页即时联动 */}
			<span
				aria-hidden
				className="absolute bottom-0 left-0 z-10 h-0.5 w-full origin-left bg-primary-foreground/40 dark:bg-foreground/40"
				style={{ transform: `scaleX(${progress})` }}
			/>
		</BannerStage>
	);
}
