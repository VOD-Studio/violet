import { Skeleton } from "@violet/ui";

export type AnnouncementDirection =
	| "log"
	| "status"
	| "board"
	| "ticker"
	| "receipts"
	| "editorial";

/**
 * AnnouncementSkeleton - 各方向的骨架屏预览
 *
 * 占位形状与对应方向的几何一致：日志的行栅格（时间列 + 电码列 +
 * 标题条）、状态面板的总览条 + 分组行、告示板的 6/3/2 跨度纸张、
 * 速览带的横滚条目串、票据卷的锯齿小票格。
 */
export function AnnouncementSkeleton({ direction }: { direction: AnnouncementDirection }) {
	if (direction === "log") {
		return (
			<div>
				<div className="mb-1 flex justify-between border-b border-edge-hairline pb-2.5">
					<Skeleton className="h-3 w-32" />
					<Skeleton className="h-3 w-20" />
				</div>
				{[100, 60, 75, 50, 65, 45].map((w, i) => (
					<div
						key={i}
						className="flex items-center gap-4 border-b border-edge-hairline border-l-2 border-l-transparent px-3 py-3 last:border-b-0"
					>
						<Skeleton className="h-3.5 w-17" />
						<Skeleton className="size-1.5 rounded-full" />
						<Skeleton className="h-3.5 w-8" />
						<Skeleton className="h-3.5" style={{ width: `${w}%` }} />
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
						<Skeleton className="size-5 rounded-sm" />
						<Skeleton className="h-5 w-28" />
					</span>
					<Skeleton className="h-3.5 w-40" />
				</div>
				{[0, 1, 2].map((g) => (
					<div key={g}>
						<Skeleton className="mt-6 mb-1 h-2.5 w-24" />
						{[0, 1].map((r) => (
							<div
								key={r}
								className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-edge-hairline py-3.5"
							>
								<Skeleton className="size-4.5 rounded-sm" />
								<div>
									<Skeleton
										className="h-4"
										style={{ width: `${65 - g * 15}%` }}
									/>
									<div className="mt-1.5 flex gap-2">
										<Skeleton className="h-2.5 w-16" />
										<Skeleton className="h-2.5 w-10" />
									</div>
								</div>
								<Skeleton className="h-2.5 w-10" />
							</div>
						))}
					</div>
				))}
			</div>
		);
	}

	if (direction === "editorial") {
		return (
			<div>
				<div className="flex justify-between border-b border-edge-hairline pb-2.5">
					<Skeleton className="h-2.5 w-36" />
					<Skeleton className="h-2.5 w-10" />
				</div>
				{[true, true, false, false, false].map((major, i) => (
					<div
						key={i}
						className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-5 border-b border-edge-hairline px-2 py-3.5 last:border-b-0"
					>
						<Skeleton className="h-4 w-6" />
						<span>
							<Skeleton
								className={major ? "h-5" : "h-3.5"}
								style={{ width: `${72 - i * 10}%` }}
							/>
							{major ? <Skeleton className="mt-1.5 h-2.5 w-3/5" /> : null}
						</span>
						<Skeleton className="h-2.5 w-14" />
					</div>
				))}
			</div>
		);
	}

	if (direction === "ticker") {
		return (
			<div className="flex items-stretch border-y border-edge-hairline">
				<div className="flex w-16 shrink-0 items-center justify-center border-r border-edge-hairline">
					<Skeleton className="h-2.5 w-10" />
				</div>
				<div className="flex flex-1 items-center gap-12 overflow-hidden py-3 pl-6">
					{[80, 128, 104, 88, 116, 96].map((w, i) => (
						<span key={i} className="flex shrink-0 items-center gap-2.5">
							<Skeleton className="size-1.5 rounded-full" />
							<Skeleton className="h-3.5" style={{ width: w }} />
						</span>
					))}
				</div>
			</div>
		);
	}

	if (direction === "receipts") {
		return (
			<div className="grid grid-cols-1 gap-5 pt-3 sm:grid-cols-2 xl:grid-cols-3">
				{[0, 1, 2, 3, 4, 5].map((i) => (
					<div
						key={i}
						className="border-x border-b border-edge-hairline bg-card px-5 pt-6 pb-4 shadow-sm"
					>
						<Skeleton className="h-2.5 w-24" />
						<Skeleton
							className="mt-3 h-4.5"
							style={{ width: `${70 - (i % 3) * 15}%` }}
						/>
						<Skeleton className="mt-2 h-2.5 w-3/5" />
						<div className="mt-4 flex items-center justify-between border-t border-dashed border-edge-hairline pt-3">
							<span className="flex items-end gap-[2px]">
								{[10, 6, 9, 4, 8, 10, 5, 7].map((h, j) => (
									<Skeleton
										key={j}
										className="w-[2px]"
										style={{ height: h * 1.6 }}
									/>
								))}
							</span>
							<Skeleton className="h-2.5 w-12" />
						</div>
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 gap-5 pt-2 md:grid-cols-6">
			<div className="md:col-span-6">
				<Skeleton className="h-36 rounded-lg" />
			</div>
			<div className="md:col-span-3">
				<Skeleton className="-rotate-1 h-28 rounded-lg" />
			</div>
			<div className="md:col-span-3">
				<Skeleton className="rotate-1 h-28 rounded-lg" />
			</div>
			{["-rotate-2", "rotate-2", "-rotate-1"].map((t) => (
				<div key={t} className="md:col-span-2">
					<Skeleton className={`${t} h-14 rounded-lg`} />
				</div>
			))}
		</div>
	);
}
