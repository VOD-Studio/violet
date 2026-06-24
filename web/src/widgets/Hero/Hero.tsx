import HeroLeft from "./HeroLeft";
import HeroRight from "./HeroRight";

/**
 * Hero - 首页英雄区容器
 *
 * 高度链全程走 flex-1（不依赖 h-full/父级定高，避免 flex-grow 父项下
 * h-full 失效导致塌陷留白）：
 * section(flex-col, flex-[4]) → 本容器(flex-1) → 左右栏(flex-1, min-h-0)。
 *
 * 桌面端左右 50/50（flex-row），移动端单列堆叠（flex-col）。
 */
const Hero = () => {
	return (
		<div className="flex min-h-0 flex-1 flex-col md:flex-row">
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-edge-hairline md:border-b-0 md:border-r">
				<HeroLeft />
			</div>
			<div className="flex min-h-0 flex-1 flex-col p-4">
				<HeroRight />
			</div>
		</div>
	);
};

export default Hero;
