import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";

export type AnnouncementDirection = "log" | "status" | "board";

/**
 * AnnouncementSkeleton - 三个方向的骨架屏预览
 *
 * 占位形状与对应方向的几何一致：日志的行栅格（时间列 + 电码列 +
 * 标题条）、状态面板的总览条 + 分组行、告示板的 6/3/2 跨度纸张。
 */
export function AnnouncementSkeleton({ direction }: { direction: AnnouncementDirection }) {
	if (direction === "log") {
		return (
			<div>
				<div className="mb-1 flex justify-between border-b border-edge-hairline pb-2.5">
					<ShimmerSkeleton className="h-3 w-32" />
					<ShimmerSkeleton className="h-3 w-20" />
				</div>
				{[100, 60, 75, 50, 65, 45].map((w, i) => (
					<div
						key={i}
						className="flex items-center gap-4 border-b border-edge-hairline border-l-2 border-l-transparent px-3 py-3 last:border-b-0"
					>
						<ShimmerSkeleton className="h-3.5 w-17" />
						<ShimmerSkeleton className="size-1.5 rounded-full" />
						<ShimmerSkeleton className="h-3.5 w-8" />
						<ShimmerSkeleton className="h-3.5" style={{ width: `${w}%` }} />
					</div>
				))}
			</div>
		);
	}

	if (direction === "status") {
		return (
			<div>
				<div className="flex items-center justify-between rounded-lg border border-edge-hairline px-5 py-4">
					<span className="flex items-center gap-3">
						<ShimmerSkeleton className="size-5 rounded-sm" />
						<ShimmerSkeleton className="h-5 w-28" />
					</span>
					<ShimmerSkeleton className="h-3.5 w-40" />
				</div>
				{[0, 1, 2].map((g) => (
					<div key={g}>
						<ShimmerSkeleton className="mt-6 mb-1 h-2.5 w-24" />
						{[0, 1].map((r) => (
							<div
								key={r}
								className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-edge-hairline py-3.5"
							>
								<ShimmerSkeleton className="size-4.5 rounded-sm" />
								<div>
									<ShimmerSkeleton
										className="h-4"
										style={{ width: `${65 - g * 15}%` }}
									/>
									<div className="mt-1.5 flex gap-2">
										<ShimmerSkeleton className="h-2.5 w-16" />
										<ShimmerSkeleton className="h-2.5 w-10" />
									</div>
								</div>
								<ShimmerSkeleton className="h-2.5 w-10" />
							</div>
						))}
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 gap-5 pt-2 md:grid-cols-6">
			<div className="md:col-span-6">
				<ShimmerSkeleton className="h-36 rounded-lg" />
			</div>
			<div className="md:col-span-3">
				<ShimmerSkeleton className="-rotate-1 h-28 rounded-lg" />
			</div>
			<div className="md:col-span-3">
				<ShimmerSkeleton className="rotate-1 h-28 rounded-lg" />
			</div>
			{["-rotate-2", "rotate-2", "-rotate-1"].map((t) => (
				<div key={t} className="md:col-span-2">
					<ShimmerSkeleton className={`${t} h-14 rounded-lg`} />
				</div>
			))}
		</div>
	);
}
