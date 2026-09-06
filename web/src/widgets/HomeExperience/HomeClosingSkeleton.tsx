import { Skeleton } from "@shared/ui/base/skeleton";

/** 首页探索导航专属骨架屏（对齐诗意双核与底部自然消融层）。 */
export function HomeClosingSkeleton() {
	return (
		<section className="relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20 lg:pt-36 lg:pb-24">
			<div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
				{/* 诗意大字骨架 */}
				<div className="space-y-2.5 flex flex-col items-center">
					<Skeleton className="h-7 w-32 rounded-lg sm:h-8 sm:w-40" />
					<Skeleton className="h-7 w-28 rounded-lg sm:h-8 sm:w-36" />
				</div>

				{/* 中段留下印记与订阅通信双核骨架 */}
				<div className="mt-14 flex items-center justify-center gap-8 sm:gap-14">
					<div className="flex flex-col items-center gap-1.5">
						<Skeleton className="h-3.5 w-14 rounded" />
						<Skeleton className="h-3.5 w-16 rounded" />
					</div>
					<div aria-hidden className="h-8 w-px bg-border/40" />
					<div className="flex flex-col items-center gap-1.5">
						<Skeleton className="h-3.5 w-14 rounded" />
						<Skeleton className="h-3.5 w-24 rounded" />
					</div>
				</div>

				{/* 下段平铺漫游导航骨架 */}
				<div className="mt-12 flex justify-center gap-4 text-xs">
					<Skeleton className="h-4 w-12 rounded" />
					<span className="text-border/80">·</span>
					<Skeleton className="h-4 w-10 rounded" />
					<span className="text-border/80">·</span>
					<Skeleton className="h-4 w-10 rounded" />
					<span className="text-border/80">·</span>
					<Skeleton className="h-4 w-14 rounded" />
				</div>
			</div>
		</section>
	);
}
