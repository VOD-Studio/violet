import { Card, Skeleton } from "@violet/ui";

/** 公开友链网格的加载占位。 */
export function FriendsSkeleton() {
	return (
		<div
			role="status"
			aria-label="正在加载友链"
			className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
		>
			{Array.from({ length: 9 }, (_, index) => (
				<Card key={index}>
					<div className="flex items-center gap-3">
						<Skeleton className="size-12 rounded-full" />
						<div className="space-y-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-3 w-32" />
						</div>
					</div>
					<Skeleton className="mt-5 h-4 w-full" />
					<Skeleton className="mt-5 h-4 w-40" />
				</Card>
			))}
		</div>
	);
}
