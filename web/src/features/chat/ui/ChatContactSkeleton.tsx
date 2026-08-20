/** 联系人搜索加载占位。 */
export function ChatContactSkeleton() {
	return (
		<div className="space-y-2">
			{Array.from({ length: 3 }, (_, index) => (
				<div className="flex items-center gap-3 rounded-xl px-3 py-2.5" key={index}>
					<div className="size-9 animate-pulse rounded-full bg-secondary" />
					<div className="flex-1 space-y-1.5">
						<div className="h-3 w-2/3 animate-pulse rounded bg-secondary" />
						<div className="h-2.5 w-1/2 animate-pulse rounded bg-secondary" />
					</div>
				</div>
			))}
		</div>
	);
}
