import HeroLeft from "./HeroLeft";
import HeroRight from "./HeroRight";

/**
 * Hero - 首页英雄区容器
 *
 * 由首页网格（routes/index.tsx）分配 50/50 宽度，
 * 本组件只负责左右拼装与高度撑满。
 */
const Hero = () => {
	return (
		<div className="grid h-full grid-cols-1 md:grid-cols-2">
			<div className="min-h-[420px] border-r border-edge-hairline">
				<HeroLeft />
			</div>
			<div className="min-h-[420px] p-4">
				<HeroRight />
			</div>
		</div>
	);
};

export default Hero;
