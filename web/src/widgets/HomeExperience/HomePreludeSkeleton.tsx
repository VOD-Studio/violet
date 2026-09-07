import { Skeleton } from "@shared/ui/base/skeleton";

/** 首页个人序章专属骨架屏（保持满屏视口空间，与正式 HomePrelude 1:1 几何对齐）。 */
export function HomePreludeSkeleton() {
	return (
		<section
			aria-label="正在加载个人简介"
			className="relative flex min-h-[calc(100svh-4rem)] w-full flex-col justify-between overflow-hidden bg-background text-foreground"
		>
			{/* 核心内容骨架：居中展台 */}
			<div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 items-center px-5 py-8 sm:px-8 lg:px-12">
				<div className="grid w-full items-center gap-10 md:grid-cols-[auto_1fr] md:gap-14 lg:gap-16">
					{/* 左侧形象卡片骨架 */}
					<div className="flex justify-center md:justify-start">
						<Skeleton className="size-48 rounded-xl border border-border/40 sm:size-56 lg:size-60" />
					</div>

					{/* 右侧核心文字体系骨架 */}
					<div className="max-w-xl space-y-6">
						{/* 问候大字 Hi, I'm ... */}
						<Skeleton className="h-12 w-4/5 rounded-xl sm:h-14 lg:h-16" />

						{/* 真实自白段落 */}
						<div className="space-y-2.5">
							<Skeleton className="h-4.5 w-full rounded" />
							<Skeleton className="h-4.5 w-4/5 rounded" />
						</div>

						{/* 创作足迹微指标 */}
						<div className="flex items-center gap-3 pt-1">
							<Skeleton className="h-4 w-24 rounded" />
							<span className="text-border">/</span>
							<Skeleton className="h-4 w-20 rounded" />
						</div>

						{/* 社交矩阵 */}
						<div className="flex flex-wrap gap-2.5 pt-1">
							<Skeleton className="h-8 w-20 rounded-full border border-border/50" />
							<Skeleton className="h-8 w-20 rounded-full border border-border/50" />
							<Skeleton className="h-8 w-16 rounded-full border border-border/50" />
						</div>
					</div>
				</div>
			</div>

			{/* 底部锚定条骨架 */}
			<div className="relative z-10 border-t border-border/40 bg-background/50 py-3.5">
				<div className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
					<Skeleton className="h-4 w-64 rounded" />
					<Skeleton className="h-4 w-20 rounded" />
				</div>
			</div>
		</section>
	);
}
