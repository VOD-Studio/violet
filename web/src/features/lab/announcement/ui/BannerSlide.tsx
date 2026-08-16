import type { Announcement } from "@features/settings/model/types";
import { AnimatePresence, motion } from "motion/react";
import { BannerFace, BannerStage } from "./BannerStage";
import { useBannerTicker } from "./use-banner-ticker";

const SLIDE_DURATION = 0.45;

/**
 * 横幅方向 C · 滑轨推入
 *
 * 新公告从右侧推入、旧公告向左推出（绝对定位叠放同时进出），
 * 底部 2px 驻留进度线把「还有几秒换下一条」可视化——信息最
 * 透明的一版。hover/focus 时节拍与进度线同步暂停。
 */
export function BannerSlide({ items }: { items: Announcement[] }) {
	const { index, intervalMs, handlers } = useBannerTicker(items.length);

	return (
		<BannerStage
			items={items}
			index={index}
			{...handlers}
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
			{/* 驻留进度线：key 随公告切换重置，hover 时与节拍一起暂停 */}
			<span
				key={`p-${items[index].id}`}
				aria-hidden
				className="absolute bottom-0 left-0 z-10 h-0.5 w-full origin-left bg-primary-foreground/40 motion-safe:animate-banner-progress group-hover:[animation-play-state:paused] dark:bg-foreground/40"
				style={{ animationDuration: `${intervalMs}ms` }}
			/>
		</BannerStage>
	);
}
