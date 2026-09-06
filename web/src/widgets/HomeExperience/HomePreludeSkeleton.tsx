import { Skeleton } from "@shared/ui/base/skeleton";

/** 首页个人序章专属骨架屏（占满首屏，与正式 HomePrelude 1:1 几何对齐）。 */
export function HomePreludeSkeleton() {
	return (
		<section
			aria-label="正在加载个人简介"
			className="relative flex min-h-[calc(100svh-4rem)] w-full flex-col justify-between overflow-hidden bg-background text-foreground"
		>
			{/* 核心内容骨架 */}
			<div className="mx-auto flex w-full max-w-7xl flex-1 items-center px-5 py-12 sm:px-8 lg:px-12">
				<div className="grid w-full items-center gap-12 lg:grid-cols-[1.25fr_0.75fr] lg:gap-16">
					<div className="max-w-2xl space-y-6">
						{/* 状态徽标 */}
						<Skeleton className="h-6 w-36 rounded-full" />

						{/* 问候大字 */}
						<Skeleton className="h-12 w-4/5 rounded-2xl sm:h-14 lg:h-16" />

						{/* 自白段落 */}
						<div className="space-y-2.5">
							<Skeleton className="h-4.5 w-full max-w-lg rounded" />
							<Skeleton className="h-4.5 w-4/5 max-w-md rounded" />
						</div>

						{/* 创作足迹微指标 */}
						<div className="flex items-center gap-4 pt-1">
							<Skeleton className="h-4 w-24 rounded" />
							<span className="text-border">/</span>
							<Skeleton className="h-4 w-20 rounded" />
						</div>

						{/* 社交矩阵 */}
						<div className="flex flex-wrap gap-2.5 pt-2">
							<Skeleton className="h-8 w-20 rounded-full border border-border/50" />
							<Skeleton className="h-8 w-20 rounded-full border border-border/50" />
							<Skeleton className="h-8 w-16 rounded-full border border-border/50" />
						</div>
					</div>

					{/* 右侧大圆角立体形象框体骨架 */}
					<div className="flex justify-center lg:justify-end">
						<Skeleton className="size-56 rounded-[2rem] border border-border/40 sm:size-64 lg:size-72" />
					</div>
				</div>
			</div>

			{/* 底部锚定条骨架 */}
			<div className="border-t border-border/35 bg-background/60 py-3.5">
				<div className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
					<Skeleton className="h-4 w-72 rounded" />
					<Skeleton className="h-4 w-20 rounded" />
				</div>
			</div>
		</section>
	);
}
