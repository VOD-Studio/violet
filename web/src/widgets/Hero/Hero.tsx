import HeroLeft from "./HeroLeft";
import HeroRight from "./HeroRight";

/**
 * Hero - 首页英雄区容器
 *
 * 由首页网格分配宽高（section flex-[4] 给出 80% 高度），本组件只负责
 * 左右 50/50 拼装并撑满父级。
 *
 * 高度链：section(min-h-0 flex) → 本 grid(h-full) → 左右栏(h-full)。
 * 移动端单列堆叠（grid-cols-1），各占自然高度，避免写死 min-height 撑爆矮屏。
 */
const Hero = () => {
	return (
		<div className="grid h-full grid-cols-1 md:grid-cols-2">
			<div className="flex min-h-0 flex-col overflow-hidden border-b border-edge-hairline md:border-b-0 md:border-r">
				<HeroLeft />
			</div>
			<div className="flex min-h-0 flex-col p-4">
				<HeroRight />
			</div>
		</div>
	);
};

export default Hero;
