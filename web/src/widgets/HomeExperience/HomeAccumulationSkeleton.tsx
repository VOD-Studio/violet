import { Skeleton } from "@shared/ui/base/skeleton";

/** 首页积微成著时间线专属骨架屏。 */
export function HomeAccumulationSkeleton() {
	return (
		<section
			aria-label="正在加载发布足迹"
			className="mx-auto max-w-7xl px-5 pt-20 sm:px-8 sm:pt-24 lg:px-12 lg:pt-28"
		>
			<div className="mx-auto max-w-6xl">
				<Skeleton className="mx-auto h-8 w-36 rounded-lg sm:h-9 sm:w-44" />

				<div className="relative mt-8 h-20">
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
					<div className="absolute top-14 inset-x-0 flex justify-around px-8 font-medium text-xs text-muted-foreground/40">
						<span>秋</span>
						<span>冬</span>
						<span>春</span>
						<span>夏</span>
					</div>
				</div>

				<div className="mt-8 space-y-2 text-center">
					<Skeleton className="mx-auto h-4 w-64 rounded" />
					<Skeleton className="mx-auto h-3.5 w-44 rounded" />
				</div>
			</div>
		</section>
	);
}
