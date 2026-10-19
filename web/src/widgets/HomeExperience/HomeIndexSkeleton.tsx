import { Skeleton } from "@violet/ui";

/** 首页近稿时间线与偶得尺素的加载占位。 */
export function HomeIndexSkeleton() {
	return (
		<section
			aria-label="正在加载近稿与动态"
			className="mx-auto max-w-7xl scroll-mt-24 px-5 pt-20 sm:px-8 lg:px-12 lg:pt-28"
		>
			<div className="grid min-w-0 grid-cols-1 gap-14 lg:grid-cols-[1.62fr_1fr] lg:gap-12">
				{/* 左栏：近稿骨架 */}
				<div className="min-w-0">
					<div className="mb-4">
						<Skeleton className="h-3.5 w-24 rounded" />
						<Skeleton className="mt-1.5 h-6 w-20 rounded sm:h-7.5" />
					</div>

					<div className="relative">
						<div
							aria-hidden
							className="pointer-events-none absolute inset-y-5 left-3 w-px -translate-x-1/2 bg-linear-to-b from-border via-border/60 to-transparent"
						/>
						<div className="relative">
							{Array.from({ length: 5 }).map((_, index) => (
								<div key={index} className="relative py-3.5 pl-9 sm:pl-10">
									<div
										aria-hidden
										className="absolute left-3 top-3.5 flex h-5 -translate-x-1/2 items-center bg-background px-1"
									>
										<Skeleton className="h-2.5 w-3 rounded" />
									</div>
									{index === 0 ? (
										<>
											<div className="flex h-5 items-center gap-2">
												<Skeleton className="h-3 w-8 rounded" />
												<Skeleton className="h-3 w-14 rounded" />
											</div>
											<Skeleton className="mt-2 h-8 w-4/5 rounded" />
										</>
									) : (
										<>
											<div className="flex h-6 items-center justify-between gap-3 sm:gap-5">
												<Skeleton className="h-4 w-2/3 rounded" />
												<Skeleton className="h-3 w-14 shrink-0 rounded" />
											</div>
											<Skeleton className="mt-1 h-4 w-8 rounded" />
										</>
									)}
								</div>
							))}
						</div>
					</div>

					<div className="mt-4 pl-9 sm:pl-10">
						<Skeleton className="h-4 w-28 rounded" />
					</div>
				</div>

				{/* 右栏：偶得 + 尺素骨架 */}
				<div className="min-w-0 lg:border-l lg:border-border/40 lg:pl-10">
					{/* 偶得 */}
					<div>
						<div className="mb-5">
							<Skeleton className="h-3.5 w-16 rounded" />
							<Skeleton className="mt-1.5 h-6 w-20 rounded sm:h-7.5" />
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
							<Skeleton className="h-3.5 w-16 rounded" />
							<Skeleton className="mt-1.5 h-6 w-20 rounded sm:h-7.5" />
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
