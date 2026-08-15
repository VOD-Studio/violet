import { cn } from "@shared/lib/utils";

/** LabDirection - 博客排版实验室方向标识 */
export type LabDirection =
	| "cascade"
	| "terminal"
	| "rail"
	| "bento"
	| "paper"
	| "toc"
	| "featured"
	| "spread";

const Bar = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
	<div className={cn("animate-pulse rounded bg-muted", className)} style={style} />
);

/**
 * BlogSkeleton - 各方向的加载骨架
 *
 * 骨架形状跟随对应方向的布局语言（瀑布高度错落 / 终端行式 / 轨道条目…），
 * 而不是通用转圈。
 */
export function BlogSkeleton({ direction }: { direction: LabDirection }) {
	switch (direction) {
		case "cascade":
			return (
				<div>
					<Bar className="mb-8 aspect-[21/9] w-full rounded-2xl" />
					<div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
						{/* 高度错落的占位块，模拟瀑布流的自然节奏 */}
						{[220, 160, 190, 140, 200, 170, 180, 150].map((h, i) => (
							<div
								key={i}
								className="mb-6 break-inside-avoid overflow-hidden rounded-2xl border border-edge-hairline"
							>
								<Bar className="w-full" style={{ height: h }} />
								<div className="space-y-2 p-5">
									<Bar className="h-4 w-3/4" />
									<Bar className="h-3 w-full" />
									<Bar className="h-3 w-2/3" />
								</div>
							</div>
						))}
					</div>
				</div>
			);

		case "terminal":
			return (
				<div className="font-mono">
					<Bar className="mb-4 h-4 w-56" />
					{[92, 70, 84, 60, 78, 66, 88, 72].map((w, i) => (
						<div
							key={i}
							className="flex items-center gap-3 border-b border-edge-hairline/60 py-2.5"
						>
							<Bar className="h-3.5 w-20" />
							<Bar className="h-3.5" style={{ width: `${w}%` }} />
						</div>
					))}
				</div>
			);

		case "rail":
			return (
				<div className="relative ml-2 pl-10">
					<div className="absolute top-0 bottom-0 left-0 w-px bg-edge-hairline" />
					{[0, 1, 2, 3, 4].map((i) => (
						<div key={i} className="relative pb-12">
							<div className="absolute top-1 -left-[44.5px] size-2.5 rounded-full bg-muted" />
							<Bar className="h-3 w-24" />
							<Bar className="mt-2 h-5 w-2/3" />
							<Bar className="mt-3 h-3 w-full max-w-md" />
						</div>
					))}
				</div>
			);

		case "bento":
			return (
				<div className="grid auto-rows-[170px] grid-cols-2 gap-3 md:grid-cols-4">
					{[0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5].map((slot, i) => {
						// 与 WovenBento.SPANS 同步:6 格恰好铺满 4×3
						const spans = [
							"md:col-span-2 md:row-span-2",
							"md:col-span-2",
							"",
							"md:row-span-2",
							"md:col-span-2",
							"",
						];
						return <Bar key={i} className={cn("rounded-xl", spans[slot])} />;
					})}
				</div>
			);

		case "paper":
			return (
				<div>
					{/* 日期线 */}
					<div className="flex justify-between border-b border-edge-hairline pb-2">
						<Bar className="h-3 w-28" />
						<Bar className="h-3 w-16" />
					</div>
					{/* 报头 */}
					<Bar className="mx-auto my-6 h-12 w-52 rounded-none" />
					{/* 粗细双线 */}
					<div className="border-t-[3px] border-b border-foreground pb-1" />
					{/* 通栏头条 */}
					<div className="border-b border-edge-hairline py-8 text-center">
						<Bar className="mx-auto h-3 w-20" />
						<Bar className="mx-auto mt-4 h-9 w-4/5 rounded-none" />
						<Bar className="mx-auto mt-3 h-9 w-3/5 rounded-none" />
						<Bar className="mx-auto mt-4 h-3.5 w-2/5" />
					</div>
					{/* 三栏文字简讯:底线对齐 */}
					<div className="grid md:grid-cols-3">
						{[0, 1, 2].map((i) => (
							<div
								key={i}
								className="flex flex-col py-6 md:border-l md:px-6 md:first:border-l-0 md:first:pl-0 md:last:pr-0"
							>
								<Bar className="h-2.5 w-14" />
								<Bar className="mt-3 h-5 w-4/5 rounded-none" />
								<Bar className="mt-2 h-5 w-3/5 rounded-none" />
								<Bar className="mt-3 h-3 w-full" />
								<Bar className="mt-1.5 h-3 w-5/6" />
								<Bar className="mt-auto pt-3 h-2.5 w-20" />
							</div>
						))}
					</div>
				</div>
			);

		case "toc":
			return (
				<div>
					<div className="flex items-center gap-4 border-y-2 border-foreground py-2.5">
						<Bar className="h-3 w-24" />
						<Bar className="h-2.5 w-16" />
					</div>
					{[0, 1].map((s) => (
						<div key={s} className="mt-8">
							<Bar className="h-6 w-28 rounded-none" />
							<div className="mt-2 grid gap-x-12 md:grid-cols-2">
								{[0, 1, 2, 3].map((i) => (
									<div
										key={i}
										className="flex items-center gap-3 border-b border-edge-hairline py-3.5"
									>
										<Bar className="h-3 w-5" />
										<Bar
											className="h-4 flex-1"
											style={{ maxWidth: `${75 - i * 8}%` }}
										/>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			);

		case "featured":
			return (
				<div>
					<div className="grid gap-8 md:grid-cols-2 md:items-center">
						<Bar className="aspect-[16/10] w-full rounded-2xl" />
						<div>
							<Bar className="h-3 w-24" />
							<Bar className="mt-3 h-10 w-4/5" />
							<Bar className="mt-3 h-10 w-3/5" />
							<Bar className="mt-4 h-4 w-full" />
						</div>
					</div>
					<div className="mt-12 border-t border-edge-hairline">
						{[0, 1, 2, 3, 4, 5].map((i) => (
							<div
								key={i}
								className="flex items-center gap-4 border-b border-edge-hairline py-4"
							>
								<Bar className="h-3 w-6" />
								<Bar
									className="h-4 flex-1"
									style={{ maxWidth: `${70 - i * 6}%` }}
								/>
								<Bar className="h-3 w-10" />
							</div>
						))}
					</div>
				</div>
			);

		case "spread":
			return (
				<div className="divide-y divide-edge-hairline">
					{[0, 1, 2].map((i) => (
						<div
							key={i}
							className={`grid items-center gap-8 py-10 first:pt-0 last:pb-0 md:grid-cols-2 ${
								i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
							}`}
						>
							<Bar className="aspect-[3/2] w-full rounded-2xl" />
							<div>
								<Bar className="h-8 w-4/5" />
								<Bar className="mt-3 h-8 w-3/5" />
								<Bar className="mt-4 h-3.5 w-full" />
								<Bar className="mt-1.5 h-3.5 w-5/6" />
								<Bar className="mt-4 h-2.5 w-32" />
							</div>
						</div>
					))}
				</div>
			);
	}
}
