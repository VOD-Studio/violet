import { Skeleton } from "@violet/ui";

/**
 * FriendsSkeleton - /friends 页骨架屏
 *
 * 形状对齐全站内容页的 PostcardWall 明信片几何（双列错落）。
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
						<Skeleton className="h-3 w-20" />
						<Skeleton className="size-14 rounded-sm" />
					</div>
					<Skeleton className="mt-3 h-6 w-32" />
					<Skeleton className="mt-2 h-3 w-24" />
					<Skeleton className="mt-4 h-4 w-full" />
					<Skeleton className="mt-5 h-3 w-28" />
				</div>
			))}
		</div>
	);
}
