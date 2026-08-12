import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";

export type LabDirection = "cards" | "postcards" | "terminal";

/**
 * FriendsSkeleton - 三个方向的骨架屏预览
 *
 * 占位形状与对应方向的卡片几何一致（名片横条 / 明信片大块 / 终端行），
 * 沿用 shared ShimmerSkeleton 的光影扫过范式。
 */
export function FriendsSkeleton({ direction }: { direction: LabDirection }) {
	if (direction === "terminal") {
		return (
			<div className="overflow-hidden rounded-2xl border border-edge-hairline">
				<div className="flex items-center gap-1.5 border-b border-edge-hairline px-4 py-2.5">
					<ShimmerSkeleton className="size-2.5 rounded-full" />
					<ShimmerSkeleton className="size-2.5 rounded-full" />
					<ShimmerSkeleton className="size-2.5 rounded-full" />
				</div>
				<div className="flex flex-col gap-3 px-6 py-5">
					{Array.from({ length: 8 }, (_, i) => (
						<div key={i} className="flex items-center gap-3">
							<ShimmerSkeleton className="h-4 w-6" />
							<ShimmerSkeleton className="h-4 w-40" />
							<ShimmerSkeleton className="h-4 flex-1" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (direction === "postcards") {
		return (
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
				{Array.from({ length: 6 }, (_, i) => (
					<div
						key={i}
						className={`rounded-md border border-edge-hairline bg-card p-6 ${
							i % 2 === 1 ? "md:translate-y-6" : ""
						}`}
					>
						<div className="flex items-start justify-between">
							<ShimmerSkeleton className="h-3 w-20" />
							<ShimmerSkeleton className="size-14 rounded-sm" />
						</div>
						<ShimmerSkeleton className="mt-3 h-6 w-32" />
						<ShimmerSkeleton className="mt-2 h-3 w-24" />
						<ShimmerSkeleton className="mt-4 h-4 w-full" />
						<ShimmerSkeleton className="mt-5 h-3 w-28" />
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{Array.from({ length: 6 }, (_, i) => (
				<div
					key={i}
					className="rounded-xl border border-edge-hairline bg-card p-5 shadow-sm"
				>
					<div className="flex items-start gap-4">
						<ShimmerSkeleton className="size-14 rounded-lg" />
						<div className="flex-1">
							<ShimmerSkeleton className="h-5 w-28" />
							<ShimmerSkeleton className="mt-2 h-3 w-24" />
						</div>
					</div>
					<ShimmerSkeleton className="mt-3 h-4 w-full" />
					<ShimmerSkeleton className="mt-2 h-3 w-16" />
				</div>
			))}
		</div>
	);
}
