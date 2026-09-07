import { HomeAccumulationSkeleton } from "./HomeAccumulationSkeleton";
import { HomeClosingSkeleton } from "./HomeClosingSkeleton";
import { HomeIndexSkeleton } from "./HomeIndexSkeleton";
import { HomePreludeSkeleton } from "./HomePreludeSkeleton";

interface HomeExperienceSkeletonProps {
	/** 是否渲染时间线骨架（与后台 home_footprint_enabled 开关联动，缺省为 true） */
	showFootprint?: boolean;
}

/**
 * 首页组合骨架屏：由各板块专属独立子骨架屏模块化装配而成。
 */
export function HomeExperienceSkeleton({ showFootprint = true }: HomeExperienceSkeletonProps) {
	return (
		<div aria-busy="true" className="home-surface overflow-clip bg-background text-foreground">
			<span className="sr-only" role="status">
				首页正在加载内容
			</span>
			<HomePreludeSkeleton />
			<HomeIndexSkeleton />
			{showFootprint ? <HomeAccumulationSkeleton /> : null}
			<HomeClosingSkeleton />
		</div>
	);
}
