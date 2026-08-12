import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";

/**
 * FriendsSkeleton - /friends 页骨架屏
 *
 * 形状对齐全站内容页的 PostcardWall 明信片几何（双列错落），
 * 沿用 shared ShimmerSkeleton 的光影扫过范式。
 *
 * 与 friends-lab 版本差异：lab 支持多方向切换故按方向枚举形状，
 * 生产只服务明信片墙一种方向，省去 direction 入参。
 */
export function FriendsSkeleton() {
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
