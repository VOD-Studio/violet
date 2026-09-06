import { Skeleton } from "@shared/ui/base/skeleton";

/** 首页积微成著时间线专属骨架屏（与正式 HomeAccumulation 1:1 几何高度对齐）。 */
export function HomeAccumulationSkeleton() {
	return (
		<section
			aria-label="正在加载发布足迹"
			className="mx-auto max-w-7xl px-5 pt-20 sm:px-8 sm:pt-24 lg:px-12 lg:pt-28"
		>
			<div className="mx-auto max-w-6xl">
				<Skeleton className="mx-auto h-8 w-36 rounded-lg sm:h-9 sm:w-44" />

				<figure className="mt-10 sm:mt-12">
					<div className="relative h-20">
						<div className="absolute inset-x-0 top-8 h-px bg-border/60">
							{/* 模拟时间轴上的静态节点点缀 */}
							<span className="absolute top-1/2 left-[12%] size-1.5 -translate-y-1/2 rounded-full bg-muted-foreground/30" />
							<span className="absolute top-1/2 left-[28%] size-1.5 -translate-y-1/2 rounded-full bg-muted-foreground/30" />
							<span className="absolute top-1/2 left-[52%] size-2 -translate-y-1/2 rounded-full bg-muted-foreground/30" />
							<span className="absolute top-1/2 left-[74%] size-1.5 -translate-y-1/2 rounded-full bg-muted-foreground/30" />
							<span className="absolute top-1/2 left-[88%] size-2.5 -translate-y-1/2 rounded-full bg-primary/40" />

							{/* 右端终点红色刻度线与今 */}
							<div className="absolute top-1/2 right-0 z-10 -translate-y-1/2">
								<span className="absolute -top-4 -right-1 text-[11px] font-medium text-primary/50">
									今
								</span>
								<span className="block h-3.5 w-px bg-primary/50" />
							</div>
						</div>

						{/* 四季刻度占位 */}
						<div className="absolute top-14 inset-x-0 flex justify-around px-8 text-xs font-medium text-muted-foreground/40">
							<span>秋</span>
							<span>冬</span>
							<span>春</span>
							<span>夏</span>
						</div>
					</div>

					<div className="mt-12 sm:mt-14 space-y-3.5 pt-5 text-center">
						<Skeleton className="mx-auto h-4 w-72 rounded" />
						<Skeleton className="mx-auto h-3.5 w-48 rounded" />
					</div>
				</figure>
			</div>
		</section>
	);
}
