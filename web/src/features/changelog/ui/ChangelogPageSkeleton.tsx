import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";

/**
 * ChangelogPageSkeleton - 更新日志页骨架屏
 *
 * 1:1 模拟真实布局：标题区 + （桌面端）左侧版本目录列 + 时间线版本块
 * （圆点 + 版本号 + 分类 pill + 条目行）。移动端目录为吸顶 chip 条，
 * 骨架阶段不模拟（chip 高度低，缺省不造成跳变）。
 */
export function ChangelogPageSkeleton() {
	return (
		<main className="mx-auto w-full max-w-6xl px-6 py-20">
			<header className="mb-16">
				<ShimmerSkeleton className="mb-2 h-3 w-24" />
				<ShimmerSkeleton className="h-10 w-44" />
				<ShimmerSkeleton className="mt-3 h-4 w-56" />
			</header>
			<div className="lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-16">
				{/* 版本目录列骨架（桌面端） */}
				<div className="hidden lg:block">
					<ShimmerSkeleton className="mb-4 h-3 w-12" />
					<div className="space-y-2.5 border-l border-edge-hairline pl-4">
						{Array.from({ length: 6 }, (_, i) => (
							<ShimmerSkeleton key={i} className="h-4 w-16" />
						))}
					</div>
				</div>
				<div className="relative space-y-14 border-l border-edge-hairline pl-10">
					{Array.from({ length: 3 }, (_, v) => (
						<div key={v} className="relative">
							<ShimmerSkeleton className="absolute top-2 -left-11.75 size-3.5 rounded-full" />
							<div className="flex items-baseline gap-4">
								<ShimmerSkeleton className="h-7 w-24" />
								<ShimmerSkeleton className="h-4 w-20" />
							</div>
							<div className="mt-6 space-y-7">
								<div>
									<ShimmerSkeleton className="h-5 w-14 rounded-full" />
									<div className="mt-4 space-y-2.5">
										<ShimmerSkeleton className="h-4 w-full" />
										<ShimmerSkeleton className="h-4 w-5/6" />
										<ShimmerSkeleton className="h-4 w-2/3" />
									</div>
								</div>
								<div>
									<ShimmerSkeleton className="h-5 w-14 rounded-full" />
									<div className="mt-4 space-y-2.5">
										<ShimmerSkeleton className="h-4 w-4/5" />
										<ShimmerSkeleton className="h-4 w-1/2" />
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</main>
	);
}
