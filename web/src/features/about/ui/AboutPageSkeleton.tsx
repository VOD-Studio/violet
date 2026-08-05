import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";

/**
 * AboutPageSkeleton - 关于页整页骨架屏
 *
 * settings 未就绪时的页面级占位（settings 是绝大多数区块的前置）。
 * 通用区块骨架：区块标题条 + 几行内容条，重复 3 段模拟区块流。
 * 独立数据源区块（life stats / changelog）各自有区块级骨架，渐进替换。
 */
export function AboutPageSkeleton() {
	return (
		<div className="mx-auto w-full max-w-5xl space-y-16 px-6 py-14">
			{Array.from({ length: 3 }, (_, i) => (
				<section key={i}>
					<ShimmerSkeleton className="mb-6 h-3 w-20" />
					<ShimmerSkeleton className="h-5 w-2/3" />
					<ShimmerSkeleton className="mt-3 h-5 w-1/2" />
					<ShimmerSkeleton className="mt-2 h-5 w-3/4" />
				</section>
			))}
		</div>
	);
}
