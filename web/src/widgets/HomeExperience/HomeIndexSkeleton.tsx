import { Skeleton } from "@shared/ui/base/skeleton";

/** 首页近期笔墨与碎念来信专属骨架屏。 */
export function HomeIndexSkeleton() {
	return (
		<section
			aria-label="正在加载近期笔墨与动态"
			className="mx-auto max-w-7xl scroll-mt-24 px-5 pt-20 sm:px-8 lg:px-12 lg:pt-28"
		>
			<div className="grid min-w-0 grid-cols-1 gap-14 lg:grid-cols-[1.62fr_1fr] lg:gap-16">
				{/* 左栏：近期笔墨骨架 */}
				<div className="min-w-0">
					<div className="mb-7">
						<Skeleton className="h-2.5 w-24 rounded" />
						<Skeleton className="mt-2.5 h-7 w-32 rounded-lg" />
					</div>

					{/* 01 焦点篇目 */}
					<div className="relative mb-7 border-l-2 border-primary/30 pl-4">
						<Skeleton className="h-3 w-8 rounded" />
						<Skeleton className="mt-1.5 h-3 w-28 rounded" />
						<Skeleton className="mt-2.5 h-6 w-4/5 rounded-lg" />
					</div>

					{/* 02-05 后续篇目 */}
					<div className="divide-y divide-border/30">
						{Array.from({ length: 4 }).map((_, i) => (
							<div
								key={i}
								className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-baseline gap-3 py-3.5 first:pt-0 last:pb-0"
							>
								<Skeleton className="h-3.5 w-4 rounded" />
								<div>
									<Skeleton className="h-4 w-3/4 rounded" />
									<Skeleton className="mt-1.5 h-3 w-12 rounded" />
								</div>
								<Skeleton className="h-3.5 w-14 rounded" />
							</div>
						))}
					</div>

					<Skeleton className="mt-7 h-4 w-28 rounded" />
				</div>

				{/* 右栏：碎念 + 来信骨架 */}
				<div className="min-w-0 lg:border-l lg:border-border/40 lg:pl-10">
					{/* 碎念 */}
					<div>
						<div className="mb-5">
							<Skeleton className="h-2.5 w-16 rounded" />
							<Skeleton className="mt-2.5 h-7 w-20 rounded-lg" />
						</div>
						<div className="space-y-4">
							<div className="space-y-1.5 border-l border-border/80 pl-3.5">
								<Skeleton className="h-3.5 w-full rounded" />
								<Skeleton className="h-3 w-16 rounded" />
							</div>
							<div className="space-y-1.5 border-l border-border/80 pl-3.5">
								<Skeleton className="h-3.5 w-4/5 rounded" />
								<Skeleton className="h-3 w-16 rounded" />
							</div>
						</div>
						<Skeleton className="mt-5 h-3.5 w-24 rounded" />
					</div>

					<hr className="my-8 border-0 border-t border-border/40" />

					{/* 来信 */}
					<div>
						<div className="mb-5">
							<Skeleton className="h-2.5 w-16 rounded" />
							<Skeleton className="mt-2.5 h-7 w-20 rounded-lg" />
						</div>
						<div className="space-y-5">
							<div className="relative space-y-2 pl-6">
								<Skeleton className="h-3.5 w-full rounded" />
								<Skeleton className="h-3.5 w-5/6 rounded" />
								<div className="flex justify-end pt-1">
									<Skeleton className="h-3 w-16 rounded" />
								</div>
							</div>
							<div className="relative space-y-2 border-t border-border/25 pt-4 pl-6">
								<Skeleton className="h-3.5 w-11/12 rounded" />
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
