import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";

/**
 * AnnouncementGridSkeleton - 公告网格骨架屏
 *
 * 与 AnnouncementGrid 的 CSS columns 布局保持一致，
 * 模拟公告卡片的 header、标题、摘要、affects、footer 结构。
 */
export default function AnnouncementGridSkeleton() {
	return (
		<div className="gap-6 sm:columns-2 lg:columns-3 *:mb-6 *:break-inside-avoid">
			{Array.from({ length: 6 }).map((_, index) => (
				<div
					key={index}
					className="flex min-h-55 flex-col rounded-2xl border border-edge-hairline bg-background p-6 shadow-sm"
				>
					<div className="mb-3 flex items-center justify-between">
						<ShimmerSkeleton className="h-3 w-24 rounded-md" />
						<ShimmerSkeleton className="h-3 w-12 rounded-md" />
					</div>

					<ShimmerSkeleton className="mb-2 h-6 w-full rounded-md" />
					<ShimmerSkeleton className="mb-4 h-4 w-full rounded-md" />
					<ShimmerSkeleton className="mb-4 h-4 w-2/3 rounded-md" />

					<div className="mb-3 flex flex-wrap gap-1">
						<ShimmerSkeleton className="h-5 w-14 rounded-md" />
						<ShimmerSkeleton className="h-5 w-14 rounded-md" />
					</div>

					<div className="mt-auto flex justify-end border-t border-edge-hairline pt-3">
						<ShimmerSkeleton className="h-3 w-16 rounded-md" />
					</div>
				</div>
			))}
		</div>
	);
}
