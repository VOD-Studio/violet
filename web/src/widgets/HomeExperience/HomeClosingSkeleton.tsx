import { Skeleton } from "@shared/ui/base/skeleton";

/** 首页探索导航专属骨架屏（对齐 8 卡片网格与底部消融层）。 */
export function HomeClosingSkeleton() {
	return (
		<section
			aria-label="正在加载站点导航"
			className="relative overflow-hidden pt-24 sm:pt-28 lg:pt-32"
		>
			<div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
				<div className="flex flex-col items-center text-center">
					<Skeleton className="h-2.5 w-24 rounded" />
					<Skeleton className="mt-2.5 h-7 w-32 rounded-lg sm:h-8" />
					<Skeleton className="mt-3.5 h-4 w-72 rounded max-w-lg" />

					{/* 8 卡片网格骨架 */}
					<div className="mt-12 grid w-full max-w-3xl grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-4">
						{Array.from({ length: 8 }).map((_, i) => (
							<div
								key={i}
								className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/30 p-3.5"
							>
								<Skeleton className="size-9 shrink-0 rounded-xl" />
								<div className="min-w-0 flex-1 space-y-1.5">
									<Skeleton className="h-4 w-12 rounded" />
									<Skeleton className="h-2.5 w-16 rounded" />
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* 底部消融交接带占位 */}
			<div className="relative mt-16 h-36 w-full sm:h-44 lg:h-52">
				<div className="absolute inset-0 bg-linear-to-b from-transparent to-background/60" />
			</div>
		</section>
	);
}
