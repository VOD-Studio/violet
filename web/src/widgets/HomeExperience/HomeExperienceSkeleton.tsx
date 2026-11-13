import { HomeAccumulationSkeleton } from "./HomeAccumulationSkeleton";
import { HomeClosingSkeleton } from "./HomeClosingSkeleton";
import { HomeIndexSkeleton } from "./HomeIndexSkeleton";
import { HomePreludeSkeleton } from "./HomePreludeSkeleton";

interface HomeExperienceSkeletonProps {
	/**
	 * 与后台 home_footprint_enabled 一致，关闭时不预留时间线占地。
	 *
	 * @default true
	 */
	showFootprint?: boolean;
}

/** 首页按板块保留占地的加载占位。 */
export function HomeExperienceSkeleton({ showFootprint = true }: HomeExperienceSkeletonProps) {
	return (
		<div aria-busy="true" className="overflow-clip text-foreground">
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
