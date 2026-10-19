import { Skeleton } from "@violet/ui";

/** 首页近稿与偶得尺素专属骨架屏（与正式 HomeIndex 1:1 几何高度对齐）。 */
export function HomeIndexSkeleton() {
	return (
		<section
			aria-label="正在加载近稿与动态"
			className="mx-auto max-w-7xl scroll-mt-24 px-5 pt-20 sm:px-8 lg:px-12 lg:pt-28"
		>
			<div className="grid min-w-0 grid-cols-1 gap-14 lg:grid-cols-[1.62fr_1fr] lg:gap-16">
				{/* 左栏：近稿骨架 */}
				<div className="min-w-0">
					<div className="mb-7">
						<Skeleton className="h-2.5 w-24 rounded" />
						<Skeleton className="mt-2 h-9 w-32 rounded-lg" />
					</div>

					{/* 焦点篇目微卡片骨架 */}
					<div className="mb-6 rounded-2xl border border-border/50 bg-muted/20 p-5 sm:p-6">
						<div className="flex items-center justify-between">
							<Skeleton className="h-4.5 w-16 rounded-full" />
							<Skeleton className="h-3 w-14 rounded" />
						</div>
						<Skeleton className="mt-3.5 h-7 w-4/5 rounded-lg" />
					</div>

					{/* 后续篇目交互行骨架 */}
					<div className="space-y-1">
						{Array.from({ length: 4 }).map((_, i) => (
							<div
								key={i}
								className="-mx-2.5 flex items-center justify-between gap-4 px-2.5 py-2.5"
							>
								<div className="flex items-center gap-3">
									<Skeleton className="h-3.5 w-4 rounded" />
									<Skeleton className="h-4.5 w-48 rounded" />
								</div>
								<Skeleton className="h-3.5 w-14 rounded" />
							</div>
						))}
					</div>

					<Skeleton className="mt-7 h-4 w-28 rounded" />
				</div>

				{/* 右栏：偶得 + 尺素骨架 */}
				<div className="min-w-0 lg:border-l lg:border-border/40 lg:pl-10">
					{/* 偶得 */}
					<div>
						<div className="mb-5">
							<Skeleton className="h-2.5 w-16 rounded" />
							<Skeleton className="mt-2 h-9 w-20 rounded-lg" />
						</div>
						<div className="space-y-4">
							<div className="space-y-2 border-l border-border/80 pl-3.5">
								<Skeleton className="h-3.5 w-full rounded" />
								<Skeleton className="h-3 w-16 rounded" />
							</div>
							<div className="space-y-2 border-l border-border/80 pl-3.5">
								<Skeleton className="h-3.5 w-4/5 rounded" />
								<Skeleton className="h-3 w-16 rounded" />
							</div>
						</div>
						<Skeleton className="mt-5 h-3.5 w-24 rounded" />
					</div>

					<hr className="my-7 border-0 border-t border-border/40" />

					{/* 尺素 */}
					<div>
						<div className="mb-5">
							<Skeleton className="h-2.5 w-16 rounded" />
							<Skeleton className="mt-2 h-9 w-20 rounded-lg" />
						</div>
						<div className="space-y-5">
							<div className="relative space-y-2 pl-6">
								<Skeleton className="h-3.5 w-full rounded" />
								<Skeleton className="h-3.5 w-5/6 rounded" />
								<Skeleton className="h-3.5 w-2/3 rounded" />
								<div className="flex justify-end pt-1">
									<Skeleton className="h-3 w-16 rounded" />
								</div>
							</div>
							<div className="relative space-y-2 border-t border-border/25 pt-4 pl-6">
								<Skeleton className="h-3.5 w-full rounded" />
								<Skeleton className="h-3.5 w-4/5 rounded" />
								<Skeleton className="h-3.5 w-1/2 rounded" />
								<div className="flex justify-end pt-1">
									<Skeleton className="h-3 w-16 rounded" />
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
