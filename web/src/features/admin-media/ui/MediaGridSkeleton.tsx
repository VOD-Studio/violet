import { Skeleton } from "@/shared/ui/base/skeleton";

interface MediaGridSkeletonProps {
	/** 骨架卡片数量，默认 10 */
	count?: number;
}

/**
 * MediaGridSkeleton - 素材网格视图骨架屏
 *
 * 尺寸与响应式栅格（2/3/4/5 列）与真实 MediaGrid 1:1 对齐，
 * 每个卡片包含方形缩略图区与两行信息骨架条。
 */
export function MediaGridSkeleton({ count = 10 }: MediaGridSkeletonProps) {
	return (
		<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
			{Array.from({ length: count }, (_, i) => (
				<div key={i} className="relative overflow-hidden rounded-lg border bg-card">
					{/* 缩略图骨架占位 */}
					<div className="aspect-square w-full bg-muted/50">
						<Skeleton className="h-full w-full rounded-none" />
					</div>

					{/* 信息区骨架 */}
					<div className="space-y-2 p-2.5">
						<Skeleton className="h-3.5 w-4/5" />
						<div className="flex items-center justify-between">
							<Skeleton className="h-2.5 w-12" />
							<Skeleton className="h-2.5 w-8" />
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
