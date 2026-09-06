import { Skeleton } from "@shared/ui/base/skeleton";

/**
 * 首页整页骨架屏：与真实 HomeExperience 保持 1:1 几何与布局对齐，
 * 消除 TanStack Router loader 加载与路由切换时的白屏与布局跳动（Zero CLS）。
 */
export function HomeExperienceSkeleton() {
	return (
		<div aria-busy="true" className="home-surface overflow-clip bg-background text-foreground">
			<span className="sr-only" role="status">
				首页正在加载内容
			</span>

			{/* 1. 首屏个人序章骨架 */}
			<section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-18">
				<div className="grid items-center gap-14 lg:min-h-96 lg:grid-cols-2 lg:gap-24">
					<div className="max-w-xl">
						<Skeleton className="h-11 w-64 rounded-xl sm:h-14 sm:w-80 lg:h-16 lg:w-96" />
						<Skeleton className="mt-4 h-6 w-36 rounded-lg" />
						<div className="mt-6 space-y-2">
							<Skeleton className="h-4.5 w-full max-w-md rounded" />
							<Skeleton className="h-4.5 w-4/5 max-w-sm rounded" />
						</div>

						<div className="mt-9 flex flex-wrap gap-3">
							<Skeleton className="h-9 w-24 rounded-full border border-border/50" />
							<Skeleton className="h-9 w-28 rounded-full border border-border/50" />
							<Skeleton className="h-9 w-24 rounded-full border border-border/50" />
						</div>
					</div>

					<div className="flex justify-center lg:justify-end">
						<Skeleton className="size-44 rounded-full border border-border/40 sm:size-52 lg:size-64" />
					</div>
				</div>

				<div className="mt-14 flex items-center justify-between border-t border-border/40 pt-6">
					<Skeleton className="h-4 w-72 rounded" />
					<Skeleton className="h-4 w-20 rounded" />
				</div>
			</section>

			{/* 2. 近期笔墨与碎念/来信双栏骨架 */}
			<section className="mx-auto max-w-7xl px-5 pt-20 sm:px-8 lg:px-12 lg:pt-28">
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
								<div className="border-l border-border/80 pl-3.5 space-y-1.5">
									<Skeleton className="h-3.5 w-full rounded" />
									<Skeleton className="h-3 w-16 rounded" />
								</div>
								<div className="border-l border-border/80 pl-3.5 space-y-1.5">
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
								<div className="relative pl-6 space-y-2">
									<Skeleton className="h-3.5 w-full rounded" />
									<Skeleton className="h-3.5 w-5/6 rounded" />
									<div className="flex justify-end pt-1">
										<Skeleton className="h-3 w-16 rounded" />
									</div>
								</div>
								<div className="relative border-t border-border/25 pt-4 pl-6 space-y-2">
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

			{/* 3. 笔耕不辍时间线骨架 */}
			<section className="mx-auto max-w-7xl px-5 pt-20 sm:px-8 sm:pt-24 lg:px-12 lg:pt-28">
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
						<div className="absolute top-14 inset-x-0 flex justify-around px-8 text-xs text-muted-foreground/40 font-medium">
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

			{/* 4. 继续逛逛探索导航骨架 */}
			<section className="mx-auto max-w-7xl px-5 py-28 sm:px-8 lg:px-12 lg:py-36">
				<div className="flex flex-col items-center text-center">
					<Skeleton className="h-7 w-32 rounded-lg" />
					<Skeleton className="mt-4 h-4 w-72 rounded" />

					<div className="mt-14 flex max-w-4xl flex-wrap justify-center gap-x-8 gap-y-6 sm:gap-x-10">
						{Array.from({ length: 8 }).map((_, i) => (
							<Skeleton key={i} className="h-5 w-20 rounded-md" />
						))}
					</div>
				</div>
			</section>
		</div>
	);
}
